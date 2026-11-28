// Fills in the add and edit item dialogs from a product link. Browser only.
//
// The server fetches most shops' pages fine, but some stores, Amazon above
// all, block it. When the Regibee extension is installed, it can open the
// link in a background tab and read the product there, the same way it does
// when the owner clicks its button on a product page. So at the stores the
// extension reads, ask it first.

import { scrapeProductUrl } from "@/lib/actions/scrape";
import {
  extensionCanReadLink,
  parseReadProduct,
  type ReadProduct,
} from "@/lib/extension";
import { extensionFeatures, sendToExtension as send, waitForExtension as waitFor } from "@/lib/extension-page";

export type ProductDetails = Awaited<ReturnType<typeof scrapeProductUrl>>;

// Opening the tab, loading the page and reading it. The extension stops
// waiting for the page after 15 seconds. It reads one link at a time for
// every Regibee tab, so this read can also wait for one another tab asked for.
const READ_TIMEOUT_MS = 45_000;

function readWithExtension(url: string): Promise<ReadProduct | null> {
  const id = crypto.randomUUID();
  const answer = waitFor((m) => (m.type === "product" && m.id === id ? m : undefined), READ_TIMEOUT_MS);
  send({ type: "read-product", id, url });
  return answer.then((message) => (message ? parseReadProduct(message.product) : null));
}

// The extension reads one page at a time. Versions before 0.2.2 refuse
// another request while they're busy. A refused read would fall back to the
// server, which Amazon blocks, so the owner would see an error while the
// first read was about to work. So each read through the extension waits for
// the one before it. From 0.2.2 the extension also makes reads from other
// Regibee tabs take turns, which this page can't see.
let extensionTurn: Promise<unknown> = Promise.resolve();

function inExtensionTurn<T>(task: () => Promise<T>): Promise<T> {
  const result = extensionTurn.then(task);
  extensionTurn = result.catch(() => {});
  return result;
}

/** Whether the Regibee extension on this computer can read store pages for the site. */
export async function extensionReadsProducts(): Promise<boolean> {
  const features = await extensionFeatures();
  return Boolean(features?.includes("read-product"));
}

/**
 * Reads a product link with the extension only, after any read before it.
 * Null when the extension couldn't: the page wasn't a product page, or the
 * store showed a robot check. Check extensionReadsProducts first.
 */
export function readProductWithExtension(url: string): Promise<ReadProduct | null> {
  const secureUrl = url.replace(/^http:\/\//i, "https://");
  return inExtensionTurn(() => readWithExtension(secureUrl));
}

interface Read {
  answer: Promise<ProductDetails>;
  /** True once the extension has started reading the page. */
  withExtension: boolean;
  /** Callers to tell when the extension starts reading. */
  onReading: Set<() => void>;
}

// Reads under way on this page, by link. Closing a dialog doesn't stop its
// read, so a dialog reopened for the same link joins that read instead of
// waiting behind it.
const reads = new Map<string, Read>();

async function readLink(url: string, secureUrl: string, startedWithExtension: () => void): Promise<ProductDetails> {
  if (extensionCanReadLink(secureUrl)) {
    const product = await inExtensionTurn(async () => {
      const features = await extensionFeatures();
      if (!features?.includes("read-product")) return null;
      startedWithExtension();
      return readWithExtension(secureUrl);
    });
    if (product) {
      return {
        title: product.title,
        price: product.price != null ? product.price.toFixed(2) : undefined,
        imageUrl: product.images[0],
        imageUrls: product.images.length > 0 ? product.images : undefined,
        ...(product.gtin ? { gtin: product.gtin } : {}),
      };
    }
  }
  return scrapeProductUrl(url);
}

interface Options {
  /** Called when the extension starts reading the link in a background tab. */
  onReadingWithExtension?: () => void;
}

/**
 * A product link's name, price, pictures and barcode number. At a store the extension reads,
 * the extension reads it when it's installed. Otherwise, or when it couldn't,
 * the server fetches the page. Asking for a link that's already being read
 * gives that read's answer.
 */
export function fetchProductDetails(url: string, options: Options = {}): Promise<ProductDetails> {
  // The dialogs add http:// to a link pasted without one. The stores are all on https.
  const secureUrl = url.replace(/^http:\/\//i, "https://");
  let read = reads.get(secureUrl);
  if (!read) {
    const started: Read = { answer: Promise.resolve({}), withExtension: false, onReading: new Set() };
    started.answer = readLink(url, secureUrl, () => {
      started.withExtension = true;
      for (const tell of started.onReading) tell();
    }).finally(() => {
      if (reads.get(secureUrl) === started) reads.delete(secureUrl);
    });
    reads.set(secureUrl, started);
    read = started;
  }
  const { onReadingWithExtension } = options;
  if (onReadingWithExtension) {
    if (read.withExtension) onReadingWithExtension();
    else read.onReading.add(onReadingWithExtension);
  }
  return read.answer;
}

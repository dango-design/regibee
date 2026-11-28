// Reading a product link for the website. A Regibee page asks the extension
// to open a store link in a background tab and read the product. The
// extension reads one link at a time, and every Regibee tab shares it, so
// requests that arrive together wait their turn. These are small made-up
// pages, so they run on any computer.

import type { BrowserContext, Page } from "@playwright/test";
import type { ReadProduct } from "../../src/lib/extension";
import { expect, openTabsBlankFirst, test } from "./extension";

const REGIBEE_PAGE = "https://www.regibee.com/dashboard";

function productUrl(n: number): string {
  return `https://www.amazon.com/dp/B0TEST010${n}`;
}

function productHtml(title: string): string {
  return `<!doctype html>
<html>
  <head><title>Amazon.com: ${title}</title></head>
  <body>
    <span id="productTitle">${title}</span>
  </body>
</html>`;
}

/** Answers a store link with a made-up product page, after `delayMs`. */
async function serveProduct(context: BrowserContext, url: string, title: string, delayMs = 0) {
  await context.route(
    (u) => u.href === url,
    async (route) => {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      await route.fulfill({ contentType: "text/html; charset=utf-8", body: productHtml(title) });
    }
  );
}

/** A tab on a Regibee page, with the extension's content script ready. */
async function openRegibeeTab(context: BrowserContext): Promise<Page> {
  const tab = await context.newPage();
  await tab.goto(REGIBEE_PAGE);
  await expect
    .poll(() =>
      tab.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const onMessage = (event: MessageEvent) => {
              if (event.data?.source !== "regibee-extension" || event.data.type !== "ready") return;
              window.removeEventListener("message", onMessage);
              resolve(true);
            };
            window.addEventListener("message", onMessage);
            window.postMessage({ source: "regibee-page", type: "hello" }, location.origin);
            setTimeout(() => resolve(false), 300);
          })
      )
    )
    .toBe(true);
  return tab;
}

interface Answer {
  product: ReadProduct | null;
  error?: string;
}

/** Asks the extension to read a link, the way the website does. */
function read(tab: Page, url: string): Promise<Answer> {
  return tab.evaluate(
    (url) =>
      new Promise<Answer>((resolve) => {
        const id = crypto.randomUUID();
        const onMessage = (event: MessageEvent) => {
          const data = event.data;
          if (data?.source !== "regibee-extension" || data.type !== "product" || data.id !== id) return;
          window.removeEventListener("message", onMessage);
          resolve({ product: data.product, error: data.error });
        };
        window.addEventListener("message", onMessage);
        window.postMessage({ source: "regibee-page", type: "read-product", id, url }, location.origin);
      }),
    url
  );
}

test.beforeEach(async ({ context, worker }) => {
  await openTabsBlankFirst(worker);
  await context.route(
    (u) => u.href === REGIBEE_PAGE,
    (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Regibee</title>" })
  );
});

test("reads a store link for a Regibee page and closes its tab", async ({ context }) => {
  await serveProduct(context, productUrl(1), "Water Bottle Organizer");
  const tab = await openRegibeeTab(context);

  const answer = await read(tab, productUrl(1));

  expect(answer.error).toBeUndefined();
  expect(answer.product).toMatchObject({ title: "Water Bottle Organizer" });
  await expect.poll(() => context.pages().some((page) => page.url() === productUrl(1))).toBe(false);
});

test("two Regibee tabs asking at once are both read, one after the other", async ({ context }) => {
  // The first page is slow, so the second request arrives while it's still loading.
  await serveProduct(context, productUrl(1), "Water Bottle Organizer", 1500);
  await serveProduct(context, productUrl(2), "Stroller Fan");
  const first = await openRegibeeTab(context);
  const second = await openRegibeeTab(context);

  // How many store tabs are open at once.
  let open = 0;
  let mostOpen = 0;
  context.on("request", (request) => {
    if (request.isNavigationRequest() && request.url().startsWith("https://www.amazon.com/")) {
      open += 1;
      mostOpen = Math.max(mostOpen, open);
      void request.frame().page().waitForEvent("close").then(() => (open -= 1));
    }
  });

  const [one, two] = await Promise.all([read(first, productUrl(1)), read(second, productUrl(2))]);

  expect(one.error).toBeUndefined();
  expect(two.error).toBeUndefined();
  expect(one.product?.title).toBe("Water Bottle Organizer");
  expect(two.product?.title).toBe("Stroller Fan");
  expect(mostOpen).toBe(1);
});

test("a read still waiting when its Regibee tab closes opens nothing", async ({ context, worker }) => {
  await serveProduct(context, productUrl(1), "Water Bottle Organizer", 1500);
  await serveProduct(context, productUrl(2), "Stroller Fan");
  const first = await openRegibeeTab(context);
  const second = await openRegibeeTab(context);

  let openedFirst = false;
  let openedSecond = false;
  context.on("request", (request) => {
    if (request.url() === productUrl(1)) openedFirst = true;
    if (request.url() === productUrl(2)) openedSecond = true;
  });

  const one = read(first, productUrl(1));
  // The second tab asks, then closes while the first link is still loading.
  void read(second, productUrl(2)).catch(() => {});
  await expect.poll(() => openedFirst).toBe(true);
  await second.close();

  expect((await one).product?.title).toBe("Water Bottle Organizer");
  // Give the queue time to reach the second read, then check no store tab is left.
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.tabs.query({ url: "https://www.amazon.com/*" })).length))
    .toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(openedSecond).toBe(false);
});

"use server";

import { lookup } from "node:dns/promises";
import { isBlockedAddress, readProductPage, type ProductDetails } from "@/lib/product-page";
import { createClient } from "@/utils/supabase/server";

const MAX_REDIRECTS = 5;

// The end-to-end tests serve a store's product page from this computer, at
// 127.0.0.1 on a port of their own, and only they set this
// (e2e/playwright.config.ts). A production build ignores it, so a deployed
// site can never be pointed at its own machine.
const ALLOW_TEST_PAGES =
  process.env.NODE_ENV !== "production" && process.env.SCRAPE_ALLOW_LOCAL_TEST_PAGES === "true";
const BLOCKED_URL_ERROR =
  "This URL can't be fetched automatically. Please enter the item details manually.";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Sec-Ch-Ua":
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

/**
 * Returns an error message if the server should not request this URL, or null
 * if it is safe to fetch. Blocks non-web protocols, non-default ports, and any
 * hostname that resolves to a private, loopback or link-local address.
 */
async function checkFetchableUrl(url: URL): Promise<string | null> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "URL must start with http:// or https://";
  }
  if (ALLOW_TEST_PAGES && url.hostname === "127.0.0.1") {
    return null;
  }
  // URL.port is "" when the port is the scheme's default (80 or 443).
  if (url.port !== "") {
    return BLOCKED_URL_ERROR;
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return "Couldn't find that website. Check the URL and try again.";
  }

  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    console.log(`[scrape] Blocked request to non-public address: ${url.hostname}`);
    return BLOCKED_URL_ERROR;
  }
  return null;
}

export async function scrapeProductUrl(url: string): Promise<ProductDetails> {
  // Server actions can be called directly, not only from the add/edit item
  // dialogs, so require a signed-in (non-guest) user here.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return { error: "Please sign in to fetch product details." };
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { error: "URL must start with http:// or https://" };
    }
  } catch {
    return { error: "Invalid URL format" };
  }

  // Fetch the page HTML
  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // Follow redirects manually so every hop gets the same address check.
    let currentUrl = parsedUrl;
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const blockedReason = await checkFetchableUrl(currentUrl);
      if (blockedReason) {
        clearTimeout(timeout);
        return { error: blockedReason };
      }

      console.log(`[scrape] Fetching: ${currentUrl.toString()}`);

      const res = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        headers: REQUEST_HEADERS,
        redirect: "manual",
      });

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        currentUrl = new URL(location, currentUrl);
        continue;
      }

      response = res;
      break;
    }

    clearTimeout(timeout);

    if (!response) {
      return { error: "Too many redirects" };
    }

    console.log(`[scrape] Response: ${response.status} ${response.statusText}`);
    console.log(`[scrape] Response URL (after redirects): ${currentUrl.toString()}`);
    console.log(`[scrape] Content-Type: ${response.headers.get("content-type")}`);

    if (!response.ok) {
      const body = await response.text();
      console.log(`[scrape] Error body (first 500 chars): ${body.substring(0, 500)}`);
      return { error: `Failed to fetch page (${response.status})` };
    }

    html = await response.text();
    console.log(`[scrape] HTML length: ${html.length} chars`);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { error: "Request timed out" };
    }
    return { error: "Failed to fetch page" };
  }

  return readProductPage(html, url);
}

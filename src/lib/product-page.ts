// Reads a product's name, price, pictures and barcode number from a store's
// page, for the add and edit item dialogs' autofill. src/lib/actions/scrape.ts fetches the page
// and calls this. It's kept apart from the fetching, with no "@/" imports, so
// `npm test` can run it on saved pages (product-page.test.ts).
//
// Server only: it uses node:net.

import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { gtinFromStorePageData, gtinFromStructuredData, normalizeGtin } from "./gtin.ts";

export interface ProductDetails {
  title?: string;
  imageUrl?: string;
  imageUrls?: string[];
  price?: string;
  /** The product's barcode number (src/lib/gtin.ts), when the page has one. */
  gtin?: string;
  error?: string;
}

function isBlockedIPv4(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // 10.0.0.0/8 private
    a === 127 || // 127.0.0.0/8 loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 carrier-grade NAT
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24 IETF protocol assignments
    (a === 192 && b === 168) || // 192.168.0.0/16 private
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
    a >= 224 // multicast and reserved
  );
}

function isBlockedIPv6(ip: string): boolean {
  // Only global unicast (2000::/3) is routable on the public internet. This
  // rejects loopback, unspecified, link-local, unique local, multicast, and
  // IPv4-mapped or NAT64 forms that could point at a private IPv4 address.
  const firstGroup = parseInt(ip.split(":")[0], 16);
  return !(firstGroup >= 0x2000 && firstGroup <= 0x3fff);
}

/**
 * True when the server must not request this address: private, loopback,
 * link-local (cloud metadata) and reserved ranges, and anything that isn't an
 * IP address at all.
 */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIPv4(ip);
  if (version === 6) return isBlockedIPv6(ip);
  return true;
}

function resolveUrl(raw: string, origin: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, origin).toString();
  } catch {
    return undefined;
  }
}

function pushImage(list: string[], seen: Set<string>, raw: string | undefined, origin: string) {
  if (!raw) return;
  const resolved = resolveUrl(raw, origin);
  if (!resolved) return;
  // Skip tiny tracking pixels and SVG icons
  if (/\.svg(?:$|\?)/i.test(resolved)) return;
  if (seen.has(resolved)) return;
  seen.add(resolved);
  list.push(resolved);
}

// Generic site titles that indicate bot protection or empty pages
const GENERIC_TITLES = new Set([
  "amazon.com",
  "walmart.com",
  "target",
  "ebay",
  "robot check",
  "access denied",
  "just a moment...",
  "attention required",
  "page not found",
  "404",
]);

function isGenericTitle(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return GENERIC_TITLES.has(lower) || lower.length < 3;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** The most pictures a page offers the owner to choose from. */
export const MAX_IMAGE_CANDIDATES = 12;

/**
 * The product on this page. `pageUrl` is the link the owner gave, which
 * relative picture addresses resolve against. Returns an error, never
 * throws, when the page is a bot check or has nothing to read.
 */
export function readProductPage(html: string, pageUrl: string): ProductDetails {
  // Detect bot protection / minimal pages
  if (html.length < 10000) {
    const lower = html.toLowerCase();
    if (
      lower.includes("captcha") ||
      lower.includes("robot") ||
      lower.includes("blocked") ||
      lower.includes("access denied") ||
      lower.includes("challenge-running")
    ) {
      return {
        error:
          "This site blocked automatic fetching. Please enter the item details manually.",
      };
    }
  }

  // Parse with cheerio
  const $ = cheerio.load(html);

  // Extract title (priority order)
  const rawTitle =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().trim() ||
    $('meta[name="twitter:title"]').attr("content")?.trim() ||
    undefined;

  // Decode HTML entities and filter out generic/useless titles
  const decodedTitle = rawTitle ? decodeHtmlEntities(rawTitle) : undefined;
  const title =
    decodedTitle && !isGenericTitle(decodedTitle) ? decodedTitle : undefined;

  // Collect candidate images in priority order (deduped, absolute URLs)
  const imageCandidates: string[] = [];
  const seenImages = new Set<string>();
  const origin = new URL(pageUrl).origin;

  // Open Graph + Twitter card meta tags (highest-signal product images)
  $('meta[property="og:image"]').each((_, el) => {
    pushImage(imageCandidates, seenImages, $(el).attr("content"), origin);
  });
  $('meta[property="og:image:secure_url"]').each((_, el) => {
    pushImage(imageCandidates, seenImages, $(el).attr("content"), origin);
  });
  $('meta[property="og:image:url"]').each((_, el) => {
    pushImage(imageCandidates, seenImages, $(el).attr("content"), origin);
  });
  $('meta[name="twitter:image"]').each((_, el) => {
    pushImage(imageCandidates, seenImages, $(el).attr("content"), origin);
  });
  $('meta[name="twitter:image:src"]').each((_, el) => {
    pushImage(imageCandidates, seenImages, $(el).attr("content"), origin);
  });
  pushImage(
    imageCandidates,
    seenImages,
    $('link[rel="image_src"]').attr("href"),
    origin
  );
  $('[itemprop="image"]').each((_, el) => {
    const node = $(el);
    pushImage(imageCandidates, seenImages, node.attr("content"), origin);
    pushImage(imageCandidates, seenImages, node.attr("src"), origin);
    pushImage(imageCandidates, seenImages, node.attr("href"), origin);
  });

  // Extract price (priority order)
  let price: string | undefined;

  // 1. Try JSON-LD structured data (for both price and additional images)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const nodes = Array.isArray(data) ? data : [data];
      for (const item of nodes) {
        const product =
          item["@type"] === "Product"
            ? item
            : item["@graph"]?.find(
                (g: Record<string, string>) => g["@type"] === "Product"
              );
        if (!product) continue;

        // Collect product images (can be string, array of strings, or ImageObject)
        const img = product.image;
        const addImg = (v: unknown) => {
          if (typeof v === "string") {
            pushImage(imageCandidates, seenImages, v, origin);
          } else if (v && typeof v === "object") {
            const url = (v as { url?: string; contentUrl?: string }).url
              ?? (v as { url?: string; contentUrl?: string }).contentUrl;
            if (url) pushImage(imageCandidates, seenImages, url, origin);
          }
        };
        if (Array.isArray(img)) img.forEach(addImg);
        else addImg(img);

        if (!price && product.offers) {
          const offers = Array.isArray(product.offers)
            ? product.offers[0]
            : product.offers;
          const p =
            offers?.price ?? offers?.lowPrice ?? offers?.highPrice;
          if (p != null) {
            price = String(p);
          }
        }
      }
    } catch {
      // Ignore invalid JSON-LD
    }
  });

  // 2. Try Open Graph / meta tag price
  if (!price) {
    price =
      $('meta[property="og:price:amount"]').attr("content")?.trim() ||
      $('meta[property="product:price:amount"]').attr("content")?.trim() ||
      $('meta[name="price"]').attr("content")?.trim() ||
      $('meta[property="product:price"]').attr("content")?.trim() ||
      undefined;
  }

  // 3. Try common price selectors in page content
  if (!price) {
    const priceSelectors = [
      '[data-test-id="product-pricing-list-sale-range-amount"]',
      '[data-test-id*="price"] [data-test-id*="amount"]',
      '[data-automation-id="product-price"] .price-characteristic',
      '.product-price .price',
      '[itemprop="price"]',
      '.price-sales .price-amount',
    ];
    for (const selector of priceSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        price = text;
        break;
      }
      const content = $(selector).first().attr("content")?.trim();
      if (content) {
        price = content;
        break;
      }
    }
  }

  // Clean up price — remove currency symbols, commas
  if (price) {
    price = price.replace(/[^0-9.]/g, "");
    // Validate it's a reasonable number
    const num = parseFloat(price);
    if (isNaN(num) || num <= 0) {
      price = undefined;
    } else {
      price = num.toFixed(2);
    }
  }

  // 4. Fallback: scan raw HTML for embedded JSON patterns ecommerce sites use
  //    (e.g. Target's __TGT_DATA__ `alternate_images`, Amazon's `hiRes`, Shopify media)
  const isLikelyImage = (u: string) => {
    if (/\.(jpe?g|png|webp|gif|avif)(\?|$|#)/i.test(u)) return true;
    if (/scene7\.com\/is\/image\//i.test(u)) return true;
    if (/images-(?:na|eu|cn|fe)\.ssl-images-amazon\.com/i.test(u)) return true;
    if (/m\.media-amazon\.com\/images\//i.test(u)) return true;
    if (/i\d*\.walmartimages\.com/i.test(u)) return true;
    if (/cdn\.shopify\.com\/.*\/(?:products|files)\//i.test(u)) return true;
    return false;
  };

  // Target / Shopify / generic galleries: `"alternate_images|additional_images|images|media_gallery": [...]`
  const galleryKeyRegex =
    /"(?:alternate_images|additional_images|media_gallery|gallery_images|image_gallery|images)"\s*:\s*(\[[\s\S]*?\])/g;
  let gm: RegExpExecArray | null;
  let galleriesScanned = 0;
  while ((gm = galleryKeyRegex.exec(html)) && galleriesScanned < 5) {
    galleriesScanned++;
    const arr = gm[1];
    const urlInObjectRegex =
      /"(?:url|src|contentUrl|href|hiRes|large|image|image_url|imageUrl)"\s*:\s*"([^"]+)"/g;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlInObjectRegex.exec(arr))) {
      const u = urlMatch[1];
      if (isLikelyImage(u)) pushImage(imageCandidates, seenImages, u, origin);
    }
    const plainStringRegex = /"(https?:\/\/[^"\s]+?)"/g;
    let strMatch: RegExpExecArray | null;
    while ((strMatch = plainStringRegex.exec(arr))) {
      const u = strMatch[1];
      if (isLikelyImage(u)) pushImage(imageCandidates, seenImages, u, origin);
    }
  }

  // Single-value primary image keys scattered through embedded JSON
  const primaryKeyRegex =
    /"(?:primary_image_url|primaryImageUrl|hero_image|heroImage|hiRes|mainImage|main_image_url)"\s*:\s*"([^"]+)"/g;
  let pm: RegExpExecArray | null;
  while ((pm = primaryKeyRegex.exec(html))) {
    if (isLikelyImage(pm[1])) {
      pushImage(imageCandidates, seenImages, pm[1], origin);
    }
  }

  // Amazon-style data-a-dynamic-image="{\"url1\":[w,h],...}" (keys are URLs)
  const amazonDynRegex = /data-a-dynamic-image\s*=\s*["']([^"']+)["']/g;
  let am: RegExpExecArray | null;
  while ((am = amazonDynRegex.exec(html))) {
    try {
      const decoded = am[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&");
      const obj = JSON.parse(decoded);
      for (const u of Object.keys(obj)) {
        if (isLikelyImage(u)) pushImage(imageCandidates, seenImages, u, origin);
      }
    } catch {
      // ignore
    }
  }

  // Cap to a reasonable number so the picker doesn't become unmanageable
  if (imageCandidates.length > MAX_IMAGE_CANDIDATES) {
    imageCandidates.length = MAX_IMAGE_CANDIDATES;
  }

  const primaryImageUrl = imageCandidates[0];
  const gtin = readGtin($, pageUrl);

  // If we got nothing useful, return a helpful error
  if (!title && !primaryImageUrl && !price) {
    return {
      error:
        "Couldn't extract product details from this page. The site may block automated access. Please enter the details manually.",
    };
  }

  return {
    title: title || undefined,
    imageUrl: primaryImageUrl,
    imageUrls: imageCandidates.length > 0 ? imageCandidates : undefined,
    price: price || undefined,
    ...(gtin ? { gtin } : {}),
  };
}

/**
 * The product's barcode number. Target's and Walmart's page data comes first,
 * since it has one for the color or size the link picks. Then the structured
 * data most shops add for search engines, then schema.org attributes on the
 * page itself.
 */
function readGtin($: cheerio.CheerioAPI, pageUrl: string): string | null {
  const pageData = $("script#__NEXT_DATA__").first().text();
  if (pageData) {
    try {
      const gtin = gtinFromStorePageData(JSON.parse(pageData), pageUrl);
      if (gtin) return gtin;
    } catch {
      // Not JSON after all.
    }
  }

  const products: unknown[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const value = node as Record<string, unknown>;
    const types = ([] as unknown[]).concat(value["@type"]);
    if (types.some((t) => typeof t === "string" && /^(Product|ProductGroup|IndividualProduct)$/i.test(t))) {
      products.push(value);
    }
    visit(value["@graph"]);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).text()));
    } catch {
      // Ignore invalid JSON-LD
    }
  });
  for (const product of products) {
    const gtin = gtinFromStructuredData(product, pageUrl);
    if (gtin) return gtin;
  }

  const marked = new Set<string>();
  $('[itemprop^="gtin"]').each((_, el) => {
    const node = $(el);
    const gtin = normalizeGtin(node.attr("content") ?? node.text());
    if (gtin) marked.add(gtin);
  });
  return marked.size === 1 ? [...marked][0] : null;
}

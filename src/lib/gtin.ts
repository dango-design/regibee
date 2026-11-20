// Barcode numbers on products. The UPC printed on US packaging (12 digits)
// and the EAN on European packaging (13 digits) are both GTINs, along with an
// 8-digit form for small packs and a 14-digit form for cases. The same GTIN at
// two stores means the same product.
//
// Regibee saves one on an item or gift idea when the store's page has it
// (supabase/migrations/20261118072620_item_barcodes.sql). Nothing shows it yet.
//
// No imports, so the server, the site's dialogs and the extension can all use it.

/**
 * A barcode number as Regibee saves it: 14 digits, padded with zeros at the
 * front, so a product's 12-digit UPC and its 13-digit EAN come out the same.
 * Null when it isn't a real GTIN: the wrong length, or a last digit that
 * doesn't match the check every GTIN carries.
 */
export function normalizeGtin(raw: unknown): string | null {
  let text: string;
  if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw) || raw <= 0) return null;
    text = String(raw);
  } else if (typeof raw === "string") {
    text = raw.replace(/[\s-]/g, "");
  } else {
    return null;
  }
  // 8 digits is the shortest GTIN. A store that saves one as a number drops
  // its leading zeros, so anything from 8 to 14 digits can be one.
  if (!/^\d{8,14}$/.test(text)) return null;
  const gtin = text.padStart(14, "0");
  if (/^0+$/.test(gtin)) return null;
  // The last digit is a check digit. Going left from the one before it, the
  // digits are weighted 3, 1, 3, 1…, and the total plus the check digit is a
  // multiple of 10.
  let total = 0;
  for (let i = 0; i < 13; i++) total += Number(gtin[i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (total % 10)) % 10 === Number(gtin[13]) ? gtin : null;
}

// ── Reading one from a page ─────────────────────────────────────────────
// The server's reader (src/lib/product-page.ts) uses these. The extension's
// reader (extension/src/product-reader.ts) can't import anything, so it has
// its own copy of the same rules. gtinFromDetailRows is for Amazon, which
// only the extension reads: the server can't fetch Amazon's pages.

type Json = Record<string, unknown>;

const GTIN_KEYS = ["gtin", "gtin14", "gtin13", "gtin12", "gtin8"];

function isObject(value: unknown): value is Json {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function ownGtin(node: unknown): string | null {
  if (!isObject(node)) return null;
  for (const key of GTIN_KEYS) {
    const gtin = normalizeGtin(node[key]);
    if (gtin) return gtin;
  }
  return null;
}

/** The one barcode in the list, or null when there's none or more than one. */
function onlyOne(gtins: (string | null)[]): string | null {
  const found = [...new Set(gtins.filter((g): g is string => Boolean(g)))];
  return found.length === 1 ? found[0] : null;
}

/** A link's `variant` setting, which Shopify shops use to pick a color or size. */
function variantOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    return new URL(raw).searchParams.get("variant");
  } catch {
    return null;
  }
}

/**
 * The barcode in a page's structured data for search engines: a schema.org
 * Product or ProductGroup. It can be on the product, on its offers, or on
 * each color or size listed as a variant. Of several variants, it takes the
 * one the link picks, or the only barcode they share.
 */
export function gtinFromStructuredData(product: unknown, pageUrl: string): string | null {
  if (!isObject(product)) return null;
  const own = ownGtin(product);
  if (own) return own;
  const offers = asList(product.offers).filter(isObject);
  const variants = asList(product.hasVariant).filter(isObject);
  const variantGtin = (v: Json) => ownGtin(v) ?? onlyOne(asList(v.offers).map(ownGtin));
  const wanted = variantOf(pageUrl);
  if (wanted) {
    const offer = offers.find((o) => variantOf(o.url) === wanted);
    if (offer && ownGtin(offer)) return ownGtin(offer);
    const linked = variants.find((v) =>
      [v.url, v["@id"], ...asList(v.offers).map((o) => (isObject(o) ? o.url : null))].some((u) => variantOf(u) === wanted),
    );
    if (linked && variantGtin(linked)) return variantGtin(linked);
  }
  return onlyOne(offers.map(ownGtin)) ?? onlyOne(variants.map(variantGtin));
}

/** The first object in `data`, searching down through it, that `match` accepts. */
function findIn(data: unknown, match: (node: Json) => boolean): Json | null {
  const stack: unknown[] = [data];
  let looked = 0;
  // Store pages carry a few hundred kilobytes of this. Stop well past that.
  while (stack.length > 0 && looked < 200_000) {
    const node = stack.pop();
    looked++;
    if (Array.isArray(node)) {
      for (const child of node) stack.push(child);
    } else if (isObject(node)) {
      if (match(node)) return node;
      for (const child of Object.values(node)) stack.push(child);
    }
  }
  return null;
}

/**
 * The barcode in Target's or Walmart's page data (the `__NEXT_DATA__` script).
 * Neither puts it in structured data. Their page data lists every color or
 * size, each with its own barcode, so this takes the one with the item
 * number in the link.
 */
export function gtinFromStorePageData(data: unknown, pageUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  if (/(^|\.)target\.com$/i.test(url.hostname)) {
    // Target's item number (TCIN) is in the path, as /A-77459747. A color
    // picked on the page can be in `preselect` instead.
    const tcin = url.searchParams.get("preselect") ?? url.pathname.match(/\/A-(\d+)/)?.[1];
    if (!tcin) return null;
    const node = findIn(data, (n) => String(n.tcin) === tcin && isObject(n.item) && "primary_barcode" in n.item);
    return node && isObject(node.item) ? normalizeGtin(node.item.primary_barcode) : null;
  }
  if (/(^|\.)walmart\.com$/i.test(url.hostname)) {
    // Walmart's item number ends the path: /ip/<name>/530466558 or /ip/530466558.
    const id = url.pathname.match(/^\/ip\/(?:[^/]+\/)?(\d+)\/?$/)?.[1];
    if (!id) return null;
    const node = findIn(data, (n) => String(n.usItemId) === id && "upc" in n);
    return node ? normalizeGtin(node.upc) : null;
  }
  return null;
}

/**
 * The barcode in Amazon's product details, from the text of each row, such
 * as "UPC : 819956000350" in a list or "UPC817010024533" from a table row
 * whose cells have no space between them. Amazon puts invisible direction
 * marks around the colon. A row can list several numbers, one per color or
 * size, so this takes a barcode only when the details have just one.
 */
export function gtinFromDetailRows(rows: string[]): string | null {
  const found: (string | null)[] = [];
  for (const row of rows) {
    const text = row.replace(/[\u200e\u200f]/g, " ");
    // The label, then a few characters such as " : ", then one or more numbers.
    for (const match of text.matchAll(/(?<![A-Za-z])(?:UPC|EAN|GTIN)(?![A-Za-z])[^\d]{0,12}((?:\d{8,14}[\s,;]*)+)/g)) {
      for (const code of match[1].trim().split(/[\s,;]+/)) found.push(normalizeGtin(code));
    }
  }
  return onlyOne(found);
}

/** A barcode a dialog read, and the link it read it from. */
export interface ReadGtin {
  url: string;
  gtin: string | null;
}

/**
 * The barcode to send with a form: the one read from `link`, or "" when the
 * form's link isn't the one that was read. A barcode belongs to its link.
 */
export function gtinForLink(read: ReadGtin | null, link: string | null | undefined): string {
  if (!read?.gtin || !link) return "";
  return read.url.trim() === link.trim() ? read.gtin : "";
}

/**
 * The link in a standard form, so the same address written two ways matches:
 * the phone app saves "https://shop.example" as "https://shop.example/".
 */
function standardLink(link: string | null | undefined): string | null {
  const text = link?.trim();
  if (!text) return null;
  try {
    return new URL(text).toString();
  } catch {
    return text;
  }
}

/**
 * What to save in the gtin column when an item or idea is edited. A barcode
 * sent with the form replaces the saved one. Without one, a changed link
 * clears the saved barcode, since it came from the old link, and an
 * unchanged link keeps it.
 */
export function gtinChange(
  sent: unknown,
  savedLink: string | null | undefined,
  newLink: string | null | undefined,
): { gtin: string | null } | Record<string, never> {
  const gtin = normalizeGtin(sent);
  if (gtin) return { gtin };
  return standardLink(savedLink) === standardLink(newLink) ? {} : { gtin: null };
}

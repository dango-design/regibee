// Reads the product on the page the owner is looking at, for the popup's
// "Add to Regibee" form. The popup runs it in the page with
// chrome.scripting.executeScript only after the owner clicks the toolbar
// button, so the extension never reads other pages.
//
// Chrome copies this function into the page by its source text, so it must
// not use anything from outside its own body: no imports, no shared helpers.

export interface ProductPage {
  /** The page's address, exactly as it is, so a store registry link stays one. */
  url: string;
  title: string;
  price: number | null;
  /** Product pictures, best first. */
  images: string[];
  /** False when nothing on the page says it's a product. */
  isProduct: boolean;
  /**
   * The product's barcode number as 14 digits (src/lib/gtin.ts), or null.
   * Missing from versions before it was added.
   */
  gtin?: string | null;
  /**
   * The store's category path from the page's breadcrumbs, most general
   * first, as in ["Clothing, Shoes & Jewelry", "Men", "Shirts"]. Empty when the
   * page has none. It helps guess the item's category
   * (src/lib/item-categories.ts). Missing from versions before it was added.
   */
  storeCategory?: string[];
}

export function readProductPage(): ProductPage {
  const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
  const decode = (text: string) => {
    const area = document.createElement("textarea");
    area.innerHTML = text;
    return area.value;
  };
  const meta = (...names: string[]) => {
    for (const name of names) {
      const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`);
      const content = clean(el?.getAttribute("content"));
      if (content) return content;
    }
    return null;
  };
  const absolute = (raw: unknown) => {
    if (typeof raw !== "string" || !raw.trim() || raw.startsWith("data:")) return null;
    try {
      const url = new URL(raw.trim(), location.href);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  };
  const toPrice = (raw: unknown) => {
    if (raw === null || raw === undefined) return null;
    const match = String(raw).replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
    const value = match ? Number(match[0]) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  // Structured data that most shops add for search engines.
  type Json = Record<string, unknown>;
  let product: Json | null = null;
  const visit = (node: unknown) => {
    if (product || !node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const value = node as Json;
    const types = ([] as unknown[]).concat(value["@type"]);
    if (types.some((t) => typeof t === "string" && /^(Product|ProductGroup|IndividualProduct)$/i.test(t))) {
      product = value;
      return;
    }
    visit(value["@graph"]);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visit(JSON.parse(script.textContent ?? ""));
    } catch {
      // Some shops ship broken JSON. Skip it.
    }
    if (product) break;
  }
  const ld = product as Json | null;
  const ldImages = (raw: unknown): unknown[] =>
    ([] as unknown[]).concat(raw ?? []).map((i) => (typeof i === "string" ? i : (i as Json)?.url ?? (i as Json)?.contentUrl));
  const ldPrice = (raw: unknown): number | null => {
    for (const offer of ([] as unknown[]).concat(raw ?? [])) {
      const o = offer as Json;
      const price = toPrice(o?.price ?? o?.lowPrice ?? (o?.priceSpecification as Json | undefined)?.price);
      if (price) return price;
    }
    return null;
  };
  const variantOffers = Array.isArray(ld?.hasVariant) ? (ld!.hasVariant as Json[])[0]?.offers : undefined;

  // Amazon, Target and Walmart leave the price and most pictures out of their
  // structured data, so read their product blocks.
  let amazonTitle: string | null = null;
  let storePrice: number | null = null;
  const storeImages: string[] = [];
  if (/(^|\.)target\.com$/i.test(location.hostname)) {
    storePrice = toPrice(document.querySelector('[data-test="product-price"]')?.textContent);
    for (const img of document.querySelectorAll<HTMLImageElement>('[data-test^="image-gallery-item-"] img')) {
      storeImages.push(img.currentSrc || img.src);
    }
  }
  if (/(^|\.)walmart\.com$/i.test(location.hostname)) {
    // Walmart sets picture sizes in the query string; without it you get the full picture.
    for (const img of document.querySelectorAll<HTMLImageElement>('[data-testid="hero-image"] img, [data-testid="media-thumbnail"] img')) {
      const src = img.currentSrc || img.src;
      if (src) storeImages.push(src.split("?")[0]);
    }
  }
  if (/(^|\.)amazon\.com$/i.test(location.hostname)) {
    amazonTitle = clean(document.getElementById("productTitle")?.textContent) || null;
    const priceEl = document.querySelector(
      "#corePrice_feature_div .a-price .a-offscreen, #corePriceDisplay_desktop_feature_div .a-price .a-offscreen, #apex_desktop .a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice"
    );
    storePrice = toPrice(priceEl?.textContent);
    const landing = (document.getElementById("landingImage") ?? document.getElementById("imgBlkFront")) as HTMLImageElement | null;
    if (landing) {
      // data-a-dynamic-image maps each size's address to [width, height]. Take the biggest.
      try {
        const sizes = Object.entries(JSON.parse(landing.getAttribute("data-a-dynamic-image") ?? "{}") as Record<string, [number, number]>);
        sizes.sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1]);
        if (sizes[0]) storeImages.push(sizes[0][0]);
      } catch {
        // Fall back to the other attributes.
      }
      const hires = landing.getAttribute("data-old-hires");
      if (hires) storeImages.push(hires);
      if (landing.currentSrc || landing.src) storeImages.push(landing.currentSrc || landing.src);
    }
    // The thumbnails down the side. Dropping the size code ("._AC_US40_") gives the full picture.
    for (const img of document.querySelectorAll<HTMLImageElement>("#altImages img")) {
      if (img.closest(".videoThumbnail, .videoBlockIngress")) continue;
      const src = img.getAttribute("src") ?? "";
      if (/\/images\/I\//.test(src)) storeImages.push(src.replace(/\._[^/]*_\./, "."));
    }
  }

  const titleFromDocument = clean(document.title)
    .replace(/^amazon\.com\s*:\s*/i, "")
    .replace(/\s*[:|–-]\s*(target|walmart\.com|walmart|amazon\.com)\s*$/i, "");
  const title =
    amazonTitle ||
    (typeof ld?.name === "string" ? clean(decode(ld.name)) : "") ||
    meta("og:title", "twitter:title") ||
    clean(document.querySelector("h1")?.textContent) ||
    titleFromDocument;

  const price =
    storePrice ??
    ldPrice(ld?.offers) ??
    ldPrice(variantOffers) ??
    toPrice(meta("product:price:amount", "og:price:amount", "twitter:data1")) ??
    toPrice(
      document.querySelector('[itemprop="price"]')?.getAttribute("content") ??
        document.querySelector('[itemprop="price"]')?.textContent
    );

  const socialImages = [...document.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]')].map(
    (m) => m.getAttribute("content")
  );
  const candidates = [...storeImages, ...ldImages(ld?.image), ...socialImages];
  // A page with no picture data: use its biggest pictures.
  if (candidates.length === 0) {
    const big = [...document.images]
      .filter((img) => img.naturalWidth >= 200 && img.naturalHeight >= 200)
      .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)
      .slice(0, 4);
    candidates.push(...big.map((img) => img.currentSrc || img.src));
  }
  const seen = new Set<string>();
  const images: string[] = [];
  for (const raw of candidates) {
    const url = absolute(raw);
    if (!url) continue;
    // The same picture often comes in several sizes: Amazon puts the size in
    // the file name, other shops in the query string. Keep one of each.
    const parsed = new URL(url);
    const id = url.match(/\/images\/I\/([^._/]+)/)?.[1] ?? `${parsed.hostname}${parsed.pathname}`;
    if (seen.has(id)) continue;
    seen.add(id);
    images.push(url);
    if (images.length >= 8) break;
  }

  const isProduct = Boolean(
    amazonTitle ||
      ld ||
      /product/i.test(meta("og:type") ?? "") ||
      meta("product:price:amount", "og:price:amount") ||
      document.querySelector('[itemtype*="schema.org/Product"]')
  );

  // The barcode number: the UPC on US packaging or the EAN on European
  // packaging. These are the rules in src/lib/gtin.ts, which has the tests.
  // Saved as 14 digits, so a product's UPC and EAN come out the same.
  const toGtin = (raw: unknown): string | null => {
    let text: string;
    if (typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0) text = String(raw);
    else if (typeof raw === "string") text = raw.replace(/[\s-]/g, "");
    else return null;
    if (!/^\d{8,14}$/.test(text)) return null;
    const gtin = text.padStart(14, "0");
    if (/^0+$/.test(gtin)) return null;
    let total = 0;
    for (let i = 0; i < 13; i++) total += Number(gtin[i]) * (i % 2 === 0 ? 3 : 1);
    return (10 - (total % 10)) % 10 === Number(gtin[13]) ? gtin : null;
  };
  const isObject = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : value == null ? [] : [value]);
  const ownGtin = (node: unknown): string | null => {
    if (!isObject(node)) return null;
    for (const key of ["gtin", "gtin14", "gtin13", "gtin12", "gtin8"]) {
      const gtin = toGtin(node[key]);
      if (gtin) return gtin;
    }
    return null;
  };
  const onlyOne = (gtins: (string | null)[]): string | null => {
    const found = [...new Set(gtins.filter((g): g is string => Boolean(g)))];
    return found.length === 1 ? found[0] : null;
  };
  const variantOf = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    try {
      return new URL(raw, location.href).searchParams.get("variant");
    } catch {
      return null;
    }
  };
  // Structured data: on the product, on its offers, or on each color or size.
  const gtinFromStructuredData = (node: Json | null): string | null => {
    if (!node) return null;
    const own = ownGtin(node);
    if (own) return own;
    const offers = asList(node.offers).filter(isObject);
    const variants = asList(node.hasVariant).filter(isObject);
    const variantGtin = (v: Json) => ownGtin(v) ?? onlyOne(asList(v.offers).map(ownGtin));
    const wanted = variantOf(location.href);
    if (wanted) {
      const offer = offers.find((o) => variantOf(o.url) === wanted);
      if (offer && ownGtin(offer)) return ownGtin(offer);
      const linked = variants.find((v) =>
        [v.url, v["@id"], ...asList(v.offers).map((o) => (isObject(o) ? o.url : null))].some((u) => variantOf(u) === wanted)
      );
      if (linked && variantGtin(linked)) return variantGtin(linked);
    }
    return onlyOne(offers.map(ownGtin)) ?? onlyOne(variants.map(variantGtin));
  };
  // Target's and Walmart's page data lists each color or size with its own
  // barcode. Take the one with the item number in the address. A page the
  // store changed without reloading keeps its old data, and then nothing matches.
  const findIn = (data: unknown, match: (node: Json) => boolean): Json | null => {
    const stack: unknown[] = [data];
    let looked = 0;
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
  };
  const gtinFromStorePageData = (): string | null => {
    const raw = document.getElementById("__NEXT_DATA__")?.textContent;
    if (!raw) return null;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
    if (/(^|\.)target\.com$/i.test(location.hostname)) {
      const tcin = new URLSearchParams(location.search).get("preselect") ?? location.pathname.match(/\/A-(\d+)/)?.[1];
      if (!tcin) return null;
      const node = findIn(data, (n) => String(n.tcin) === tcin && isObject(n.item) && "primary_barcode" in n.item);
      return node && isObject(node.item) ? toGtin(node.item.primary_barcode) : null;
    }
    if (/(^|\.)walmart\.com$/i.test(location.hostname)) {
      const id = location.pathname.match(/^\/ip\/(?:[^/]+\/)?(\d+)\/?$/)?.[1];
      if (!id) return null;
      const node = findIn(data, (n) => String(n.usItemId) === id && "upc" in n);
      return node ? toGtin(node.upc) : null;
    }
    return null;
  };
  // Amazon lists it in the product details, when it lists it at all: in a
  // list ("UPC : 819956000350") or, on newer pages, in tables inside
  // #productDetails_expanderTables_depthRightSections. This is
  // gtinFromDetailRows in src/lib/gtin.ts, which has the tests. Each row is
  // read on its own, so a number never runs into the next row's label.
  // Several numbers are for several colors or sizes, so take a single one only.
  const gtinFromAmazonDetails = (): string | null => {
    if (!/(^|\.)amazon\.com$/i.test(location.hostname)) return null;
    const found: (string | null)[] = [];
    const rows = document.querySelectorAll('#detailBullets_feature_div li, [id^="productDetails_"] tr, [id^="productDetails_"] li');
    for (const row of rows) {
      // Amazon puts invisible direction marks around the colon.
      const text = (row.textContent ?? "").replace(/[\u200e\u200f]/g, " ");
      for (const match of text.matchAll(/(?<![A-Za-z])(?:UPC|EAN|GTIN)(?![A-Za-z])[^\d]{0,12}((?:\d{8,14}[\s,;]*)+)/g)) {
        for (const code of match[1].trim().split(/[\s,;]+/)) found.push(toGtin(code));
      }
    }
    return onlyOne(found);
  };
  const gtinFromAttributes = (): string | null =>
    onlyOne(
      [...document.querySelectorAll('[itemprop^="gtin"]')].map((el) => toGtin(el.getAttribute("content") ?? el.textContent))
    );
  let gtin: string | null = null;
  try {
    gtin = gtinFromStorePageData() ?? gtinFromAmazonDetails() ?? gtinFromStructuredData(ld) ?? gtinFromAttributes();
  } catch {
    // A barcode is a bonus. Never lose the rest of the product over it.
  }

  // The store's category path, from its breadcrumbs. The cleanup rules are
  // storeCategoryPath in src/lib/item-categories.ts, which has the tests, and
  // src/lib/product-page.ts reads the same places on the server.
  const categoryPath = (steps: unknown[]): string[] => {
    const lowerTitle = title.toLowerCase();
    const empty = /^(home|homepage|shop|shop all|all|all products|products|store|back|back to results|search|results|categories|departments|see all)$/i;
    const out: string[] = [];
    for (const raw of steps) {
      if (typeof raw !== "string") continue;
      const step = clean(raw);
      if (!step || step.length > 60 || empty.test(step)) continue;
      if (lowerTitle && (step.toLowerCase() === lowerTitle || (lowerTitle.startsWith(step.toLowerCase()) && step.length > 25))) continue;
      if (out[out.length - 1] === step) continue;
      out.push(step);
    }
    return out.slice(-6);
  };
  const readStoreCategory = (): string[] => {
    const texts = (selector: string) => [...document.querySelectorAll(selector)].map((el) => clean(el.textContent));
    const amazon = texts("#wayfinding-breadcrumbs_feature_div li a");
    if (amazon.length > 0) return categoryPath(amazon);
    const lists: unknown[][] = [];
    let productCategory: string | null = null;
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      const value = node as Json;
      const types = ([] as unknown[]).concat(value["@type"]);
      if (types.includes("BreadcrumbList") && Array.isArray(value.itemListElement)) {
        lists.push(
          (value.itemListElement as Json[])
            .slice()
            .sort((a, b) => Number(a?.position ?? 0) - Number(b?.position ?? 0))
            .map((step) => step?.name ?? (step?.item as Json | undefined)?.name)
        );
      }
      if (!productCategory && types.some((t) => typeof t === "string" && /^(Product|ProductGroup|IndividualProduct)$/i.test(t))) {
        if (typeof value.category === "string" && !/^https?:/i.test(value.category)) productCategory = value.category;
      }
      walk(value["@graph"]);
    };
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        walk(JSON.parse(script.textContent ?? ""));
      } catch {
        // Broken JSON. Skip it.
      }
    }
    for (const steps of lists) {
      const path = categoryPath(steps);
      if (path.length > 0) return path;
    }
    if (productCategory) {
      const path = categoryPath((productCategory as string).split(/\s*[>›/|]\s*/));
      if (path.length > 0) return path;
    }
    const marked = texts('[itemtype*="schema.org/BreadcrumbList"] [itemprop="name"]');
    if (marked.length > 0) return categoryPath(marked);
    return categoryPath(texts('nav[aria-label*="breadcrumb" i] a, ol.breadcrumb a, ul.breadcrumb a, .breadcrumbs a'));
  };
  let storeCategory: string[] = [];
  try {
    storeCategory = readStoreCategory();
  } catch {
    // A category is a bonus too.
  }

  return { url: location.href, title: title.slice(0, 300), price, images, isProduct, gtin, storeCategory };
}

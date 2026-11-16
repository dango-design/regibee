// Run with: node --test src/lib/product-page.test.ts
// Node runs TypeScript directly since version 23.6.
//
// What the add-item dialog's autofill reads from a store's page, and which
// addresses the server refuses to fetch. The end-to-end test in
// e2e/add-items.spec.ts covers the dialog itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedAddress, MAX_IMAGE_CANDIDATES, readProductPage } from "./product-page.ts";

const PAGE_URL = "https://shop.example/products/sound-machine?color=white";

function page(head: string, body = ""): string {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

test("a page with Open Graph tags and a JSON-LD product", () => {
  const html = page(
    `<title>Sound Machine | Shop</title>
     <meta property="og:title" content="Hatch Rest Sound Machine">
     <meta property="og:image" content="https://cdn.shop.example/rest-front.jpg">
     ${jsonLd({
       "@context": "https://schema.org",
       "@type": "Product",
       name: "Hatch Rest Sound Machine",
       image: [
         "https://cdn.shop.example/rest-front.jpg",
         { "@type": "ImageObject", url: "https://cdn.shop.example/rest-side.jpg" },
         { "@type": "ImageObject", contentUrl: "/media/rest-box.jpg" },
       ],
       offers: { "@type": "Offer", price: 59.99, priceCurrency: "USD" },
     })}`,
  );
  assert.deepEqual(readProductPage(html, PAGE_URL), {
    title: "Hatch Rest Sound Machine",
    imageUrl: "https://cdn.shop.example/rest-front.jpg",
    // The same picture twice is offered once, and a relative address is
    // made whole from the shop's address.
    imageUrls: [
      "https://cdn.shop.example/rest-front.jpg",
      "https://cdn.shop.example/rest-side.jpg",
      "https://shop.example/media/rest-box.jpg",
    ],
    price: "59.99",
  });
});

test("the page title stands in when there's no og:title", () => {
  const html = page(`<title>Convertible Crib</title><meta property="og:price:amount" content="299">`);
  assert.deepEqual(readProductPage(html, PAGE_URL), { title: "Convertible Crib", imageUrl: undefined, imageUrls: undefined, price: "299.00" });
});

test("a title encoded twice reads as plain text", () => {
  // Some shops put an already encoded name in the tag: &amp;#39; for an apostrophe.
  const html = page(`<meta property="og:title" content="Baby&amp;#39;s First Crib &amp;amp; Mattress">`);
  assert.equal(readProductPage(html, PAGE_URL).title, "Baby's First Crib & Mattress");
});

test("a product inside a JSON-LD @graph, priced as a range", () => {
  const html = page(
    `<title>Stroller</title>
     ${jsonLd({
       "@context": "https://schema.org",
       "@graph": [
         { "@type": "WebPage", name: "Stroller" },
         { "@type": "Product", name: "Stroller", offers: [{ "@type": "AggregateOffer", lowPrice: "449.95" }] },
       ],
     })}`,
  );
  assert.equal(readProductPage(html, PAGE_URL).price, "449.95");
});

test("JSON-LD wins over the meta price, and a broken JSON-LD block is skipped", () => {
  const html = page(
    `<title>High Chair</title>
     <script type="application/ld+json">{ not json</script>
     ${jsonLd({ "@type": "Product", offers: { price: "189.00" } })}
     <meta property="product:price:amount" content="999">`,
  );
  assert.equal(readProductPage(html, PAGE_URL).price, "189.00");
});

test("prices lose their currency sign and thousands commas", () => {
  for (const [shown, expected] of [
    ["$1,299.00", "1299.00"],
    ["USD 24.5", "24.50"],
    ["€ 80", "80.00"],
  ]) {
    const html = page(`<title>Glider</title><meta property="product:price:amount" content="${shown}">`);
    assert.equal(readProductPage(html, PAGE_URL).price, expected, shown);
  }
});

test("a price shown on the page is read when there's no tag for it", () => {
  const html = page(`<title>Baby Monitor</title>`, `<div class="product-price"><span class="price">$129.99</span></div>`);
  assert.equal(readProductPage(html, PAGE_URL).price, "129.99");
  const microdata = page(`<title>Baby Monitor</title>`, `<span itemprop="price" content="99.5"></span>`);
  assert.equal(readProductPage(microdata, PAGE_URL).price, "99.50");
});

test("a zero or unreadable price is left for the owner to fill in", () => {
  for (const shown of ["0", "0.00", "Free", "See price in cart"]) {
    const html = page(`<title>Swaddle Set</title><meta property="product:price:amount" content="${shown}">`);
    assert.equal(readProductPage(html, PAGE_URL).price, undefined, shown);
  }
});

test("SVG icons aren't offered as the item's picture", () => {
  const html = page(
    `<title>Bath Tub</title>
     <meta property="og:image" content="https://cdn.shop.example/logo.svg">
     <meta name="twitter:image" content="https://cdn.shop.example/tub.webp">`,
  );
  assert.deepEqual(readProductPage(html, PAGE_URL).imageUrls, ["https://cdn.shop.example/tub.webp"]);
});

test("gallery pictures from a store's embedded data, after the tagged ones", () => {
  const html = page(
    `<title>Car Seat</title><meta property="og:image" content="https://target.scene7.com/is/image/Target/seat-main">`,
    `<script>window.__DATA__ = {"alternate_images":[{"url":"https://target.scene7.com/is/image/Target/seat-side"},"https://cdn.shop.example/seat-back.png","https://cdn.shop.example/not-a-picture"]};</script>
     <img data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/seat-zoom.jpg&quot;:[1500,1500]}">`,
  );
  assert.deepEqual(readProductPage(html, PAGE_URL).imageUrls, [
    "https://target.scene7.com/is/image/Target/seat-main",
    "https://target.scene7.com/is/image/Target/seat-side",
    "https://cdn.shop.example/seat-back.png",
    "https://m.media-amazon.com/images/I/seat-zoom.jpg",
  ]);
});

test("at most 12 pictures are offered", () => {
  const tags = Array.from({ length: 20 }, (_, i) => `<meta property="og:image" content="https://cdn.shop.example/${i}.jpg">`);
  const result = readProductPage(page(`<title>Play Mat</title>${tags.join("")}`), PAGE_URL);
  assert.equal(result.imageUrls?.length, MAX_IMAGE_CANDIDATES);
  assert.equal(result.imageUrl, "https://cdn.shop.example/0.jpg");
});

test("a bot check page is an error, not a product called 'Robot Check'", () => {
  const html = page(`<title>Robot Check</title>`, `<p>Enter the characters you see below. captcha</p>`);
  assert.match(readProductPage(html, PAGE_URL).error ?? "", /blocked automatic fetching/);
});

test("a store's own name isn't taken as the product's", () => {
  // Long enough not to count as a bot check, with only the store's name in it.
  const html = page(`<title>Amazon.com</title>`, `<p>${"Lorem ipsum dolor sit amet. ".repeat(400)}</p>`);
  assert.match(readProductPage(html, PAGE_URL).error ?? "", /Couldn't extract product details/);
});

test("a page with nothing to read is an error", () => {
  assert.match(readProductPage(page(""), PAGE_URL).error ?? "", /Couldn't extract product details/);
});

test("the server won't fetch private, loopback or cloud metadata addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "64:ff9b::a00:1",
    "localhost",
    "",
  ]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
});

test("the server fetches public addresses", () => {
  for (const address of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::6810:85e5", "2001:4860:4860::8888"]) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

// The product reader's barcode number on Amazon product pages. Amazon lists
// it, when it does, in the product details: a table row on newer pages, a
// list item on older ones. These are small made-up pages in those two
// layouts, so they run on any computer. Saved copies of real pages go
// through product.spec.ts. The rules themselves are unit-tested as
// gtinFromDetailRows in src/lib/gtin.test.ts.

import { readProductPage } from "../src/product-reader";
import { expect, test } from "./extension";

function amazonPage(details: string): string {
  return `<!doctype html>
<html>
  <head><title>Amazon.com: Water Bottle Organizer</title></head>
  <body>
    <span id="productTitle">Water Bottle Organizer, Adjustable Cabinet Rack</span>
    ${details}
  </body>
</html>`;
}

// The layout of a real page checked on November 19, 2026: two-column
// tables, with the barcode in the right-hand one.
const TABLES = (upc: string) => `
  <div id="prodDetails">
    <div id="productDetails_expanderTables_depthLeftSections">
      <table class="a-keyvalue prodDetTable"><tbody>
        <tr><th class="prodDetSectionEntry">Material</th><td class="prodDetAttrValue">Plastic</td></tr>
      </tbody></table>
    </div>
    <div id="productDetails_expanderTables_depthRightSections">
      <table class="a-keyvalue prodDetTable"><tbody>
        <tr><th class="prodDetSectionEntry">Item model number</th><td class="prodDetAttrValue">&lrm;UPSPACE12</td></tr>
        <tr><th class="prodDetSectionEntry">UPC</th><td class="prodDetAttrValue">&lrm;${upc}</td></tr>
        <tr><th class="prodDetSectionEntry">Best Sellers Rank</th><td class="prodDetAttrValue">#1,234 in Kitchen</td></tr>
      </tbody></table>
    </div>
  </div>`;

// The older list layout, with direction marks around the colon.
const BULLETS = (upc: string) => `
  <div id="detailBullets_feature_div"><ul>
    <li><span><span class="a-text-bold">ASIN &rlm; : &lrm;</span><span>B0TEST0001</span></span></li>
    <li><span><span class="a-text-bold">UPC &rlm; : &lrm;</span><span>${upc}</span></span></li>
  </ul></div>`;

const cases = [
  { name: "a UPC in the newer details tables", details: TABLES("817010024533"), gtin: "00817010024533" },
  { name: "a UPC in the older details list", details: BULLETS("819956000350"), gtin: "00819956000350" },
  { name: "nothing when the details list a barcode per color", details: TABLES("819956000350 819956003504"), gtin: null },
  { name: "nothing when the details list no barcode", details: TABLES("").replace(/<tr><th[^>]*>UPC<\/th>.*?<\/tr>/, ""), gtin: null },
];

test.describe.configure({ mode: "parallel" });

for (const [index, page] of cases.entries()) {
  test(`reads ${page.name}`, async ({ context }) => {
    const url = `https://www.amazon.com/dp/B0TEST000${index + 1}`;
    await context.route(
      (u) => u.href === url,
      (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: amazonPage(page.details) })
    );
    const tab = await context.newPage();
    await tab.goto(url);
    // Chrome copies the reader into the page by its source text, as the popup does.
    const product = await tab.evaluate(readProductPage);
    expect(product.title).toBe("Water Bottle Organizer, Adjustable Cabinet Rack");
    expect(product.gtin).toBe(page.gtin);
  });
}

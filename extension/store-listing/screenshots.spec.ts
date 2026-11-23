// Takes the popup screenshots for the Chrome Web Store listing. It runs the
// built extension the same way the tests do (extension/test/extension.ts),
// on made-up store pages with a made-up account, so no real registry shows.
// compose.mjs then puts each one on a 1280×800 store image. See README.md
// in this folder.

import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { storeItemKey } from "../../src/lib/retailers";
import { connect, expect, tabIdFor, test } from "../test/extension";

/** compose.mjs reads the screenshots from here. */
const RAW_DIR = path.join(os.tmpdir(), "regibee-store-listing");

// The product pictures are the site's own drawings.
const DRAWINGS = path.resolve(__dirname, "../../public/hero");
const drawing = (name: string) => readFileSync(path.join(DRAWINGS, `${name}.svg`));

const REGISTRY = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Ada's baby registry",
  storeRegistries: [],
  categories: [
    { id: "00000000-0000-4000-8000-0000000000c1", name: "Nursery" },
    { id: "00000000-0000-4000-8000-0000000000c2", name: "Feeding" },
    { id: "00000000-0000-4000-8000-0000000000c3", name: "Clothes" },
  ],
};

const PRODUCT_URL = "https://www.target.com/p/plush-panda/-/A-12345678";
const PANDA = "https://target.scene7.com/is/image/Target/plush-panda";
const PRODUCT_PAGE = `<!doctype html><html><head><title>Plush Panda : Target</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Plush Panda, 12 in","image":["${PANDA}"],"offers":{"@type":"Offer","price":"19.99","priceCurrency":"USD"}}</script>
</head><body><h1>Plush Panda, 12 in</h1><img src="${PANDA}" width="400" height="400"></body></html>`;

const REGISTRY_URL = "https://www.walmart.com/registry/BR/sample-registry";
const ITEMS = [
  { id: "111111111", name: "Plush Panda, 12 in", price: "19.99", drawing: "panda" },
  { id: "222222222", name: "Anti-Colic Baby Bottles, 3 Pack", price: "24.97", drawing: "bottle" },
  { id: "333333333", name: "Knit Baby Hat with Bow", price: "12.48", drawing: "bib" },
  { id: "444444444", name: "Newborn Socks, 6 Pairs", price: "9.88", drawing: "socks" },
  { id: "555555555", name: "Silicone Spoon and Fork Set", price: "11.99", drawing: "spoon-and-fork" },
];
const itemUrl = (id: string) => `https://www.walmart.com/ip/seort/${id}?listRegistryId=sample&listRegistryType=BR`;
const pictureUrl = (name: string) => `https://i5.walmartimages.com/seo/${name}.png`;
const REGISTRY_PAGE = `<!doctype html><html><head><title>Baby Registry | Walmart.com</title></head><body>
<h1>Ada's Baby Registry</h1><ul>
${ITEMS.map(
  (item) => `<li><a href="${itemUrl(item.id)}"><img src="${pictureUrl(item.drawing)}" alt="${item.name}" width="160" height="160"></a>
  <a href="${itemUrl(item.id)}">${item.name}</a><div>$${item.price}</div><div>Requested 1</div></li>`
).join("\n")}
</ul></body></html>`;

/** Answers the made-up pages' picture requests with the drawings. */
async function servePictures(context: BrowserContext) {
  await context.route(
    (url) => url.href === PANDA || url.hostname === "i5.walmartimages.com",
    (route) => {
      const url = route.request().url();
      const name = url === PANDA ? "panda" : path.basename(new URL(url).pathname, ".png");
      return route.fulfill({ contentType: "image/svg+xml", body: drawing(name) });
    }
  );
}

async function openTab(context: BrowserContext, url: string, html: string) {
  await context.route(
    (u) => u.href === url,
    (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: html })
  );
  const tab = await context.newPage();
  await tab.goto(url);
  return tab;
}

/** Opens the popup for a tab, drawn at twice its size so the store images are sharp. */
async function openPopup(context: BrowserContext, extensionId: string, tabId: number) {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 760, height: 1200 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await popup.addStyleTag({ content: "html { zoom: 2; }" });
  return popup;
}

async function shoot(popup: Page, name: string) {
  await mkdir(RAW_DIR, { recursive: true });
  await popup.waitForTimeout(600);
  await popup.locator("body").screenshot({ path: path.join(RAW_DIR, `${name}.png`) });
}

test("product form", async ({ context, worker, extensionId }) => {
  await connect(context, worker, { registries: [REGISTRY], ideaRecipients: ["Mom", "Sam"] });
  await servePictures(context);
  await openTab(context, PRODUCT_URL, PRODUCT_PAGE);
  const popup = await openPopup(context, extensionId, await tabIdFor(worker, PRODUCT_URL));
  await expect(popup.locator("#title")).toHaveValue("Plush Panda, 12 in");
  await popup.locator("#category").selectOption({ label: "Nursery" });
  await shoot(popup, "product");
});

test("gift idea", async ({ context, worker, extensionId }) => {
  await connect(context, worker, { registries: [REGISTRY], ideaRecipients: ["Mom", "Sam", "Grandpa"] });
  await servePictures(context);
  await openTab(context, PRODUCT_URL, PRODUCT_PAGE);
  const popup = await openPopup(context, extensionId, await tabIdFor(worker, PRODUCT_URL));
  await expect(popup.locator("#title")).toHaveValue("Plush Panda, 12 in");
  await popup.getByLabel("Add to").selectOption({ label: "Gift ideas" });
  await popup.getByRole("button", { name: "Sam" }).click();
  await popup.locator("#idea-notes").fill("For the new baby. Loves pandas.");
  await shoot(popup, "idea");
});

test("registry page", async ({ context, worker, extensionId }) => {
  // The first item is on Regibee already.
  await connect(context, worker, {
    registries: [REGISTRY],
    existing: (urls) => urls.slice(0, 1).map((url) => storeItemKey(url)!),
  });
  await servePictures(context);
  await openTab(context, REGISTRY_URL, REGISTRY_PAGE);
  const tabId = await tabIdFor(worker, REGISTRY_URL);
  await expect
    .poll(() => worker.evaluate((tabId) => chrome.action.getBadgeText({ tabId }), tabId), { timeout: 15_000 })
    .toBe("4");
  const popup = await openPopup(context, extensionId, tabId);
  await expect(popup.getByRole("button", { name: "Add 4 items to Regibee" })).toBeVisible();
  await shoot(popup, "registry");
});

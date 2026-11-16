// Adding an item from a product link: the add-item dialog asks the server to
// read the store's page and fills in the name, price and picture.
//
// The "store" is a small server this file runs on 127.0.0.1. The site's
// server normally refuses to fetch addresses on its own machine; the test
// server is allowed to read these pages because e2e/playwright.config.ts sets
// SCRAPE_ALLOW_LOCAL_TEST_PAGES. What the reader finds on many kinds of real
// store pages is unit-tested in src/lib/product-page.test.ts.

import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createRegistryWithItem, db, signIn } from "./fixtures";

// A 1×1 PNG, the product's picture.
const PICTURE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let shop: http.Server;
let shopUrl = "";

test.beforeAll(async () => {
  shop = http.createServer((request, response) => {
    if (request.url === "/products/hatch-rest-sound-machine") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
<html>
  <head>
    <title>Hatch Rest Sound Machine | Test Shop</title>
    <meta property="og:title" content="Hatch Rest Sound Machine">
    <meta property="og:image" content="${shopUrl}/images/rest.png">
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Hatch Rest Sound Machine","offers":{"@type":"Offer","price":"59.99","priceCurrency":"USD"}}
    </script>
  </head>
  <body><h1>Hatch Rest Sound Machine</h1></body>
</html>`);
    } else if (request.url === "/images/rest.png") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(PICTURE);
    } else {
      // Like a store that turns away servers.
      response.writeHead(403, { "content-type": "text/plain" });
      response.end("Forbidden");
    }
  });
  await new Promise<void>((resolve) => shop.listen(0, "127.0.0.1", resolve));
  shopUrl = `http://127.0.0.1:${(shop.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => shop.close(resolve));
});

/**
 * Pastes the link and taps Fetch. Leaving the link field starts reading the
 * page too, and this test store answers so fast that the tap can read it a
 * second time. The second read keeps what the first filled in, so the tests
 * check the fields and the saved item, not which status message came last.
 */
async function fetchFromLink(dialog: Locator, link: string) {
  await dialog.getByLabel("Product link").fill(link);
  await dialog.getByRole("button", { name: "Fetch" }).click();
}

async function openAddItem(page: Page) {
  const { owner, registry } = await createRegistryWithItem();
  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}`);
  await page.getByRole("button", { name: "Add Item" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Add item to registry" })).toBeVisible();
  return { registry, dialog };
}

test("a product link fills in the item's name, price and picture", async ({ page }) => {
  const { registry, dialog } = await openAddItem(page);
  const link = `${shopUrl}/products/hatch-rest-sound-machine`;

  await fetchFromLink(dialog, link);
  await expect(dialog.getByLabel("Item Name")).toHaveValue("Hatch Rest Sound Machine");
  await expect(dialog.getByLabel("Price (optional)")).toHaveValue("59.99");
  // The picture it found, chosen for the item.
  await expect(dialog.getByLabel("Image link (optional)")).toHaveValue(`${shopUrl}/images/rest.png`);

  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("img", { name: "Hatch Rest Sound Machine" })).toBeVisible();

  const { data: item } = await db
    .from("registry_items")
    .select("external_url, image_url, price")
    .eq("registry_id", registry.id)
    .eq("title", "Hatch Rest Sound Machine")
    .single();
  expect(item).toEqual({ external_url: link, image_url: `${shopUrl}/images/rest.png`, price: 59.99 });
});

test("a store that won't let the server in still leaves the link and a name from it", async ({ page }) => {
  const { registry, dialog } = await openAddItem(page);
  const link = `${shopUrl}/products/organic-cotton-swaddle-set`;

  await fetchFromLink(dialog, link);
  await expect(dialog.getByRole("status")).toContainText("We couldn't read the details from this link");
  await expect(dialog.getByLabel("Item Name")).toHaveValue(/organic cotton swaddle set/i);

  await dialog.getByLabel("Price (optional)").fill("24");
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog).toBeHidden();

  const { data: item } = await db
    .from("registry_items")
    .select("title, external_url, price")
    .eq("registry_id", registry.id)
    .eq("external_url", link)
    .single();
  expect(item?.title).toMatch(/organic cotton swaddle set/i);
  expect(item?.price).toBe(24);
});

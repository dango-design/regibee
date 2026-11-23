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
import { createRegistryWithItem, db, signIn, waitForReact } from "./fixtures";

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
      {"@context":"https://schema.org","@type":"Product","name":"Hatch Rest Sound Machine","gtin12":"012345678905","offers":{"@type":"Offer","price":"59.99","priceCurrency":"USD"}}
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
  const addItem = page.getByRole("button", { name: "Add Item" }).first();
  await waitForReact(addItem);
  await addItem.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Add an item" })).toBeVisible();
  return { registry, dialog };
}

test("a product link fills in the item's name, price and picture, and saves its barcode", async ({ page }) => {
  const { registry, dialog } = await openAddItem(page);
  const link = `${shopUrl}/products/hatch-rest-sound-machine`;

  await fetchFromLink(dialog, link);
  await expect(dialog.getByLabel("Item name")).toHaveValue("Hatch Rest Sound Machine");
  await expect(dialog.getByLabel("Price (optional)")).toHaveValue("59.99");
  // The picture it found, chosen for the item.
  await expect(dialog.getByLabel("Image link (optional)")).toHaveValue(`${shopUrl}/images/rest.png`);

  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("img", { name: "Hatch Rest Sound Machine" })).toBeVisible();

  const { data: item } = await db
    .from("registry_items")
    .select("external_url, image_url, price, gtin")
    .eq("registry_id", registry.id)
    .eq("title", "Hatch Rest Sound Machine")
    .single();
  // The page's barcode number is saved as 14 digits (src/lib/gtin.ts).
  expect(item).toEqual({ external_url: link, image_url: `${shopUrl}/images/rest.png`, price: 59.99, gtin: "00012345678905" });
});

test("an item's barcode stays only while it keeps the link it came from", async ({ page }) => {
  const { owner, registry, item } = await createRegistryWithItem();
  // The item was added from the sound machine's page, which has a barcode.
  const BARCODE = "00012345678905";
  await db
    .from("registry_items")
    .update({ external_url: `${shopUrl}/products/hatch-rest-sound-machine`, gtin: BARCODE })
    .eq("id", item.id);
  const gtinNow = async () =>
    (await db.from("registry_items").select("gtin").eq("id", item.id).single()).data?.gtin as string | null;

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}`);
  const card = page.getByRole("heading", { name: item.title });
  await waitForReact(card);

  // Changing something else keeps it.
  await card.click();
  let dialog = page.getByRole("dialog", { name: "Edit item" });
  await dialog.getByLabel("Price (optional)").fill("64.99");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  expect(await gtinNow()).toBe(BARCODE);

  // A link to another product drops it. That store won't let the server
  // read its page, so there's no new barcode to take its place.
  await card.click();
  dialog = page.getByRole("dialog", { name: "Edit item" });
  // A filled-in item shows its link on one line until the owner changes it.
  await dialog.getByRole("button", { name: "Change link" }).click();
  await dialog.getByLabel("Product link").fill(`${shopUrl}/products/organic-cotton-swaddle-set`);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  expect(await gtinNow()).toBeNull();
});

test("a new link replaces an item's name, price and picture, and each one can be undone", async ({ page }) => {
  const { owner, registry, item } = await createRegistryWithItem();
  // An item already filled in from another page.
  await db
    .from("registry_items")
    .update({ external_url: `${shopUrl}/products/old-sound-machine`, price: 45 })
    .eq("id", item.id);

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}`);
  const card = page.getByRole("heading", { name: item.title });
  await waitForReact(card);
  await card.click();
  const dialog = page.getByRole("dialog", { name: "Edit item" });

  // Its link sits on one line until the owner changes it.
  await expect(dialog.getByLabel("Product link")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Change link" }).click();
  await fetchFromLink(dialog, `${shopUrl}/products/hatch-rest-sound-machine`);

  // The new page's details replace the old ones, and the link steps back.
  await expect(dialog.getByLabel("Item name")).toHaveValue("Hatch Rest Sound Machine");
  await expect(dialog.getByLabel("Price (optional)")).toHaveValue("59.99");
  await expect(dialog.getByText("Was $45.00")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Change link" })).toBeVisible();

  // The owner keeps their own name.
  await dialog.locator("p", { hasText: `Was “${item.title}”` }).getByRole("button", { name: "Undo" }).click();
  await expect(dialog.getByLabel("Item name")).toHaveValue(item.title);

  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  const { data: saved } = await db
    .from("registry_items")
    .select("title, price, image_url, external_url")
    .eq("id", item.id)
    .single();
  expect(saved).toEqual({
    title: item.title,
    price: 59.99,
    image_url: `${shopUrl}/images/rest.png`,
    external_url: `${shopUrl}/products/hatch-rest-sound-machine`,
  });
});

test("a store that won't let the server in still leaves the link and a name from it", async ({ page }) => {
  const { registry, dialog } = await openAddItem(page);
  const link = `${shopUrl}/products/organic-cotton-swaddle-set`;

  await fetchFromLink(dialog, link);
  await expect(dialog.getByRole("status")).toContainText("We couldn't read the details from 127.0.0.1");
  await expect(dialog.getByLabel("Item name")).toHaveValue(/organic cotton swaddle set/i);

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

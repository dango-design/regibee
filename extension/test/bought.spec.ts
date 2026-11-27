// "Mark as bought by parent" on the product form: the item is saved as one
// the owner bought, and a list with a zip code adds estimated sales tax to
// its price, as the site's add-item dialog does. These use a small made-up
// product page, not a saved one, so they run on any computer.

import type { BrowserContext, Worker } from "@playwright/test";
import type { ExtensionRegistry, ProductItem } from "../../src/lib/extension";
import { connect, expect, REGISTRY, tabIdFor, test } from "./extension";

const PRODUCT_URL = "https://www.target.com/p/snuggle-bundle/-/A-23456789";
const PRODUCT_PAGE = `<!doctype html>
<html>
  <head>
    <title>Snuggle Bundle : Target</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Snuggle Bundle",
       "image":["https://target.scene7.com/is/image/Target/product"],
       "offers":{"@type":"Offer","price":"20.00","priceCurrency":"USD"}}
    </script>
  </head>
  <body><h1>Snuggle Bundle</h1></body>
</html>`;

const LABEL = "Mark as bought by parent";
const WITH_TAX: ExtensionRegistry = { ...REGISTRY, boughtLabel: LABEL, addsTax: true };
const NO_ZIP: ExtensionRegistry = { ...REGISTRY, boughtLabel: LABEL, addsTax: false };

test.describe.configure({ mode: "parallel" });

async function openForm(context: BrowserContext, worker: Worker, extensionId: string) {
  await context.route(
    (url) => url.href === PRODUCT_URL,
    (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: PRODUCT_PAGE })
  );
  const tab = await context.newPage();
  await tab.goto(PRODUCT_URL);
  const tabId = await tabIdFor(worker, PRODUCT_URL);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await expect(popup.locator("#title")).toHaveValue("Snuggle Bundle");
  return popup;
}

const addedItem = (calls: { path: string; body: unknown }[]) => {
  const adds = calls.filter((call) => call.path === "/api/extension/product");
  expect(adds).toHaveLength(1);
  return (adds[0].body as { item: ProductItem }).item;
};

test("marks the item as bought and adds sales tax to its price", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker, { registries: [WITH_TAX] });
  const popup = await openForm(context, worker, extensionId);
  const price = popup.getByLabel("Price");
  await expect(price).toHaveValue("20.00");

  await popup.getByLabel(LABEL).check();
  await expect(price).toHaveValue("22.00");
  await expect(popup.getByText("$20.00 + ~10.0% tax")).toBeVisible();

  // Unticking takes the tax off again.
  await popup.getByLabel(LABEL).uncheck();
  await expect(price).toHaveValue("20.00");
  await expect(popup.getByText("% tax")).toBeHidden();

  // A typed price gets tax when the owner leaves the field.
  await popup.getByLabel(LABEL).check();
  await expect(price).toHaveValue("22.00");
  await price.fill("30");
  await price.blur();
  await expect(price).toHaveValue("33.00");
  await expect(popup.getByText("$30.00 + ~10.0% tax")).toBeVisible();

  await popup.getByRole("button", { name: "Add to Regibee" }).click();
  await expect(popup.getByRole("heading", { name: "Added to Regibee" })).toBeVisible();
  const item = addedItem(calls);
  expect(item.isParentPurchased).toBe(true);
  expect(item.price).toBe(33);
});

test("a list with no zip code keeps the store's price", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker, { registries: [NO_ZIP] });
  const popup = await openForm(context, worker, extensionId);

  await popup.getByLabel(LABEL).check();
  await popup.getByRole("button", { name: "Add to Regibee" }).click();
  await expect(popup.getByRole("heading", { name: "Added to Regibee" })).toBeVisible();
  const item = addedItem(calls);
  expect(item.isParentPurchased).toBe(true);
  expect(item.price).toBe(20);
  expect(calls.filter((call) => call.path === "/api/extension/tax")).toHaveLength(0);
});

test("adding right after ticking still saves the price with tax", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker, { registries: [WITH_TAX] });
  const popup = await openForm(context, worker, extensionId);

  await popup.getByLabel(LABEL).check();
  await popup.getByRole("button", { name: "Add to Regibee" }).click();
  await expect(popup.getByRole("heading", { name: "Added to Regibee" })).toBeVisible();
  expect(addedItem(calls).price).toBe(22);
});

test("an older server, which can't save the mark, gets no checkbox", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker);
  const popup = await openForm(context, worker, extensionId);

  await expect(popup.getByLabel("Most wanted")).toBeVisible();
  await expect(popup.locator("#bought")).toBeHidden();
  await popup.getByRole("button", { name: "Add to Regibee" }).click();
  await expect(popup.getByRole("heading", { name: "Added to Regibee" })).toBeVisible();
  expect(addedItem(calls).isParentPurchased).toBe(false);
});

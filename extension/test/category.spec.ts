// "+ New category" on the product form: it makes a category on the
// registry, picks it and adds the product to it, as the site's add-item
// dialog does. These use a small made-up product page, not a saved one, so
// they run on any computer. It's served at a Target address, since the
// extension may only read pages at the stores it knows.

import type { BrowserContext } from "@playwright/test";
import type { ExtensionRegistry } from "../../src/lib/extension";
import { connect, expect, NEW_CATEGORY_ID, REGISTRY, tabIdFor, test } from "./extension";

const PRODUCT_URL = "https://www.target.com/p/hooded-towel/-/A-23456789";
const PRODUCT_PAGE = `<!doctype html>
<html>
  <head>
    <title>Hooded Towel : Target</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Hooded Towel",
       "image":["https://target.scene7.com/is/image/Target/hooded-towel"],
       "offers":{"@type":"Offer","price":"14.99","priceCurrency":"USD"}}
    </script>
  </head>
  <body><h1>Hooded Towel</h1></body>
</html>`;

const FEEDING = { id: "00000000-0000-4000-8000-0000000000f1", name: "Feeding" };
const WITH_CATEGORY: ExtensionRegistry = { ...REGISTRY, categories: [FEEDING] };

test.describe.configure({ mode: "parallel" });

async function openForm(context: BrowserContext, worker: import("@playwright/test").Worker, extensionId: string) {
  await context.route(
    (url) => url.href === PRODUCT_URL,
    (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: PRODUCT_PAGE })
  );
  const tab = await context.newPage();
  await tab.goto(PRODUCT_URL);
  const tabId = await tabIdFor(worker, PRODUCT_URL);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await expect(popup.locator("#title")).toHaveValue("Hooded Towel");
  return { popup, tabId };
}

test("makes a new category and adds the product to it", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker, { registries: [WITH_CATEGORY] });
  const { popup, tabId } = await openForm(context, worker, extensionId);

  const category = popup.getByLabel("Category", { exact: true });
  await expect(category.locator("option")).toHaveText(["No category", "Feeding"]);

  // Cancel goes back to the picker.
  await popup.getByRole("button", { name: "+ New category" }).click();
  await expect(category).toBeHidden();
  await expect(popup.getByLabel("New category")).toBeFocused();
  await popup.getByRole("button", { name: "Cancel" }).click();
  await expect(category).toBeVisible();

  await popup.getByRole("button", { name: "+ New category" }).click();
  const add = popup.getByRole("button", { name: "Add", exact: true });
  await expect(add).toBeDisabled();
  await popup.getByLabel("New category").fill("  Bath   time ");
  await add.click();

  // It's made on the registry, then picked.
  await expect(category).toBeVisible();
  await expect(category.locator("option")).toHaveText(["No category", "Feeding", "Bath time"]);
  await expect(category).toHaveValue(NEW_CATEGORY_ID);
  const made = calls.filter((call) => call.path === "/api/extension/categories");
  expect(made).toHaveLength(1);
  expect(made[0].body).toEqual({ registryId: REGISTRY.id, name: "Bath time" });

  await popup.getByRole("button", { name: "Add to Regibee" }).click();
  await expect(popup.getByRole("heading", { name: "Added to Regibee" })).toBeVisible();
  const adds = calls.filter((call) => call.path === "/api/extension/product");
  expect(adds).toHaveLength(1);
  expect((adds[0].body as { item: { categoryId: string } }).item.categoryId).toBe(NEW_CATEGORY_ID);

  // The popup offers it next time without asking Regibee for the lists again.
  const again = await context.newPage();
  await again.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await expect(again.getByLabel("Category", { exact: true }).locator("option")).toHaveText([
    "No category",
    "Feeding",
    "Bath time",
  ]);
  expect(calls.filter((call) => call.path === "/api/extension/me")).toHaveLength(1);
});

test("a new category typed but not added yet still gets the product", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker, { registries: [WITH_CATEGORY] });
  const { popup } = await openForm(context, worker, extensionId);

  await popup.getByRole("button", { name: "+ New category" }).click();
  await popup.getByLabel("New category").fill("Bath");
  await popup.getByRole("button", { name: "Add to Regibee" }).click();

  await expect(popup.getByRole("heading", { name: "Added to Regibee" })).toBeVisible();
  expect(calls.filter((call) => call.path === "/api/extension/categories")).toHaveLength(1);
  const adds = calls.filter((call) => call.path === "/api/extension/product");
  expect(adds).toHaveLength(1);
  expect((adds[0].body as { item: { categoryId: string } }).item.categoryId).toBe(NEW_CATEGORY_ID);
});

test("a name the registry already has picks that category", async ({ context, worker, extensionId }) => {
  await connect(context, worker, { registries: [WITH_CATEGORY] });
  const { popup } = await openForm(context, worker, extensionId);

  await popup.getByRole("button", { name: "+ New category" }).click();
  await popup.getByLabel("New category").fill("feeding");
  await popup.getByLabel("New category").press("Enter");

  const category = popup.getByLabel("Category", { exact: true });
  await expect(category).toHaveValue(FEEDING.id);
  await expect(category.locator("option")).toHaveText(["No category", "Feeding"]);
});

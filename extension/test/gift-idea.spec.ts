// Saving a product as a gift idea for someone else from the popup. These use
// a small made-up product page, not a saved one, so they run on any computer.
// It's served at a Target address, since the extension may only read pages at
// the stores it knows.

import { chooseOption, connect, expect, expectOptions, tabIdFor, test } from "./extension";

const PRODUCT_URL = "https://www.target.com/p/wool-scarf/-/A-12345678";
const PICTURE = "https://target.scene7.com/is/image/Target/wool-scarf";
const PRODUCT_PAGE = `<!doctype html>
<html>
  <head>
    <title>Wool Scarf : Target</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Wool Scarf","image":["${PICTURE}"],
       "offers":{"@type":"Offer","price":"24.99","priceCurrency":"USD"}}
    </script>
  </head>
  <body>
    <h1>Wool Scarf</h1>
    <!-- Target's page data has a barcode for each color. The link's item number picks this one. -->
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"product":{"children":[
        {"tcin":"87654321","item":{"primary_barcode":"036000291452"}},
        {"tcin":"12345678","item":{"primary_barcode":"012345678905"}}
      ]}}}
    </script>
  </body>
</html>`;

test.describe.configure({ mode: "parallel" });

async function openProduct(context: import("@playwright/test").BrowserContext) {
  await context.route(
    (url) => url.href === PRODUCT_URL,
    (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: PRODUCT_PAGE })
  );
  const tab = await context.newPage();
  await tab.goto(PRODUCT_URL);
  return tab;
}

test("saves the product as a gift idea for someone", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker, { ideaRecipients: ["Mom", "Sam"] });
  await openProduct(context);
  const tabId = await tabIdFor(worker, PRODUCT_URL);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await expect(popup.locator("#title")).toHaveValue("Wool Scarf");

  // It opens on adding to a registry. The gift idea fields are hidden.
  await expect(popup.getByRole("button", { name: "Add to Regibee" })).toBeVisible();
  await expect(popup.locator("#recipient")).toBeHidden();

  // Gift ideas is one more choice in the "Add to" picker, after the registries.
  const addTo = popup.getByLabel("Add to");
  await expectOptions(addTo, ["Remi & Max", "Gift ideas"]);
  await chooseOption(addTo, "Gift ideas");
  await expect(popup.getByText("Only you can see gift ideas.")).toBeVisible();
  await expect(popup.locator("#quantity")).toBeHidden();
  await expect(popup.locator("#category")).toBeHidden();
  await expect(popup.getByRole("button", { name: "Add to Regibee" })).toBeHidden();

  // Picking the registry again brings its fields back.
  await chooseOption(addTo, "Remi & Max");
  await expect(popup.getByRole("button", { name: "Add to Regibee" })).toBeVisible();
  await expect(popup.locator("#recipient")).toBeHidden();
  await chooseOption(addTo, "Gift ideas");

  // Names already used are one click away. Clicking the chosen one again takes it off.
  await popup.getByRole("button", { name: "Mom" }).click();
  await expect(popup.locator("#recipient")).toHaveValue("Mom");
  await expect(popup.getByRole("button", { name: "Mom" })).toHaveAttribute("aria-pressed", "true");
  await popup.getByRole("button", { name: "Mom" }).click();
  await expect(popup.locator("#recipient")).toHaveValue("");
  await expect(popup.getByRole("button", { name: "Mom" })).toHaveAttribute("aria-pressed", "false");
  await popup.getByRole("button", { name: "Mom" }).click();
  await popup.locator("#idea-notes").fill("She liked the green one.");
  await popup.getByRole("button", { name: "Save gift idea" }).click();

  await expect(popup.getByRole("heading", { name: "Saved for Mom" })).toBeVisible();
  const saves = calls.filter((call) => call.path === "/api/extension/ideas");
  expect(saves).toHaveLength(1);
  expect(saves[0].body).toEqual({
    idea: {
      recipient: "Mom",
      title: "Wool Scarf",
      url: PRODUCT_URL,
      imageUrl: PICTURE,
      price: 24.99,
      notes: "She liked the green one.",
      // The barcode number, as 14 digits (src/lib/gtin.ts).
      gtin: "00012345678905",
    },
  });
  // Nothing went on the registry.
  expect(calls.filter((call) => call.path === "/api/extension/product")).toEqual([]);

  // The popup opens on Gift ideas next time, with Mom offered first.
  const again = await context.newPage();
  await again.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await expect(again.getByLabel("Add to")).toHaveAttribute("data-value", "ideas");
  await expect(again.getByRole("button", { name: "Save gift idea" })).toBeVisible();
  await expect(again.locator(".chip").first()).toHaveText("Mom");
});

test("a gift idea can be saved without saying who it's for", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker, { registries: [], ideaRecipients: ["Mom"] });
  await openProduct(context);
  const tabId = await tabIdFor(worker, PRODUCT_URL);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await expect(popup.locator("#title")).toHaveValue("Wool Scarf");
  await expect(popup.getByLabel("Who's it for? (optional)")).toHaveValue("");

  await popup.getByRole("button", { name: "Save gift idea" }).click();
  await expect(popup.getByRole("heading", { name: "Saved as a gift idea" })).toBeVisible();
  const saves = calls.filter((call) => call.path === "/api/extension/ideas");
  expect(saves).toHaveLength(1);
  expect((saves[0].body as { idea: { recipient: string } }).idea.recipient).toBe("");

  // No empty name joins the ones offered next time.
  const again = await context.newPage();
  await again.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await expect(again.locator(".chip")).toHaveText(["Mom"]);
});

test("someone with no registry can still save a gift idea", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker, { registries: [] });
  await openProduct(context);
  const tabId = await tabIdFor(worker, PRODUCT_URL);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await expect(popup.locator("#title")).toHaveValue("Wool Scarf");
  // There's no registry to add it to, so Gift ideas is the only choice.
  await expectOptions(popup.getByLabel("Add to"), ["Gift ideas"]);
  await expect(popup.getByRole("button", { name: "Add to Regibee" })).toBeHidden();

  await popup.locator("#recipient").fill("  My   brother ");
  await popup.getByRole("button", { name: "Save gift idea" }).click();
  await expect(popup.getByRole("heading", { name: "Saved for My brother" })).toBeVisible();
  expect(calls.filter((call) => call.path === "/api/extension/ideas")).toHaveLength(1);
});

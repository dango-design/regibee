// Filling in items' details later: items added while a store blocked
// Regibee's server (Amazon, from an iPad) have no photo or price. On a computer
// with the browser extension, the list's page reads their links again, fills
// them in, and shows a review where an old value can be put back.
//
// The extension isn't in these tests. A small script stands in for its
// content script: it answers the page's hello, and answers each read with a
// product, the way the extension does after reading the page in a background
// tab (src/lib/fetch-product.ts). What the real reader finds on store pages is
// tested with the extension (npm run test:extension).

import { expect, test, type Page } from "@playwright/test";
import { createRegistryWithItem, db, signIn } from "./fixtures";

const LINK = (id: string) => `https://www.amazon.com/dp/${id}`;
const PHOTO = "https://m.media-amazon.com/images/I/e2e-photo.jpg";
const FULL_NAME = "Hatch Rest Baby Sound Machine, Night Light & Time-to-Rise";

/** What the stand-in extension "reads" from each link. Null: it couldn't. */
const PRODUCTS: Record<string, unknown> = {
  [LINK("B0E2ETEST1")]: { title: FULL_NAME, price: 59.99, images: [PHOTO], gtin: "012345678905" },
  [LINK("B0E2ETEST2")]: { title: "Halo Sleepsack Swaddle", price: 24.99, images: [PHOTO], gtin: null },
  [LINK("B0E2ETEST3")]: { title: "Dr. Brown's Bottle Brush", price: 7.49, images: [PHOTO], gtin: null },
  [LINK("B0E2ETEST4")]: null,
};

async function standInForExtension(page: Page) {
  await page.addInitScript((products: Record<string, unknown>) => {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (event.source !== window || !data || data.source !== "regibee-page") return;
      const answer = (message: Record<string, unknown>) =>
        setTimeout(() => window.postMessage({ source: "regibee-extension", ...message }, location.origin), 50);
      if (data.type === "hello") answer({ type: "ready", version: "9.9.9", features: ["read-product"] });
      if (data.type === "read-product") answer({ type: "product", id: data.id, product: products[data.url] ?? null });
    });
  }, PRODUCTS);
}

test("the list page fills in missing details and lets the owner put an old value back", async ({ page }) => {
  const { owner, registry, item } = await createRegistryWithItem();

  // Added from an iPad: a name guessed from the link, no photo, no price.
  const { error: guessError } = await db
    .from("registry_items")
    .update({ title: "Hatch Rest Sound Machine", external_url: LINK("B0E2ETEST1"), price: null, image_url: null })
    .eq("id", item.id);
  if (guessError) throw guessError;
  const { data: others, error: insertError } = await db
    .from("registry_items")
    .insert([
      // The owner typed a price; the store has a different one.
      { registry_id: registry.id, title: "Halo Sleepsack Swaddle", external_url: LINK("B0E2ETEST2"), price: 20 },
      // Only blanks to fill.
      { registry_id: registry.id, title: "Dr. Brown's Bottle Brush", external_url: LINK("B0E2ETEST3") },
      // The extension can't read this one.
      { registry_id: registry.id, title: "Burp Cloths", external_url: LINK("B0E2ETEST4") },
    ])
    .select("id, title");
  if (insertError) throw insertError;
  const ids = [item.id, ...others.map((o) => o.id)];

  await standInForExtension(page);
  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}`);

  await expect(page.getByText("4 items are missing a photo or price")).toBeVisible();
  await page.getByRole("button", { name: "Fill them in" }).click();

  const review = page.getByRole("region", { name: "Filled in details for 3 items" });
  await expect(review).toBeVisible();
  await expect(page.getByText("1 item couldn't be read.")).toBeVisible();
  // The one that couldn't be read is still offered.
  await expect(page.getByText("1 item is missing a photo or price")).toBeVisible();

  // The two items that had something else before are compared, new and old.
  await expect(review.getByText("Hatch Rest Sound Machine", { exact: true })).toBeVisible();
  await expect(review.getByText(FULL_NAME, { exact: true })).toBeVisible();
  await expect(review.getByText("$20.00")).toBeVisible();
  await expect(review.getByText("$24.99")).toBeVisible();
  // The one that only had blanks is folded away.
  await expect(review.getByText("See what was filled in on 1 more item")).toBeVisible();

  const { data: filled } = await db
    .from("registry_items")
    .select("id, title, price, image_url, gtin")
    .in("id", ids)
    .order("title");
  expect(filled).toEqual(
    expect.arrayContaining([
      { id: ids[0], title: FULL_NAME, price: 59.99, image_url: PHOTO, gtin: "00012345678905" },
      { id: ids[1], title: "Halo Sleepsack Swaddle", price: 24.99, image_url: PHOTO, gtin: null },
      { id: ids[2], title: "Dr. Brown's Bottle Brush", price: 7.49, image_url: PHOTO, gtin: null },
      { id: ids[3], title: "Burp Cloths", price: null, image_url: null, gtin: null },
    ]),
  );

  // Put back the name the owner had.
  // Each choice is a row: its radio button is hidden inside its label, so click the row.
  await review.getByRole("group", { name: `Name of ${FULL_NAME}` }).locator("label", { hasText: /^Old/ }).click();
  await expect
    .poll(async () => (await db.from("registry_items").select("title").eq("id", ids[0]).single()).data?.title)
    .toBe("Hatch Rest Sound Machine");
  const names = review.getByRole("group", { name: "Name of Hatch Rest Sound Machine" });
  await expect(names.getByRole("radio", { name: /^Old name/ })).toBeChecked();
  await expect(names.getByRole("radio", { name: /^New name/ })).not.toBeChecked();

  // The swaddle's price replaced the one the owner typed: stop checking it.
  const stopChecks = review.getByRole("checkbox", { name: "Don't check this price again, for Halo Sleepsack Swaddle" });
  // Its input is hidden inside its label, so click the label.
  await stopChecks.locator("xpath=ancestor::label[1]").click();
  await expect(stopChecks).toBeChecked();
  await expect
    .poll(async () => (await db.from("item_detail_reads").select("price_checks_off_url").eq("item_id", ids[1]).single()).data?.price_checks_off_url)
    .toBe(LINK("B0E2ETEST2"));
  // A price that only filled an empty one has no such box.
  await expect(review.getByRole("checkbox")).toHaveCount(1);

  await review.getByRole("button", { name: "Done" }).click();
  await expect(review).toBeHidden();
  const { data: reads } = await db.from("item_detail_reads").select("item_id, reviewed_at").in("item_id", ids);
  expect(reads?.map((r) => r.item_id).sort()).toEqual(ids.slice(0, 3).sort());
  expect(reads?.every((r) => r.reviewed_at)).toBe(true);

  // Nothing to review after a reload, and only the unread item is offered.
  await page.reload();
  await expect(page.getByText("1 item is missing a photo or price")).toBeVisible();
  await expect(page.getByRole("region", { name: /Filled in details/ })).toHaveCount(0);

  // The swaddle's edit dialog shows its checks are off, and turns them back on.
  await page.getByRole("heading", { name: "Halo Sleepsack Swaddle" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit item" });
  const weekly = dialog.getByRole("checkbox", { name: "Check the store's price weekly" });
  await expect(weekly).not.toBeChecked();
  await weekly.locator("xpath=ancestor::label[1]").click();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  const { data: after } = await db.from("item_detail_reads").select("price_checks_off_url").eq("item_id", ids[1]).single();
  expect(after?.price_checks_off_url).toBeNull();
});

// An owner's own registry: making it with the full form, finding it on the
// dashboard, and adding, changing and removing items by hand.
// e2e/add-items.spec.ts covers filling an item in from a product link.

import { expect, test } from "@playwright/test";
import {
  createAccount,
  createRegistryWithItem,
  createWishlist,
  db,
  reserveGift,
  signIn,
  uniqueEmail,
  uniqueId,
  waitForReact,
} from "./fixtures";

test("an owner makes a baby registry, sees it on the dashboard, and adds, changes and removes an item", async ({ page, browser }) => {
  const owner = await createAccount("Remi Owner");
  await signIn(page, owner);

  // The full form, as the New page's "Baby registry" opens it.
  await page.goto("/dashboard/registry/new?type=baby");
  await waitForReact(page.locator("form"));
  await expect(page.getByRole("button", { name: /What's it for/ })).toContainText("A baby");
  const title = `Remi & Max's Registry ${uniqueId()}`;
  const nameField = page.getByLabel("Registry name");
  await expect(async () => {
    if (!(await nameField.isVisible())) await page.getByRole("button", { name: /Name and date/ }).click();
    await expect(nameField).toBeVisible({ timeout: 1000 });
  }).toPass();
  await nameField.fill(title);
  await page.getByRole("button", { name: "Create registry" }).click();
  await page.waitForURL(/\/dashboard\/registry\/[0-9a-f-]{36}$/);
  const registryId = page.url().split("/dashboard/registry/")[1];
  const { data: registry } = await db
    .from("registries")
    .select("owner_id, title, registry_type, is_public, is_private, slug")
    .eq("id", registryId)
    .single();
  // Anyone with the link can open it, the default: neither public nor private.
  expect(registry).toMatchObject({ owner_id: owner.id, title, registry_type: "baby", is_public: false, is_private: false });

  // The dashboard lists it. A join Supabase couldn't resolve once left this
  // page saying "No registries yet" (CLAUDE.md, "Database changes").
  await page.goto("/dashboard");
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByRole("heading", { name: "No registries yet" })).toHaveCount(0);
  await page.getByText(title).click();
  await page.waitForURL(`**/dashboard/registry/${registryId}`);

  // An item added by hand.
  const addItem = page.getByRole("button", { name: "Add Item" }).first();
  await waitForReact(addItem);
  await addItem.click();
  const addDialog = page.getByRole("dialog");
  await expect(addDialog.getByRole("heading", { name: "Add an item" })).toBeVisible();
  await addDialog.getByLabel("Item name").fill("Convertible Crib");
  await addDialog.getByLabel("Price (optional)").fill("299");
  await addDialog.getByRole("button", { name: "Add item" }).click();
  await expect(addDialog).toBeHidden();
  await expect(page.getByText("Convertible Crib")).toBeVisible();
  const { data: added } = await db
    .from("registry_items")
    .select("id, title, price, quantity_needed")
    .eq("registry_id", registryId)
    .single();
  expect(added).toMatchObject({ title: "Convertible Crib", price: 299, quantity_needed: 1 });

  // Guests see it on the registry's page.
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(`/r/${registry!.slug}`);
  await expect(guestPage.getByText("Convertible Crib")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "Gift this" })).toBeVisible();

  // The owner changes its name and price.
  await page.getByText("Convertible Crib").click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog.getByRole("heading", { name: "Edit item" })).toBeVisible();
  await editDialog.getByLabel("Item name").fill("Convertible Crib, Natural");
  await editDialog.getByLabel("Price (optional)").fill("349.50");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(editDialog).toBeHidden();
  await expect(page.getByText("Convertible Crib, Natural")).toBeVisible();
  const { data: changed } = await db.from("registry_items").select("title, price").eq("id", added!.id).single();
  expect(changed).toEqual({ title: "Convertible Crib, Natural", price: 349.5 });
  await guestPage.reload();
  await expect(guestPage.getByText("Convertible Crib, Natural")).toBeVisible();

  // And removes it. It's on no other list, so it's deleted.
  await page.getByText("Convertible Crib, Natural").click();
  page.once("dialog", (confirm) => {
    expect(confirm.message()).toBe(`Delete "Convertible Crib, Natural"? This cannot be undone.`);
    void confirm.accept();
  });
  await editDialog.getByRole("button", { name: "Remove item" }).filter({ visible: true }).click();
  await expect(editDialog).toBeHidden();
  await expect(page.getByText("Convertible Crib, Natural")).toHaveCount(0);
  const { count } = await db.from("registry_items").select("id", { count: "exact", head: true }).eq("id", added!.id);
  expect(count).toBe(0);
  await guestPage.reload();
  await expect(guestPage.getByText("Convertible Crib, Natural")).toHaveCount(0);
  await guest.close();
});

test("taking an item off its home list moves it, and its gift, to the other list it's on", async ({ page }) => {
  const { owner, registry: home, item } = await createRegistryWithItem();
  const { registry: other } = await createWishlist(owner.id);
  const { error } = await db.from("registry_item_placements").insert({ item_id: item.id, registry_id: other.id });
  if (error) throw error;

  // A guest reserves it from the home list.
  const guestEmail = uniqueEmail("guest");
  const guest = await page.context().browser()!.newContext();
  await reserveGift(await guest.newPage(), { slug: home.slug, name: "Glinda Guest", email: guestEmail });
  await guest.close();

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${home.id}`);
  await page.getByText(item.title).click();
  const dialog = page.getByRole("dialog");
  page.once("dialog", (confirm) => {
    expect(confirm.message()).toContain(`Remove "${item.title}" from this list? It stays on`);
    expect(confirm.message()).toContain(other.title);
    void confirm.accept();
  });
  await dialog.getByRole("button", { name: "Remove from list" }).filter({ visible: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(item.title)).toHaveCount(0);

  // The other list is now its home, and the guest's gift came with it.
  const { data: moved } = await db.from("registry_items").select("registry_id").eq("id", item.id).single();
  expect(moved?.registry_id).toBe(other.id);
  const { count: placements } = await db
    .from("registry_item_placements")
    .select("item_id", { count: "exact", head: true })
    .eq("item_id", item.id);
  expect(placements).toBe(0);
  const { data: gifts } = await db.from("purchases").select("buyer_email, status").eq("registry_item_id", item.id);
  expect(gifts).toEqual([{ buyer_email: guestEmail, status: "reserved" }]);
  await page.goto(`/dashboard/registry/${other.id}`);
  await expect(page.getByText(item.title)).toBeVisible();

  // On its last list, removing it deletes it.
  await page.getByText(item.title).click();
  page.once("dialog", (confirm) => void confirm.accept());
  await dialog.getByRole("button", { name: "Remove item" }).filter({ visible: true }).click();
  await expect(dialog).toBeHidden();
  const { count } = await db.from("registry_items").select("id", { count: "exact", head: true }).eq("id", item.id);
  expect(count).toBe(0);
});

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
  // By name: the open More actions menu is a dialog too.
  const editDialog = page.getByRole("dialog", { name: "Edit item" });
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
  await editDialog.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Remove item" }).click();
  const confirmDelete = page.getByRole("dialog", { name: `Delete "Convertible Crib, Natural"?` });
  await expect(confirmDelete).toContainText("This cannot be undone.");
  await confirmDelete.getByRole("button", { name: "Delete item" }).click();
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
  // A click before React takes over the page does nothing.
  const onHome = page.getByText(item.title);
  await waitForReact(onHome);
  await onHome.click();
  const dialog = page.getByRole("dialog", { name: "Edit item" });
  await dialog.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Remove from list" }).click();
  const confirmRemove = page.getByRole("dialog", { name: `Remove "${item.title}" from this list?` });
  await expect(confirmRemove).toContainText(`It stays on`);
  await expect(confirmRemove).toContainText(other.title);
  await confirmRemove.getByRole("button", { name: "Remove from list" }).click();
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
  const onOther = page.getByText(item.title);
  await expect(onOther).toBeVisible();

  // On its last list, removing it deletes it.
  await waitForReact(onOther);
  await onOther.click();
  await dialog.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Remove item" }).click();
  await page.getByRole("dialog", { name: `Delete "${item.title}"?` }).getByRole("button", { name: "Delete item" }).click();
  await expect(dialog).toBeHidden();
  const { count } = await db.from("registry_items").select("id", { count: "exact", head: true }).eq("id", item.id);
  expect(count).toBe(0);
});

test("an owner adds an item to another list from its menu, then moves it there with its gift", async ({ page }) => {
  const { owner, registry: home, item } = await createRegistryWithItem();
  const { registry: other } = await createWishlist(owner.id);

  // A guest reserves it from the home list.
  const guestEmail = uniqueEmail("guest");
  const guest = await page.context().browser()!.newContext();
  await reserveGift(await guest.newPage(), { slug: home.slug, name: "Glinda Guest", email: guestEmail });
  await guest.close();

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${home.id}`);
  const onHome = page.getByRole("heading", { name: item.title });
  await waitForReact(onHome);
  await onHome.click();
  const dialog = page.getByRole("dialog", { name: "Edit item" });

  // Add to another list keeps the dialog open and says where it went.
  await dialog.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Add to another list" }).click();
  await page.getByRole("menuitem", { name: other.title }).click();
  await expect(dialog.getByText(`Added to ${other.title}.`)).toBeVisible();
  await expect(dialog.getByText(`It's also on ${other.title}`)).toBeVisible();
  const placement = () =>
    db.from("registry_item_placements").select("registry_id").eq("item_id", item.id).then(({ data }) => data);
  expect(await placement()).toEqual([{ registry_id: other.id }]);

  // It's on every other list now, so the menu only offers to take it off this one.
  await dialog.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Remove from list" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Add to another list" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // A second item, on the home list only, moves to the other list.
  const { data: second, error } = await db
    .from("registry_items")
    .insert({ registry_id: home.id, title: `Night Light ${home.id.slice(0, 8)}`, price: 20, quantity_needed: 1 })
    .select("id, title")
    .single();
  if (error) throw error;
  await page.reload();
  const secondCard = page.getByRole("heading", { name: second.title });
  await waitForReact(secondCard);
  await secondCard.click();
  await dialog.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Move to another list" }).click();
  await page.getByRole("menuitem", { name: other.title }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: second.title })).toHaveCount(0);
  const { data: moved } = await db.from("registry_items").select("registry_id").eq("id", second.id).single();
  expect(moved?.registry_id).toBe(other.id);

  // The first item is still one item, with the guest's gift on it.
  const { data: gifts } = await db.from("purchases").select("buyer_email, status").eq("registry_item_id", item.id);
  expect(gifts).toEqual([{ buyer_email: guestEmail, status: "reserved" }]);
  await page.goto(`/dashboard/registry/${other.id}`);
  await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: second.title })).toBeVisible();
});

// Deleting a registry from its Settings page. One with items asks its owner
// to type a sentence first. A brand-new one asks with the buttons alone
// (src/lib/delete-confirmation.ts).

import { expect, test } from "@playwright/test";
import { createRegistryWithItem, db, signIn } from "./fixtures";

async function registryExists(id: string) {
  const { count } = await db.from("registries").select("id", { count: "exact", head: true }).eq("id", id);
  return count === 1;
}

test("a registry with an item is deleted only after its owner types the sentence", async ({ page }) => {
  const { owner, registry } = await createRegistryWithItem();

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}/settings`);
  await page.getByRole("button", { name: "Delete registry" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Delete this registry?" })).toBeVisible();
  // It says what goes before anything does.
  await expect(dialog.getByText("1 item is deleted.")).toBeVisible();

  const deleteButton = dialog.getByRole("button", { name: "Delete registry" });
  const field = dialog.getByLabel("Type “I want to delete this registry” to confirm");
  await expect(deleteButton).toBeDisabled();
  await field.fill("delete");
  await expect(deleteButton).toBeDisabled();
  await field.fill("I want to delete this registry");
  await deleteButton.click();
  await page.waitForURL((url) => url.pathname === "/dashboard");

  expect(await registryExists(registry.id)).toBe(false);
});

test("a registry with nothing on it is deleted without typing", async ({ page }) => {
  const { owner, registry, item } = await createRegistryWithItem();
  const { error } = await db.from("registry_items").delete().eq("id", item.id);
  if (error) throw error;

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}/settings`);
  await page.getByRole("button", { name: "Delete registry" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("The registry's link stops working.")).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Delete registry" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard");

  expect(await registryExists(registry.id)).toBe(false);
});

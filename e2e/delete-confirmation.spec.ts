// Deleting a registry from its Settings page. One with items asks its owner
// to type a sentence first. A brand-new one asks with the buttons alone
// (src/lib/delete-confirmation.ts).

import { expect, test, type Page } from "@playwright/test";
import { createRegistryWithItem, db, signIn, waitForReact } from "./fixtures";

/** Opens the registry's Settings page and clicks Delete registry. */
async function openDeleteDialog(page: Page, registryId: string) {
  await page.goto(`/dashboard/registry/${registryId}/settings`);
  // A click before React takes over the page does nothing.
  const deleteRegistry = page.getByRole("button", { name: "Delete registry" });
  await waitForReact(deleteRegistry);
  await deleteRegistry.click();
}

async function registryExists(id: string) {
  const { count } = await db.from("registries").select("id", { count: "exact", head: true }).eq("id", id);
  return count === 1;
}

test("a registry with an item is deleted only after its owner types the sentence", async ({ page }) => {
  const { owner, registry } = await createRegistryWithItem();

  await signIn(page, owner);
  await openDeleteDialog(page, registry.id);
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
  await openDeleteDialog(page, registry.id);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("The registry's link stops working.")).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Delete registry" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard");

  expect(await registryExists(registry.id)).toBe(false);
});

// Deleting an account from the Account page. The app stores require it, and
// it can't be undone, so this checks exactly what goes and what stays
// (src/lib/account-deletion.ts).

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createAccount,
  createRegistryWithItem,
  createWishlist,
  db,
  reserveGift,
  signIn,
  uniqueEmail,
} from "./fixtures";
import { localSupabase } from "./local-supabase";

test("deleting an account removes its own lists and guests' gifts, and hands a shared list to its co-manager", async ({ page, browser }) => {
  // A registry of their own, with a guest's gift on it.
  const { owner, registry: own, item } = await createRegistryWithItem();
  const guest = await browser.newContext();
  await reserveGift(await guest.newPage(), { slug: own.slug, name: "Glinda Guest", email: uniqueEmail("guest") });
  await guest.close();
  const { data: gift } = await db.from("purchases").select("id").eq("registry_item_id", item.id).single();
  // And a wishlist someone else helps manage.
  const { registry: shared } = await createWishlist(owner.id);
  const casey = await createAccount("Casey Comanager");
  const { error } = await db.from("registry_managers").insert({ registry_id: shared.id, user_id: casey.id, role: "manager" });
  if (error) throw error;

  await signIn(page, owner);
  await page.goto("/dashboard/account");
  await page.getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
  // It says what will happen before anything does.
  await expect(
    dialog.getByText(`“${own.title}” is deleted, with its items and gift funds, including the gift a guest reserved or gave.`),
  ).toBeVisible();
  await expect(
    dialog.getByText(`“${shared.title}” stays for the people who help manage it. Casey Comanager becomes its owner.`),
  ).toBeVisible();
  // The account has registries, so the button waits for the sentence.
  const deleteButton = dialog.getByRole("button", { name: "Delete account" });
  await expect(deleteButton).toBeDisabled();
  await dialog.getByLabel("Type “I want to delete my account” to confirm").fill("i want to delete my account");
  await deleteButton.click();
  await page.waitForURL((url) => url.pathname === "/");

  // The account, its registry, the item and the guest's gift are gone.
  const { data: user } = await db.auth.admin.getUserById(owner.id);
  expect(user.user).toBeNull();
  const { count: registries } = await db.from("registries").select("id", { count: "exact", head: true }).eq("id", own.id);
  expect(registries).toBe(0);
  const { count: items } = await db.from("registry_items").select("id", { count: "exact", head: true }).eq("id", item.id);
  expect(items).toBe(0);
  // The guest's gift goes too, with their name and email.
  const { count: gifts } = await db.from("purchases").select("id", { count: "exact", head: true }).eq("id", gift!.id);
  expect(gifts).toBe(0);

  // The shared wishlist stays, now Casey's.
  const { data: kept } = await db.from("registries").select("owner_id").eq("id", shared.id).single();
  expect(kept?.owner_id).toBe(casey.id);
  const { data: managers } = await db.from("registry_managers").select("user_id, role").eq("registry_id", shared.id);
  expect(managers).toEqual([{ user_id: casey.id, role: "owner" }]);

  // They can't sign in again.
  const anon = createClient(localSupabase().apiUrl, localSupabase().anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await anon.auth.signInWithPassword({ email: owner.email, password: owner.password });
  expect(signInError?.message).toBe("Invalid login credentials");
});

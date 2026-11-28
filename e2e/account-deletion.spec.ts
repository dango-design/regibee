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
  waitForReact,
} from "./fixtures";
import { localSupabase } from "./local-supabase";
import { waitForEmail } from "./mailbox";

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
  // A click before React takes over the page does nothing.
  const deleteAccount = page.getByRole("button", { name: "Delete account" });
  await waitForReact(deleteAccount);
  await deleteAccount.click();
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

test("deleting an account calls off the group gifts it organized and emails who chipped in", async ({ page }) => {
  const maya = await createAccount("Maya Owner");
  const oz = await createAccount("Oz Organizer");
  const { registry, item } = await createWishlist(maya.id);

  // A group gift Oz started, as src/lib/actions/group-gifts.ts starts one: a
  // reservation in his name, and someone chipping in. The action holds it for
  // a year, which the reserve function itself doesn't allow.
  const guest = createClient(localSupabase().apiUrl, localSupabase().anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: anonError } = await guest.auth.signInAnonymously();
  if (anonError) throw anonError;
  const { data: reservationId, error: reserveError } = await guest.rpc("reserve_registry_item", {
    p_item_id: item.id,
    p_buyer_name: "Oz and others",
    p_buyer_email: oz.email,
    p_message: null,
    p_hold_days: 30,
  });
  if (reserveError) throw reserveError;
  const token = crypto.randomUUID().replace(/-/g, "");
  const { data: groupGift, error: giftError } = await db
    .from("group_gifts")
    .insert({ token, registry_id: registry.id, item_id: item.id, purchase_id: reservationId, organizer_id: oz.id })
    .select("id")
    .single();
  if (giftError) throw giftError;
  const pledgerEmail = uniqueEmail("scarecrow");
  const { error: pledgeError } = await db.from("group_gift_pledges").insert({
    group_gift_id: groupGift.id,
    token: crypto.randomUUID().replace(/-/g, ""),
    name: "Scarecrow",
    email: pledgerEmail,
    amount: 10,
  });
  if (pledgeError) throw pledgeError;

  // Oz has nothing of his own, so two buttons are enough.
  await signIn(page, oz);
  await page.goto("/dashboard/account");
  const open = page.getByRole("button", { name: "Delete account" });
  await waitForReact(open);
  await open.click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  // The item is open to gifts again, not held for a year (#149).
  await expect
    .poll(async () => (await db.from("purchases").select("status").eq("id", reservationId).single()).data?.status)
    .not.toBe("reserved");
  const { data: itemRow } = await db.from("registry_items").select("quantity_fulfilled").eq("id", item.id).single();
  expect(itemRow?.quantity_fulfilled).toBe(0);

  // Scarecrow hears it's called off, and why.
  const email = await waitForEmail(pledgerEmail, `The group gift of "${item.title}" was called off`);
  expect(email.html).toContain("Oz Organizer deleted their Regibee account");
});

// Guests' gifts go with the item or gift fund they were for
// (20261116012811_delete_gifts_with_items.sql). Before, deleting an item, a
// fund or a list left the guests' names, emails and messages in purchases,
// pointing at nothing. The website deletes items with the service-role
// client. The phone app and the extension delete them with the owner's own
// session, as these tests do after the first.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createAccount, createWishlist, db, reserveGift, signIn, uniqueEmail, waitForReact } from "./fixtures";
import { linkIn, waitForEmail } from "./mailbox";
import { localSupabase } from "./local-supabase";

function anonClient(): SupabaseClient {
  const { apiUrl, anonKey } = localSupabase();
  return createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function asGuest() {
  const client = anonClient();
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

async function asAccount(account: { email: string; password: string }) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword(account);
  if (error) throw error;
  return client;
}

/** Reserves an item as a guest with no account, as the registry page does. Returns the gift's id. */
async function reserve(itemId: string, name: string) {
  const guest = await asGuest();
  const { data, error } = await guest.rpc("reserve_registry_item", {
    p_item_id: itemId,
    p_buyer_name: name,
    p_buyer_email: uniqueEmail(name.toLowerCase()),
    p_message: "Congratulations!",
    p_hold_days: 2,
  });
  if (error) throw error;
  return data as string;
}

/**
 * A group gift on the item, as src/lib/actions/group-gifts.ts starts one: a
 * reservation in the organizer's name, and someone chipping in.
 */
async function addGroupGift(registryId: string, itemId: string, organizerId: string) {
  const reservationId = await reserve(itemId, "Oz and others");
  const token = randomUUID().replace(/-/g, "");
  const { data: groupGift, error } = await db
    .from("group_gifts")
    .insert({ token, registry_id: registryId, item_id: itemId, purchase_id: reservationId, organizer_id: organizerId })
    .select("id")
    .single();
  if (error) throw error;
  const { error: pledgeError } = await db.from("group_gift_pledges").insert({
    group_gift_id: groupGift.id,
    token: randomUUID().replace(/-/g, ""),
    name: "Scarecrow",
    email: uniqueEmail("scarecrow"),
    amount: 10,
  });
  if (pledgeError) throw pledgeError;
  return { id: groupGift.id as string, token, reservationId };
}

async function groupGiftRow(id: string) {
  const { data, error } = await db.from("group_gifts").select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function giftRow(purchaseId: string) {
  const { data, error } = await db
    .from("purchases")
    .select("id, registry_item_id, buyer_name")
    .eq("id", purchaseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

test("an owner removes an item a guest reserved, and the guest's gift goes with it", async ({ page, browser }) => {
  const maya = await createAccount("Maya Owner");
  const { registry, item } = await createWishlist(maya.id);

  const guestEmail = uniqueEmail("glinda");
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await reserveGift(guestPage, { slug: registry.slug, name: "Glinda Guest", email: guestEmail });
  const reserved = await waitForEmail(guestEmail, `You reserved "${item.title}". It's held for 2 days`);
  const { data: gift } = await db.from("purchases").select("id").eq("registry_item_id", item.id).single();
  expect(gift).not.toBeNull();

  // Maya takes it off her list on the website.
  await signIn(page, maya);
  await page.goto(`/dashboard/registry/${registry.id}`);
  const card = page.getByRole("heading", { name: item.title });
  await waitForReact(card);
  await card.click();
  const dialog = page.getByRole("dialog", { name: "Edit item" });
  await dialog.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Remove item" }).click();
  const confirm = page.getByRole("dialog", { name: `Delete "${item.title}"?` });
  await expect(confirm).toContainText("This cannot be undone.");
  await confirm.getByRole("button", { name: "Delete item" }).click();
  await expect(dialog).toBeHidden();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole("heading", { name: item.title })).toHaveCount(0);

  // The item and Glinda's name, email and message are gone.
  const { data: itemRow } = await db.from("registry_items").select("id").eq("id", item.id).maybeSingle();
  expect(itemRow).toBeNull();
  expect(await giftRow(gift!.id)).toBeNull();

  // Glinda hears her reservation went with it, with a link back to the list.
  const removed = await waitForEmail(guestEmail, new RegExp(`^"${item.title}" was taken off `));
  expect(removed.html).toContain("You don't need to buy it.");
  expect(linkIn(removed, /\/r\//)).toContain(`/r/${registry.slug}`);

  // The link in Glinda's email still opens the list, without the gift.
  await guestPage.goto(linkIn(reserved, /\/gift\/[0-9a-f-]+\?step=confirm$/));
  await guestPage.waitForURL(new RegExp(`/r/${registry.slug}$`));
  await expect(guestPage.getByRole("dialog")).toHaveCount(0);
  await guestContext.close();
});

test("an item that moves to another list keeps its gifts, and one that goes loses them", async () => {
  const maya = await createAccount("Maya Owner");
  const { item } = await createWishlist(maya.id);
  const { registry: christmas } = await createWishlist(maya.id);
  const { error } = await db
    .from("registry_item_placements")
    .insert({ item_id: item.id, registry_id: christmas.id, added_by: maya.id });
  if (error) throw error;
  const giftId = await reserve(item.id, "Glinda");

  // Deleted from its home list the way the phone app does it, it moves to
  // the other list, with its gift.
  const app = await asAccount(maya);
  const first = await app.from("registry_items").delete().eq("id", item.id);
  expect(first.error).toBeNull();
  const { data: moved } = await db.from("registry_items").select("registry_id").eq("id", item.id).single();
  expect(moved?.registry_id).toBe(christmas.id);
  expect(await giftRow(giftId)).toMatchObject({ registry_item_id: item.id, buyer_name: "Glinda" });

  // On no other list, it's deleted, and so is the gift.
  const second = await app.from("registry_items").delete().eq("id", item.id);
  expect(second.error).toBeNull();
  const { data: gone } = await db.from("registry_items").select("id").eq("id", item.id).maybeSingle();
  expect(gone).toBeNull();
  expect(await giftRow(giftId)).toBeNull();
});

test("deleting a gift fund or a whole list deletes the gifts on it, group gifts' too", async () => {
  const maya = await createAccount("Maya Owner");
  const oz = await createAccount("Oz Organizer");
  const { registry, item } = await createWishlist(maya.id);
  const { data: lamp, error: lampError } = await db
    .from("registry_items")
    .insert({ registry_id: registry.id, title: "Reading lamp", price: 30, quantity_needed: 1 })
    .select("id")
    .single();
  if (lampError) throw lampError;
  const groupGift = await addGroupGift(registry.id, lamp.id, oz.id);
  const { data: fund, error: fundError } = await db
    .from("cash_funds")
    .insert({ registry_id: registry.id, title: "Ski trip" })
    .select("id")
    .single();
  if (fundError) throw fundError;

  const guest = await asGuest();
  const { data: fundGiftId, error: fundGiftError } = await guest.rpc("reserve_cash_fund", {
    p_fund_id: fund.id,
    p_buyer_name: "Ozma",
    p_amount: 25,
    p_buyer_email: uniqueEmail("ozma"),
  });
  if (fundGiftError) throw fundGiftError;
  const itemGiftId = await reserve(item.id, "Glinda");

  const app = await asAccount(maya);
  expect((await app.from("cash_funds").delete().eq("id", fund.id)).error).toBeNull();
  expect(await giftRow(fundGiftId as string)).toBeNull();
  expect(await giftRow(itemGiftId)).not.toBeNull();

  // The list goes with its items, its group gift and every gift on them.
  expect((await app.from("registries").delete().eq("id", registry.id)).error).toBeNull();
  expect(await giftRow(itemGiftId)).toBeNull();
  expect(await groupGiftRow(groupGift.id)).toBeNull();
  expect(await giftRow(groupGift.reservationId)).toBeNull();
});

test("a group gift keeps its reservation when the item goes, until the group gift goes too", async ({ page }) => {
  const maya = await createAccount("Maya Owner");
  const oz = await createAccount("Oz Organizer");
  const { registry, item } = await createWishlist(maya.id);

  const groupGift = await addGroupGift(registry.id, item.id, oz.id);

  // Maya deletes the item. The group gift still reads its status from the
  // reservation, so the reservation stays, and the page says what happened.
  const app = await asAccount(maya);
  expect((await app.from("registry_items").delete().eq("id", item.id)).error).toBeNull();
  expect(await giftRow(groupGift.reservationId)).toMatchObject({ registry_item_id: null, buyer_name: "Oz and others" });
  await page.goto(`/group-gift/${groupGift.token}`);
  await expect(page.getByText("This item was taken off Maya's list.")).toBeVisible();

  // Once the list is deleted, the group gift goes, and its reservation with it.
  expect((await app.from("registries").delete().eq("id", registry.id)).error).toBeNull();
  expect(await groupGiftRow(groupGift.id)).toBeNull();
  expect(await giftRow(groupGift.reservationId)).toBeNull();
});

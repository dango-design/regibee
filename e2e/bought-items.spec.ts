// An item a list's owner bought themselves isn't counted as gifted, and the
// owner chooses whether guests can cover it or it counts as gifted
// (src/lib/gifts.ts, 20261127093601_bought_item_choices.sql).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createAccount, createWishlist, db, signIn, waitForReact } from "./fixtures";
import { localSupabase } from "./local-supabase";

async function asGuest(): Promise<SupabaseClient> {
  const { apiUrl, anonKey } = localSupabase();
  const client = createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

async function choicesOf(itemId: string) {
  const { data, error } = await db
    .from("registry_items")
    .select("is_parent_purchased, guests_can_cover, marked_gifted")
    .eq("id", itemId)
    .single();
  if (error) throw error;
  return data;
}

const MARK_BOUGHT = /Mark as (bought by parent|already bought)/;

/** Picks an entry from the item's "…" menu, and waits until the save is on screen. */
async function choose(page: Page, entry: string | RegExp, next: string | RegExp) {
  const menu = page.getByRole("button", { name: /^More actions for / }).first();
  await waitForReact(menu);
  await menu.click();
  await page.getByRole("menuitem", { name: entry }).click();
  await expect(async () => {
    await page.keyboard.press("Escape");
    await menu.click();
    await expect(page.getByRole("menuitem", { name: next })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.keyboard.press("Escape");
}

test("a bought item isn't gifted until a guest covers it, and the owner can stop covers", async ({ page }) => {
  const owner = await createAccount("Remi Owner");
  const { registry, item } = await createWishlist(owner.id);
  const guest = await asGuest();

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}`);
  await choose(page, MARK_BOUGHT, "Mark as gifted");

  // Bought by the owner, not gifted.
  await expect(page.getByText("0 of 1 items gifted")).toBeVisible();
  await expect(page.getByText("1 bought by you")).toBeVisible();

  // The owner stops guests covering it, and covering is refused.
  await choose(page, "Don't let guests cover it", "Let guests cover it");
  expect(await choicesOf(item.id)).toMatchObject({ guests_can_cover: false, marked_gifted: false });
  await expect(page.getByText("Guests can't cover it")).toBeVisible();
  const { error: refused } = await guest.rpc("cover_parent_item", { p_item_id: item.id, p_buyer_name: "Glinda" });
  expect(refused?.message).toContain("isn't open to gifts");

  // Allowed again, a guest covers it, and then it counts as gifted.
  await choose(page, "Let guests cover it", "Don't let guests cover it");
  const { error } = await guest.rpc("cover_parent_item", { p_item_id: item.id, p_buyer_name: "Glinda" });
  expect(error).toBeNull();
  await page.reload();
  await expect(page.getByText("1 of 1 items gifted")).toBeVisible();
  await expect(page.getByText("1 covered")).toBeVisible();
});

test("marking a bought item as gifted counts it and stops covers, and unmarking resets it", async ({ page, browser }) => {
  const owner = await createAccount("Remi Owner");
  const { registry, item } = await createWishlist(owner.id);
  const guest = await asGuest();

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}`);
  await choose(page, MARK_BOUGHT, "Mark as gifted");
  await choose(page, "Mark as gifted", "Mark as not gifted");

  await expect(page.getByText("1 of 1 items gifted")).toBeVisible();
  await expect(page.getByText("Marked as gifted")).toBeVisible();
  const { error: refused } = await guest.rpc("cover_parent_item", { p_item_id: item.id, p_buyer_name: "Glinda" });
  expect(refused?.message).toContain("isn't open to gifts");

  // The guest page shows it as gifted, with nothing to give.
  const { data: list } = await db.from("registries").select("slug").eq("id", registry.id).single();
  const visitor = await browser.newContext();
  const guestPage = await visitor.newPage();
  await guestPage.goto(`/r/${list!.slug}`);
  await expect(guestPage.getByText("1 of 1 items gifted")).toBeVisible();
  await visitor.close();

  // Unmarking it as bought puts both choices back.
  await choose(page, "Mark as unpurchased", MARK_BOUGHT);
  expect(await choicesOf(item.id)).toMatchObject({ is_parent_purchased: false, guests_can_cover: true, marked_gifted: false });
});

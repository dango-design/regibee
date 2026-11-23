// The support team's read-only view of any account and list, at /support
// (see "Support view" in CLAUDE.md). Only accounts in support_emails can
// open it, it changes nothing, and every look is recorded in support_views.

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createAccount, createWishlist, db, reserveGift, signIn, uniqueEmail } from "./fixtures";
import { localSupabase } from "./local-supabase";

async function supportViews(supportUserId: string) {
  const { data, error } = await db
    .from("support_views")
    .select("what, account_id, registry_id")
    .eq("support_user_id", supportUserId)
    .order("id");
  if (error) throw error;
  return data;
}

test("the support team sees any account and list, read only, and each look is recorded", async ({ browser }) => {
  const owner = await createAccount("Pia Owner");
  const { registry, item } = await createWishlist(owner.id);
  const { error: ideaError } = await db
    .from("gift_ideas")
    .insert({ owner_id: owner.id, recipient: "Mom", title: `Silk Scarf ${registry.id.slice(0, 8)}` });
  if (ideaError) throw ideaError;

  // A guest reserves the item. Then the owner hides what's been reserved
  // from themselves and makes the list private.
  const guestEmail = uniqueEmail("glinda");
  const guest = await browser.newContext();
  await reserveGift(await guest.newPage(), { slug: registry.slug, name: "Glinda Guest", email: guestEmail });
  await guest.close();
  const { error: updateError } = await db
    .from("registries")
    .update({ is_private: true, is_public: false, settings: { ...registry.settings, hide_reservations: true } })
    .eq("id", registry.id);
  if (updateError) throw updateError;

  const support = await createAccount("Sid Support");
  const { error: supportError } = await db.from("support_emails").insert({ email: support.email.toLowerCase() });
  if (supportError) throw supportError;
  const stranger = await createAccount("Nia Nobody");

  // Signed out, or signed in without being on the team: not found.
  const signedOut = await (await browser.newContext()).newPage();
  expect((await signedOut.goto("/support"))?.status()).toBe(404);
  expect((await signedOut.goto(`/support/lists/${registry.id}`))?.status()).toBe(404);
  const strangerPage = await (await browser.newContext()).newPage();
  await signIn(strangerPage, stranger);
  await strangerPage.getByRole("button", { name: /Account menu/ }).click();
  await expect(strangerPage.getByRole("menuitem", { name: "Account settings" })).toBeVisible();
  await expect(strangerPage.getByRole("menuitem", { name: "Support" })).toHaveCount(0);
  expect((await strangerPage.goto("/support"))?.status()).toBe(404);
  expect((await strangerPage.goto(`/support/users/${owner.id}`))?.status()).toBe(404);
  expect((await strangerPage.goto(`/support/lists/${registry.id}`))?.status()).toBe(404);

  // The support account finds the Support link in its account menu.
  const page = await (await browser.newContext()).newPage();
  await signIn(page, support);
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Support" }).click();
  await expect(page.getByRole("heading", { name: "Find an account or list" })).toBeVisible();

  // Searching by email finds the owner's account.
  await page.getByRole("searchbox", { name: "Search" }).fill(owner.email);
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  await page.getByRole("link", { name: /Pia Owner/ }).click();
  await expect(page.getByRole("heading", { name: "Pia Owner" })).toBeVisible();
  await expect(page.getByText(owner.email).first()).toBeVisible();
  await expect(page.getByText(`Silk Scarf ${registry.id.slice(0, 8)}`)).toBeVisible();
  await expect(page.getByText("For Mom")).toBeVisible();

  // The private list opens as its owner sees it: nothing reserved.
  await page.getByRole("link", { name: new RegExp(registry.title) }).click();
  await expect(page.getByRole("heading", { name: registry.title })).toBeVisible();
  await expect(page.getByText(item.title)).toBeVisible();
  await expect(page.getByText("1 of 1 still needed")).toBeVisible();
  await expect(page.getByText(/The owner hides what's been reserved from themselves/)).toBeVisible();
  await expect(page.getByText("Glinda Guest")).toHaveCount(0);
  // Read only: nothing to add, edit or delete.
  await expect(page.getByRole("button", { name: /add|edit|delete|save/i })).toHaveCount(0);

  // Showing the hidden gifts shows the guest's reservation.
  await page.getByRole("link", { name: "Show hidden gifts" }).click();
  await expect(page.getByText(/Showing the gifts the owner hid from themselves/)).toBeVisible();
  await expect(page.getByText("0 of 1 still needed")).toBeVisible();
  await expect(page.getByText(/Reserved by Glinda Guest/)).toBeVisible();
  await expect(page.getByText(guestEmail)).toBeVisible();

  // A pasted list link finds the list.
  await page.goto("/support");
  await page.getByRole("searchbox", { name: "Search" }).fill(`https://www.regibee.com/r/${registry.slug}`);
  await page.getByRole("searchbox", { name: "Search" }).press("Enter");
  await expect(page.getByRole("link", { name: new RegExp(registry.title) })).toBeVisible();

  // Each account and list opened was recorded, and searching wasn't.
  expect(await supportViews(support.id)).toEqual([
    { what: "account", account_id: owner.id, registry_id: null },
    { what: "list", account_id: owner.id, registry_id: registry.id },
    { what: "hidden_gifts", account_id: owner.id, registry_id: registry.id },
  ]);

  // Being on the team gives the account's own session nothing more through
  // the API: it can't read the owner's gift ideas or check who's on the team.
  const api = createClient(localSupabase().apiUrl, localSupabase().anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await api.auth.signInWithPassword({ email: support.email, password: support.password });
  if (signInError) throw signInError;
  const { data: ideas } = await api.from("gift_ideas").select("id").eq("owner_id", owner.id);
  expect(ideas ?? []).toHaveLength(0);
  const { error: rpcError } = await api.rpc("is_support", { p_user: support.id });
  expect(rpcError).not.toBeNull();
  const { data: views } = await api.from("support_views").select("id");
  expect(views ?? []).toHaveLength(0);
});

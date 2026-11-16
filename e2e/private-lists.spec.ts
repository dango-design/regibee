// A private list opens only for its owner and co-managers. Making a list
// private takes it off its events, and guests can't give gifts on it, even
// through the API (supabase/migrations/20261115084541_private_lists.sql).

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createAccount, createExchangeEvent, createWishlist, db, signIn, waitForReact } from "./fixtures";
import { localSupabase } from "./local-supabase";

test("a private list opens only for its owner and co-managers", async ({ page, browser }) => {
  const owner = await createAccount("Pia Owner");
  const coManager = await createAccount("Cole Manager");
  const { registry, item } = await createWishlist(owner.id);
  await db.from("registries").update({ listed_on_profile: true }).eq("id", registry.id);
  const { error: managerError } = await db
    .from("registry_managers")
    .insert({ registry_id: registry.id, user_id: coManager.id, role: "manager" });
  if (managerError) throw managerError;
  // The list is on an event, where the event's guests can find it.
  const { event } = await createExchangeEvent(owner.id, [{ name: "Pia", email: owner.email }]);
  const { error: linkError } = await db
    .from("event_registries")
    .insert({ event_id: event.id, registry_id: registry.id, linked_by: owner.id });
  if (linkError) throw linkError;

  // The owner makes it private. The page warns that people lose access.
  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}/settings`);
  await expect(page.getByRole("radio", { name: /^Public/ })).toBeChecked();
  await waitForReact(page.getByRole("radio", { name: /^Private/ }));
  // The choices are cards: each radio button is hidden inside its label.
  await page.locator("label", { hasText: /^Private/ }).click();
  await expect(page.getByRole("radio", { name: /^Private/ })).toBeChecked();
  await expect(page.getByText(/won't be able to open it/)).toBeVisible();
  await expect(page.getByText("Private lists don't show on your profile.")).toBeVisible();
  await expect(page.getByText(`/r/${registry.slug}`)).toBeHidden();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saved!" })).toBeVisible();

  const { data: saved } = await db
    .from("registries")
    .select("is_private, is_public, listed_on_profile")
    .eq("id", registry.id)
    .single();
  expect(saved).toEqual({ is_private: true, is_public: false, listed_on_profile: false });
  const { count: onEvents } = await db
    .from("event_registries")
    .select("registry_id", { count: "exact", head: true })
    .eq("registry_id", registry.id);
  expect(onEvents).toBe(0);

  // Someone with the link gets the not-found page.
  const stranger = await (await browser.newContext()).newPage();
  const response = await stranger.goto(`/r/${registry.slug}`);
  expect(response?.status()).toBe(404);
  await expect(stranger).toHaveTitle(/Not Found/);

  // The owner and the co-manager can still open it.
  await page.goto(`/r/${registry.slug}`);
  await expect(page.getByRole("heading", { name: registry.title })).toBeVisible();
  const managerPage = await (await browser.newContext()).newPage();
  await signIn(managerPage, coManager);
  await managerPage.goto(`/r/${registry.slug}`);
  await expect(managerPage.getByRole("heading", { name: registry.title })).toBeVisible();

  // A guest who knows the item can't reserve it through the API.
  const guest = createClient(localSupabase().apiUrl, localSupabase().anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await guest.auth.signInAnonymously();
  if (signInError) throw signInError;
  const { error: reserveError } = await guest.rpc("reserve_registry_item", {
    p_item_id: item.id,
    p_buyer_name: "Sneaky Guest",
    p_quantity: 1,
  });
  expect(reserveError?.message).toContain("This list is private");

  // It can't go back on an event while it's private.
  const { error: relinkError } = await db
    .from("event_registries")
    .insert({ event_id: event.id, registry_id: registry.id, linked_by: owner.id });
  expect(relinkError?.message).toContain("A private list can't be shared");
});

test("new lists start as anyone with the link", async ({ page }) => {
  const owner = await createAccount("Nia Owner");
  await signIn(page, owner);
  await page.goto("/dashboard/registry/new");
  const baby = page.getByRole("button", { name: /^A baby/ });
  await waitForReact(baby);
  await baby.click();
  const title = `Nia's Baby Registry ${Date.now()}`;
  await page.getByLabel(/Registry name/).fill(title);
  await page.getByRole("button", { name: "Create registry" }).click();
  await page.waitForURL(/\/dashboard\/registry\/[0-9a-f-]+$/);

  const { data: made } = await db
    .from("registries")
    .select("is_private, is_public")
    .eq("owner_id", owner.id)
    .eq("title", title)
    .single();
  expect(made).toEqual({ is_private: false, is_public: false });
});

// Test data, written straight to the local database with the service-role
// key. Every name, email and slug is new, so tests don't depend on each other
// or on a fresh database.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page, type Request } from "@playwright/test";
import { localSupabase } from "./local-supabase";

export const SITE_URL = "http://localhost:3100";
export const CRON_SECRET = "e2e-cron-secret";
/** Where the site sends warnings about itself, such as auth-email-alerts.spec.ts checks. */
export const ALERT_EMAIL = "site-alerts@example.com";

export const db = createClient(localSupabase().apiUrl, localSupabase().serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function uniqueId(): string {
  return randomUUID().slice(0, 8);
}

export function uniqueEmail(who: string): string {
  return `${who}-${uniqueId()}@example.com`;
}

export const SHIPPING_ADDRESS = "123 Main St\nApt 4B\nSan Francisco, CA 94102";

/**
 * Makes an account a star (see "Account levels" in CLAUDE.md). The accounts
 * made here are stars unless a test asks otherwise. All basic accounts share
 * one daily email allowance, and the local database keeps its rows between
 * runs, so running the tests a few times in a day would use it up.
 */
export async function makeStar(email: string) {
  const { error } = await db.from("star_emails").upsert({ email: email.toLowerCase() });
  if (error) throw error;
}

/**
 * An owner with a confirmed account, and a public baby registry with one
 * item. The owner is a star unless `star` is false.
 */
export async function createRegistryWithItem({ star = true }: { star?: boolean } = {}) {
  const id = uniqueId();
  const ownerEmail = `owner-${id}@example.com`;
  const ownerPassword = `pw-${randomUUID()}`;

  const { data: created, error: userError } = await db.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: { full_name: "Remi Owner" },
  });
  if (userError || !created.user) throw userError ?? new Error("No user");
  if (star) await makeStar(ownerEmail);

  const { data: registry, error: registryError } = await db
    .from("registries")
    .insert({
      owner_id: created.user.id,
      title: `Remi & Max's Registry ${id}`,
      slug: `e2e-${id}`,
      is_public: true,
      registry_type: "baby",
      parent_names: "Remi & Max",
      settings: { shipping_address: SHIPPING_ADDRESS },
    })
    .select("id, slug, title")
    .single();
  if (registryError) throw registryError;

  const { data: item, error: itemError } = await db
    .from("registry_items")
    .insert({ registry_id: registry.id, title: `Sound Machine ${id}`, price: 59.99, quantity_needed: 1 })
    .select("id, title")
    .single();
  if (itemError) throw itemError;

  return { owner: { id: created.user.id, email: ownerEmail, password: ownerPassword }, registry, item };
}

/** Reserves the registry's one item as a guest, from the registry page. */
export async function reserveGift(page: Page, opts: { slug: string; name: string; email: string }) {
  await page.goto(`/r/${opts.slug}`);
  // A click before React takes over the page does nothing.
  const giftThis = page.getByRole("button", { name: "Gift this" });
  await waitForReact(giftThis);
  await giftThis.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your Name").fill(opts.name);
  await dialog.getByLabel("Your Email").fill(opts.email);
  await dialog.getByRole("button", { name: "Reserve and buy" }).click();
  // The next step shows the address to ship it to.
  await expect(dialog.getByText("123 Main St")).toBeVisible();
}

/** Calls the daily reservation job, as Vercel Cron does. */
export async function runReservationJob(page: Page): Promise<{ released: number; reminded: number }> {
  const response = await page.request.get("/api/cron/gift-reservations", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

/** A confirmed account with a password, for tests that sign in. A star unless `star` is false. */
export async function createAccount(fullName: string, { star = true }: { star?: boolean } = {}) {
  const email = uniqueEmail(fullName.split(" ")[0].toLowerCase());
  const password = `pw-${randomUUID()}`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("No user");
  if (star) await makeStar(email);
  return { id: data.user.id, email, password, name: fullName };
}

/**
 * Waits until React has taken over an element. Until then, a click on it does
 * nothing, and text typed into it is cleared on React's next render. On
 * GitHub's dev server React can still be starting after the page has loaded,
 * so a click right after page.goto can be lost (issue #163). React tags each
 * element it manages with a "__reactProps" key.
 */
export async function waitForReact(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps"))))
    .toBe(true);
}

/**
 * Picks an option in one of the site's dropdowns. They open their own list
 * instead of the browser's menu, so Playwright's selectOption can't use them.
 * The dropdown's button is named by its value and then its label, so a string
 * `field` matches any part of that.
 */
export async function chooseOption(scope: Page | Locator, field: string | RegExp, option: string) {
  const button = scope.getByRole("button", { name: field });
  // A click before React takes over the page doesn't open the list.
  await waitForReact(button);
  await button.click();
  // The list opens at the end of the page, outside `scope`.
  const page = "page" in scope ? scope.page() : scope;
  await page.getByRole("option", { name: option, exact: true }).click();
  // As it closes, the list puts focus back on its button. Wait, so the next
  // step's typing isn't sent there.
  await expect(page.getByRole("listbox")).toBeHidden();
}

/**
 * Signs in from the login page, and returns once the dashboard has finished
 * loading.
 *
 * The login page moves to the dashboard with router.push and then calls
 * router.refresh, so the browser fetches the dashboard twice. The address
 * changes after the first fetch, and the second starts just after. A
 * page.goto made while the second is still running can be cancelled with
 * net::ERR_ABORTED (issue #273). So this also waits until no fetch of a
 * page's server data has run for half a second. Next.js marks those fetches
 * with an "rsc" header.
 */
export async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/login");
  await waitForReact(page.locator("form"));
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);

  const running = new Set<Request>();
  let lastChange = Date.now();
  const started = (request: Request) => {
    if (!request.headers()["rsc"]) return;
    running.add(request);
    lastChange = Date.now();
  };
  const ended = (request: Request) => {
    if (running.delete(request)) lastChange = Date.now();
  };
  page.on("request", started);
  page.on("requestfinished", ended);
  page.on("requestfailed", ended);
  try {
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/);
    await expect.poll(() => running.size === 0 && Date.now() - lastChange >= 500).toBe(true);
  } finally {
    page.off("request", started);
    page.off("requestfinished", ended);
    page.off("requestfailed", ended);
  }
}

/** A personal wishlist with one item, owned by the given account. */
export async function createWishlist(ownerId: string, opts: { settings?: Record<string, unknown> } = {}) {
  const id = uniqueId();
  const { data: registry, error } = await db
    .from("registries")
    .insert({
      owner_id: ownerId,
      title: `Christmas Wishlist ${id}`,
      slug: `e2e-wish-${id}`,
      is_public: true,
      registry_type: "personal",
      event_type: "christmas",
      honoree_names: "Maya",
      settings: { shipping_address: SHIPPING_ADDRESS, ...opts.settings },
    })
    .select("id, slug, title, settings")
    .single();
  if (error) throw error;
  const { data: item, error: itemError } = await db
    .from("registry_items")
    .insert({ registry_id: registry.id, title: `Wool Scarf ${id}`, price: 40, quantity_needed: 1 })
    .select("id, title")
    .single();
  if (itemError) throw itemError;
  return { registry, item };
}

/**
 * A Secret Santa event hosted by the given account, with these guests on its
 * list. Each guest comes back with their personal RSVP link.
 */
export async function createExchangeEvent(
  hostId: string,
  guests: { name: string; email: string | null }[],
) {
  const id = uniqueId();
  const { data: event, error } = await db
    .from("events")
    .insert({ owner_id: hostId, slug: `e2e-santa-${id}`, event_type: "christmas", title: `Family Secret Santa ${id}` })
    .select("id, slug, title")
    .single();
  if (error) throw error;
  const { error: exchangeError } = await db.from("gift_exchanges").insert({ event_id: event.id, budget: "$25" });
  if (exchangeError) throw exchangeError;
  const rows = guests.map((g) => ({ event_id: event.id, name: g.name, email: g.email, token: randomUUID().replace(/-/g, "") }));
  const { data: saved, error: guestError } = await db.from("event_guests").insert(rows).select("id, name, token");
  if (guestError) throw guestError;
  return {
    event,
    guests: saved.map((g) => ({ ...g, rsvpPath: `/e/${event.slug}?g=${g.token}` })),
  };
}

/** RSVPs yes from a guest's personal link, joins the exchange and adds a wishlist link. */
export async function joinExchange(page: Page, rsvpPath: string, wishlistUrl: string) {
  await page.goto(rsvpPath);
  // A click before React takes over the page does nothing.
  const going = page.getByRole("button", { name: "Going" });
  await waitForReact(going);
  await going.click();
  await page.getByLabel("Your wishlist (optional)").fill(wishlistUrl);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You're in the gift exchange.")).toBeVisible();
}

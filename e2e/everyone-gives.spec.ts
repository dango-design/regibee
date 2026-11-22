// "Everyone gives everyone" events: a family Christmas where every guest
// links a wish list. Guests see each other's lists and which of the other
// guests reserved what, never on their own list. A list that hides what's
// been reserved from its owner shows them the gifts, and who gave them, from
// the day after the event, with one email.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { AUTH_EMAILS } from "../src/lib/auth-email-templates";
import {
  createAccount,
  createWishlist,
  db,
  reserveGift,
  runReservationJob,
  signIn,
  uniqueEmail,
  uniqueId,
  waitForReact,
} from "./fixtures";
import { localSupabase } from "./local-supabase";
import { linkIn, waitForEmail } from "./mailbox";

/** An everyone-gives-everyone event hosted by the given account, with these guests on its list. */
async function createEveryoneEvent(hostId: string, guests: { name: string; email: string }[]) {
  const id = uniqueId();
  const { data: event, error } = await db
    .from("events")
    .insert({
      owner_id: hostId,
      slug: `e2e-family-${id}`,
      event_type: "christmas",
      title: `Family Christmas ${id}`,
      event_date: "2099-12-25",
    })
    .select("id, slug, title")
    .single();
  if (error) throw error;
  const { error: exchangeError } = await db.from("gift_exchanges").insert({ event_id: event.id, kind: "everyone", budget: "$30" });
  if (exchangeError) throw exchangeError;
  const rows = guests.map((g) => ({ event_id: event.id, name: g.name, email: g.email, token: randomUUID().replace(/-/g, "") }));
  const { data: saved, error: guestError } = await db.from("event_guests").insert(rows).select("id, name, token");
  if (guestError) throw guestError;
  return { event, guests: saved.map((g) => ({ ...g, rsvpPath: `/e/${event.slug}?g=${g.token}` })) };
}

/** RSVPs "Going" from a guest's own link. The next step asks for a wish list. */
async function rsvpGoing(page: Page, rsvpPath: string) {
  await page.goto(rsvpPath);
  await waitForReact(page.getByRole("button", { name: "Going" }));
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByRole("heading", { name: /You're going/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Now add your wish list" })).toBeVisible();
}

/**
 * RSVPs "Going" from a guest's own link, logs in from the wish list step,
 * and links one of the account's lists. A wish list here is a Regibee list,
 * so it takes an account.
 */
async function rsvpWithOwnList(
  page: Page,
  rsvpPath: string,
  account: { email: string; password: string },
  list: { title: string },
) {
  await rsvpGoing(page, rsvpPath);
  // The step's own Log in, not the one in the top bar. It has no way to paste a link.
  const step = page.getByRole("region", { name: "Now add your wish list" });
  await expect(step.getByRole("button", { name: /Paste a link/ })).toHaveCount(0);
  await step.getByRole("link", { name: "Log in" }).click();
  await page.waitForURL(/\/login\?redirect=/);
  await waitForReact(page.locator("form"));
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => `${url.pathname}${url.search}` === rsvpPath);
  const use = page.getByRole("button", { name: `Use ${list.title}` });
  await waitForReact(use);
  await use.click();
  await expect(page.getByRole("heading", { name: "Your wish list" })).toBeVisible();
}

/** The purchases on a list that its owner can read with the anon key, as the mobile app does. */
async function purchasesOwnerCanRead(account: { email: string; password: string }, registryId: string) {
  const client = createClient(localSupabase().apiUrl, localSupabase().anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw error;
  const { data, error: readError } = await client
    .from("purchases")
    .select("id, buyer_name, registry_items!registry_item_id!inner(registry_id)")
    .eq("registry_items.registry_id", registryId);
  if (readError) throw readError;
  return data ?? [];
}

test("guests see each other's lists and who reserved what, and the owner sees it the day after", async ({ browser }) => {
  // Four people in four browsers, a sign-in and the daily job: longer than one guest's flow.
  test.setTimeout(120_000);
  const maya = await createAccount("Maya Owner");
  const ben = await createAccount("Ben Brother");
  const hal = await createAccount("Hal Host");
  const { registry: mayaList, item: scarf } = await createWishlist(maya.id);
  const { registry: benList } = await createWishlist(ben.id);
  const { event, guests } = await createEveryoneEvent(hal.id, [
    { name: "Maya", email: maya.email },
    { name: "Ben", email: ben.email },
    { name: "Cleo", email: `cleo-${uniqueId()}@example.com` },
  ]);
  const [mayaGuest, benGuest, cleoGuest] = guests;

  // Maya and Ben RSVP with their lists. Maya's list starts hiding what's
  // reserved from her, so her gifts stay a surprise.
  const mayaContext = await browser.newContext();
  await rsvpWithOwnList(await mayaContext.newPage(), mayaGuest.rsvpPath, maya, mayaList);
  await mayaContext.close();
  const benSignedIn = await browser.newContext();
  await rsvpWithOwnList(await benSignedIn.newPage(), benGuest.rsvpPath, ben, benList);
  await benSignedIn.close();
  const { data: mayaSettings } = await db.from("registries").select("settings").eq("id", mayaList.id).single();
  expect(mayaSettings?.settings).toMatchObject({ hide_reservations: true });

  // Ben, back on his own link without signing in, sees everyone's lists,
  // opens Maya's from the invitation and reserves the scarf.
  const benContext = await browser.newContext();
  const benPage = await benContext.newPage();
  await benPage.goto(benGuest.rsvpPath);
  const lists = benPage.getByRole("region", { name: "Everyone's wish lists" });
  await expect(lists.getByText(mayaList.title)).toBeVisible();
  await lists.getByRole("link", { name: "See Maya's list" }).click();
  await benPage.waitForURL(`**/r/${mayaList.slug}`);
  await expect(benPage.getByText(`You're shopping as a guest of ${event.title}`)).toBeVisible();
  await reserveGift(benPage, { slug: mayaList.slug, name: "Ben Brother", email: ben.email });
  await benContext.close();

  // Cleo, another guest, sees that Ben reserved it.
  const cleoContext = await browser.newContext();
  const cleoPage = await cleoContext.newPage();
  await rsvpGoing(cleoPage, cleoGuest.rsvpPath);
  await cleoPage
    .getByRole("region", { name: "Everyone's wish lists" })
    .getByRole("link", { name: "See Maya's list" })
    .click();
  await cleoPage.waitForURL(`**/r/${mayaList.slug}`);
  await expect(cleoPage.getByText("Reserved by Ben")).toBeVisible();
  await cleoContext.close();

  // Someone with the plain list link sees it's taken, but not by whom.
  const strangerContext = await browser.newContext();
  const strangerPage = await strangerContext.newPage();
  await strangerPage.goto(`/r/${mayaList.slug}`);
  await expect(strangerPage.getByText(scarf.title)).toBeVisible();
  await expect(strangerPage.getByText("Reserved by Ben")).toHaveCount(0);
  await strangerContext.close();

  // Maya can't read the reservation at all, not even with the anon key.
  expect(await purchasesOwnerCanRead(maya, mayaList.id)).toHaveLength(0);
  const mayaSignedIn = await browser.newContext();
  const mayaPage = await mayaSignedIn.newPage();
  await signIn(mayaPage, maya);
  await mayaPage.goto(`/dashboard/registry/${mayaList.id}?tab=purchases`);
  await expect(mayaPage.getByText(`Gifts reserved before ${event.title} are revealed`).first()).toBeVisible();
  await expect(mayaPage.getByText("Ben Brother")).toHaveCount(0);

  // The event is over: move it back two days, and the reservation to before it.
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  await db.from("events").update({ event_date: twoDaysAgo }).eq("id", event.id);
  await db.from("purchases").update({ created_at: fourDaysAgo }).eq("registry_item_id", scarf.id);

  // The daily job reveals it and emails Maya once.
  const first = (await runReservationJob(mayaPage)) as unknown as { reveals: { revealed: number; emailed: number } };
  expect(first.reveals.emailed).toBeGreaterThanOrEqual(1);
  await waitForEmail(maya.email, `🎁 Your gifts from ${event.title} are revealed`);
  const second = (await runReservationJob(mayaPage)) as unknown as { reveals: { revealed: number; emailed: number } };
  const { count } = await db
    .from("gift_reveals")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("registry_id", mayaList.id);
  expect(count).toBe(1);
  expect(second.reveals).toBeDefined();

  // Now Maya sees who gave what, on her page and with the anon key.
  const readable = await purchasesOwnerCanRead(maya, mayaList.id);
  expect(readable.map((p) => p.buyer_name)).toEqual(["Ben Brother"]);
  await mayaPage.goto(`/dashboard/registry/${mayaList.id}?tab=purchases`);
  await expect(mayaPage.getByText("Ben Brother").first()).toBeVisible();
  await mayaSignedIn.close();
});

test("a guest without an account makes one and a wish list right after they RSVP", async ({ page }) => {
  // A sign-up and its confirmation email: longer than one RSVP.
  test.setTimeout(90_000);
  const hal = await createAccount("Hal Host");
  const email = uniqueEmail("nina");
  const { event, guests } = await createEveryoneEvent(hal.id, [{ name: "Nina", email }]);
  const [nina] = guests;

  await rsvpGoing(page, nina.rsvpPath);
  // Her confirmation asks for a wish list too.
  const confirmation = await waitForEmail(email, `You're going to ${event.title}`);
  expect(confirmation.html).toContain("Add your wish list.");

  // "Make a free wish list" makes an account, and comes back to her invitation.
  await page.getByRole("link", { name: "Make a free wish list" }).click();
  await page.waitForURL(/\/signup\?redirect=/);
  await waitForReact(page.locator("form"));
  await page.getByLabel("Your name").fill("Nina Niece");
  await page.getByRole("textbox", { name: /^Email/ }).fill(email);
  await page.getByLabel("Password").fill("a-new-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  const confirm = await waitForEmail(email, AUTH_EMAILS.confirmation.subject);
  await page.goto(linkIn(confirm, /\/auth\/v1\/verify\?.*type=signup/));
  await page.waitForURL(new RegExp(`/e/${event.slug}\\?g=${nina.token}`));

  // Signed in now, one button makes her list and links it.
  const make = page.getByRole("button", { name: "Make my wish list" });
  await waitForReact(make);
  await make.click();
  await expect(page.getByRole("link", { name: "Add things to your list" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your wish list" }).getByText("Nina's Christmas List")).toBeVisible();

  const { data: guest } = await db.from("event_guests").select("wishlist_registry_id").eq("id", nina.id).single();
  const { data: list } = await db
    .from("registries")
    .select("title, settings, is_private")
    .eq("id", guest!.wishlist_registry_id!)
    .single();
  // Others can open it, and what's reserved stays hidden from her.
  expect(list).toMatchObject({ title: "Nina's Christmas List", is_private: false, settings: { hide_reservations: true } });
});

test("a guest logs in after they RSVP and links a list they already have", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const hal = await createAccount("Hal Host");
  const olive = await createAccount("Olive Sister");
  const { registry: oliveList } = await createWishlist(olive.id);
  const { registry: halList } = await createWishlist(hal.id);
  const { event, guests } = await createEveryoneEvent(hal.id, [{ name: "Olive", email: olive.email }]);
  // The host linked their own list too. The invitation email leaves it out:
  // guests find everyone's lists on the invitation.
  await db.from("event_registries").insert({ event_id: event.id, registry_id: halList.id, linked_by: hal.id });

  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  await signIn(hostPage, hal);
  await hostPage.goto(`/dashboard/events/${event.id}`);
  await hostPage.getByRole("button", { name: "Send invitations" }).click();
  await hostPage.getByRole("button", { name: "Send", exact: true }).click();
  const invitation = await waitForEmail(olive.email, `You're invited: ${event.title}`);
  expect(invitation.html).toContain("everyone gives everyone");
  expect(invitation.html).not.toContain(halList.title);
  expect(invitation.html).not.toContain(`/r/${halList.slug}`);
  await hostContext.close();

  await rsvpGoing(page, guests[0].rsvpPath);
  // The wish list step's own Log in, not the one in the top bar.
  await page.getByRole("region", { name: "Now add your wish list" }).getByRole("link", { name: "Log in" }).click();
  await page.waitForURL(/\/login\?redirect=/);
  await waitForReact(page.locator("form"));
  await page.getByLabel("Email").fill(olive.email);
  await page.getByLabel("Password").fill(olive.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(new RegExp(`/e/${event.slug}\\?g=${guests[0].token}`));

  const use = page.getByRole("button", { name: `Use ${oliveList.title}` });
  await waitForReact(use);
  await use.click();
  await expect(page.getByRole("link", { name: "Add things to your list" })).toHaveAttribute(
    "href",
    `/dashboard/registry/${oliveList.id}`,
  );
  const { data: guest } = await db.from("event_guests").select("wishlist_registry_id").eq("id", guests[0].id).single();
  expect(guest?.wishlist_registry_id).toBe(oliveList.id);
});

test("a guest logs in from the invitation's top bar and comes back to their own link", async ({ page }) => {
  const hal = await createAccount("Hal Host");
  const pia = await createAccount("Pia Cousin");
  const { guests } = await createEveryoneEvent(hal.id, [{ name: "Pia", email: pia.email }]);

  await page.goto(guests[0].rsvpPath);
  const bar = page.getByRole("banner");
  await bar.getByRole("link", { name: "Log in" }).click();
  await page.waitForURL(/\/login\?redirect=/);
  await waitForReact(page.locator("form"));
  await page.getByLabel("Email").fill(pia.email);
  await page.getByLabel("Password").fill(pia.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Back on her own link, still greeted by name, with her account menu in the bar.
  await page.waitForURL((url) => url.pathname === guests[0].rsvpPath.split("?")[0] && url.search === `?g=${guests[0].token}`);
  await expect(page.getByRole("heading", { name: "Hi Pia, can you make it?" })).toBeVisible();
  await expect(bar.getByRole("button", { name: /^Account menu/ })).toBeVisible();
});

test("a list the host linked shows like a guest's, with whose it is", async ({ browser }) => {
  const hal = await createAccount("Hal Host");
  const ben = await createAccount("Ben Brother");
  // Hal's own list, on his profile, so guests see his name on it as on the list's page.
  const { registry: halList } = await createWishlist(hal.id);
  const { error: listedError } = await db.from("registries").update({ listed_on_profile: true }).eq("id", halList.id);
  if (listedError) throw listedError;
  const { event, guests } = await createEveryoneEvent(hal.id, [{ name: "Ben", email: ben.email }]);
  const { error: linkError } = await db.from("event_registries").insert({ event_id: event.id, registry_id: halList.id });
  if (linkError) throw linkError;

  // Ben, a guest, sees Hal's list in everyone's wish lists, by Hal's name.
  const benContext = await browser.newContext();
  const benPage = await benContext.newPage();
  await benPage.goto(guests[0].rsvpPath);
  const lists = benPage.getByRole("region", { name: "Everyone's wish lists" });
  await expect(lists.getByText("Hal Host", { exact: true })).toBeVisible();
  await expect(lists.getByText(halList.title)).toBeVisible();
  await expect(lists.getByRole("link", { name: "See Hal's list" })).toHaveAttribute(
    "href",
    `/e/${event.slug}/gifts?g=${guests[0].token}&to=${halList.slug}`,
  );
  await expect(benPage.getByRole("region", { name: "Gifts" })).toHaveCount(0);
  await benContext.close();

  // Hal sees it as his own, with no button to shop it.
  const halContext = await browser.newContext();
  const halPage = await halContext.newPage();
  await signIn(halPage, hal);
  await halPage.goto(`/e/${event.slug}`);
  const halLists = halPage.getByRole("region", { name: "Everyone's wish lists" });
  await expect(halLists.getByText("(you)")).toBeVisible();
  await expect(halLists.getByText(halList.title)).toBeVisible();
  await expect(halLists.getByRole("link", { name: "See Hal's list" })).toHaveCount(0);
  await halContext.close();
});

test("a host on the guest list who linked their own list has it on their row", async ({ browser }) => {
  const hal = await createAccount("Hal Host");
  const ben = await createAccount("Ben Brother");
  const { registry: halList } = await createWishlist(hal.id);
  const { event, guests } = await createEveryoneEvent(hal.id, [
    { name: "Hal", email: hal.email },
    { name: "Ben", email: ben.email },
  ]);
  const { error: linkError } = await db.from("event_registries").insert({ event_id: event.id, registry_id: halList.id });
  if (linkError) throw linkError;
  // Both said they're coming, and neither has added a wish list.
  const { error: rsvpError } = await db
    .from("event_guests")
    .update({ rsvp_status: "yes", in_exchange: true })
    .eq("event_id", event.id);
  if (rsvpError) throw rsvpError;
  const [halGuest, benGuest] = guests;

  // Ben sees Hal's list once, on Hal's row, and nobody is missing a list but him.
  const benContext = await browser.newContext();
  const benPage = await benContext.newPage();
  await benPage.goto(benGuest.rsvpPath);
  const lists = benPage.getByRole("region", { name: "Everyone's wish lists" });
  await expect(lists.getByText(halList.title)).toHaveCount(1);
  await expect(lists.getByRole("link", { name: "See Hal's list" })).toHaveAttribute(
    "href",
    `/e/${event.slug}/gifts?g=${benGuest.token}&to=${halList.slug}`,
  );
  await expect(lists.getByText("1 of 2 hasn't added a list yet.")).toBeVisible();
  await benContext.close();

  // Hal sees it on his own row, and his RSVP's wish list step shows it as his.
  const halContext = await browser.newContext();
  const halPage = await halContext.newPage();
  await signIn(halPage, hal);
  await halPage.goto(halGuest.rsvpPath);
  const halLists = halPage.getByRole("region", { name: "Everyone's wish lists" });
  await expect(halLists.getByText(halList.title)).toHaveCount(1);
  await expect(halLists.getByText("(you)")).toHaveCount(1);
  await expect(halLists.getByText("Add your wish list above")).toHaveCount(0);
  const step = halPage.getByRole("region", { name: "Your wish list" });
  await expect(step.getByText(halList.title)).toBeVisible();
  await expect(step.getByRole("button", { name: "Change", exact: true })).toBeVisible();
  await halContext.close();
});

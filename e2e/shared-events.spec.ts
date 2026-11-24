// Someone's profile lists the events they and the signed-in viewer both went
// to or are going to, under "Events together". Hosting counts, and so does a
// guest's yes. An invitation with another reply, or none, doesn't.

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createAccount, db, signIn, uniqueId } from "./fixtures";

/** YYYY-MM-DD in UTC, `days` from today, as the profile counts. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function createEvent(ownerId: string, title: string, eventDate: string | null) {
  const { data, error } = await db
    .from("events")
    .insert({ owner_id: ownerId, slug: `e2e-shared-${uniqueId()}`, title, event_type: "birthday", event_date: eventDate })
    .select("id, slug, title")
    .single();
  if (error) throw error;
  return data;
}

async function addGuest(
  eventId: string,
  guest: { name: string; email?: string | null; profile_id?: string; rsvp_status?: string },
) {
  const token = randomUUID().replace(/-/g, "");
  const { error } = await db.from("event_guests").insert({ event_id: eventId, token, ...guest });
  if (error) throw error;
  return token;
}

async function profileUrl(accountId: string) {
  const { data } = await db.from("profiles").select("public_id").eq("id", accountId).single();
  return `/u/${data!.public_id}`;
}

test("a profile lists the events you and that person both go to", async ({ page, browser }) => {
  const host = await createAccount("Hal Host");
  const vera = await createAccount("Vera Viewer");
  const pat = await createAccount("Pat Person");
  const id = uniqueId();

  // Both said yes: Vera by her email, Pat from a follow.
  const party = await createEvent(host.id, `Pool Party ${id}`, inDays(4));
  const partyToken = await addGuest(party.id, { name: "Vera", email: vera.email, rsvp_status: "yes" });
  await addGuest(party.id, { name: "Pat", profile_id: pat.id, rsvp_status: "yes" });
  // A past one both went to.
  const brunch = await createEvent(host.id, `Last Week's Brunch ${id}`, inDays(-7));
  await addGuest(brunch.id, { name: "Vera", profile_id: vera.id, rsvp_status: "yes" });
  await addGuest(brunch.id, { name: "Pat", email: pat.email, rsvp_status: "yes" });
  // Vera hosts this one, and Pat said yes.
  const dinner = await createEvent(vera.id, `Vera's Dinner ${id}`, inDays(10));
  await addGuest(dinner.id, { name: "Pat", email: pat.email, rsvp_status: "yes" });
  // Pat hasn't replied to this one, declined the next, and said maybe to the last.
  const picnic = await createEvent(host.id, `Picnic ${id}`, inDays(5));
  await addGuest(picnic.id, { name: "Vera", email: vera.email, rsvp_status: "yes" });
  await addGuest(picnic.id, { name: "Pat", email: pat.email });
  const recital = await createEvent(host.id, `Recital ${id}`, inDays(6));
  await addGuest(recital.id, { name: "Vera", email: vera.email, rsvp_status: "yes" });
  await addGuest(recital.id, { name: "Pat", email: pat.email, rsvp_status: "no" });
  const hike = await createEvent(host.id, `Hike ${id}`, inDays(8));
  await addGuest(hike.id, { name: "Vera", email: vera.email, rsvp_status: "yes" });
  await addGuest(hike.id, { name: "Pat", email: pat.email, rsvp_status: "maybe" });
  // Only Pat goes to this one.
  const concert = await createEvent(host.id, `Concert ${id}`, inDays(9));
  await addGuest(concert.id, { name: "Pat", email: pat.email, rsvp_status: "yes" });

  const patUrl = await profileUrl(pat.id);
  await signIn(page, vera);
  await page.goto(patUrl);
  await expect(page.getByRole("heading", { name: "Pat Person" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Events together" })).toBeVisible();

  // Upcoming first, soonest first, then past. Each opens Vera's own link.
  const cards = page.locator("a.clickable-card", { hasText: id });
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText(`Pool Party ${id}`);
  await expect(cards.nth(0)).toHaveAttribute("href", `/e/${party.slug}?g=${partyToken}`);
  await expect(cards.nth(1)).toContainText(`Vera's Dinner ${id}`);
  await expect(cards.nth(1)).toHaveAttribute("href", `/dashboard/events/${dinner.id}`);
  await expect(cards.nth(2)).toContainText(`Last Week's Brunch ${id}`);
  await expect(cards.nth(2)).toContainText("Past");

  // The host sees the events Pat goes to, as the one who hosts them.
  const hostPage = await (await browser.newContext()).newPage();
  await signIn(hostPage, host);
  await hostPage.goto(patUrl);
  await expect(hostPage.getByRole("heading", { name: "Events together" })).toBeVisible();
  await expect(hostPage.locator("a.clickable-card", { hasText: id })).toHaveCount(3);
  await expect(hostPage.getByRole("link", { name: new RegExp(`Concert ${id}`) })).toHaveAttribute(
    "href",
    `/dashboard/events/${concert.id}`,
  );
  await expect(hostPage.getByText(new RegExp(`Picnic ${id}|Recital ${id}|Hike ${id}`))).toHaveCount(0);

  // Signed out, and on Pat's own profile, there's no such section.
  const guestPage = await (await browser.newContext()).newPage();
  await guestPage.goto(patUrl);
  await expect(guestPage.getByRole("heading", { name: "Pat Person" })).toBeVisible();
  await expect(guestPage.getByRole("heading", { name: "Events together" })).toHaveCount(0);

  const patPage = await (await browser.newContext()).newPage();
  await signIn(patPage, pat);
  await patPage.goto(patUrl);
  await expect(patPage.getByRole("heading", { name: "Pat Person" })).toBeVisible();
  await expect(patPage.getByRole("heading", { name: "Events together" })).toHaveCount(0);
});

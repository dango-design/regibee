// The Events tab lists other people's events you're on the guest list for,
// under Invited, apart from the ones you host. A guest row is yours when it's
// linked to your account (invited from a follow) or has your account's email.

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createAccount, db, signIn, uniqueEmail, uniqueId } from "./fixtures";

/** YYYY-MM-DD in UTC, `days` from today, as the Events tab counts. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function createEvent(ownerId: string, title: string, eventDate: string | null, hostedBy: string | null = null) {
  const { data, error } = await db
    .from("events")
    .insert({
      owner_id: ownerId,
      slug: `e2e-invited-${uniqueId()}`,
      title,
      event_type: "birthday",
      event_date: eventDate,
      hosted_by: hostedBy,
    })
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

test("the Events tab lists events you're invited to apart from the ones you host", async ({ page }) => {
  const host = await createAccount("Hal Host");
  const gil = await createAccount("Gil Guest");
  const other = await createAccount("Opal Other");
  const id = uniqueId();

  // Invited by email, not answered yet.
  const party = await createEvent(host.id, `Pool Party ${id}`, inDays(4), "Hal & Hana");
  const partyToken = await addGuest(party.id, { name: "Gil", email: gil.email });
  // Invited from a follow, linked to the account, and over now.
  const brunch = await createEvent(host.id, `Last Week's Brunch ${id}`, inDays(-7));
  await addGuest(brunch.id, { name: "Gil", profile_id: gil.id, rsvp_status: "yes" });
  // Gil's own event, with Gil on its guest list too. It's one Gil hosts.
  const dinner = await createEvent(gil.id, `Gil's Dinner ${id}`, inDays(10));
  await addGuest(dinner.id, { name: "Gil", email: gil.email });
  // A guest row with Gil's email that's linked to another account isn't Gil's.
  const picnic = await createEvent(host.id, `Someone Else's Picnic ${id}`, inDays(5));
  await addGuest(picnic.id, { name: "Opal", email: gil.email, profile_id: other.id });
  // Nor is one for a different address.
  const recital = await createEvent(host.id, `Recital ${id}`, inDays(6));
  await addGuest(recital.id, { name: "Someone", email: uniqueEmail("someone") });

  await signIn(page, gil);
  await page.goto("/dashboard/events");

  const hosting = page.getByRole("region", { name: "Hosting" });
  await expect(hosting.getByRole("link", { name: `Gil's Dinner ${id}`, exact: true })).toHaveAttribute(
    "href",
    `/dashboard/events/${dinner.id}`,
  );

  const invited = page.getByRole("region", { name: "Invited" });
  const partyCard = invited.locator(".clickable-card", { hasText: `Pool Party ${id}` });
  await expect(partyCard).toContainText("Hosted by Hal & Hana");
  await expect(partyCard).toContainText("You haven't replied");
  // It opens the invitation on Gil's own guest link, to RSVP.
  await expect(partyCard.getByRole("link", { name: "RSVP" })).toHaveAttribute("href", `/e/${party.slug}?g=${partyToken}`);
  await expect(invited.getByText(`Gil's Dinner ${id}`)).toHaveCount(0);

  const pastEvents = page.getByRole("region", { name: "Past events" });
  const brunchCard = pastEvents.locator(".clickable-card", { hasText: `Last Week's Brunch ${id}` });
  await expect(brunchCard).toContainText("Invited");
  await expect(brunchCard).toContainText("You're going");

  await expect(page.getByText(new RegExp(`Someone Else's Picnic ${id}|Recital ${id}`))).toHaveCount(0);

  await partyCard.getByRole("link", { name: "RSVP" }).click();
  await page.waitForURL(`**/e/${party.slug}?g=${partyToken}`);

  // "Coming up" on My registries lists it too, with Gil's reply, next to the
  // dinner Gil hosts.
  await page.goto("/dashboard");
  const comingUp = page.getByRole("region", { name: "Coming up" });
  const cards = comingUp.getByRole("listitem").getByRole("link");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveAccessibleName(new RegExp(`^Pool Party ${id}\\s*\\. 4 days to go\\..*You haven't replied`));
  await expect(cards.nth(0)).toHaveAttribute("href", `/e/${party.slug}?g=${partyToken}`);
  await expect(cards.nth(1)).toHaveAccessibleName(new RegExp(`^Gil's Dinner ${id}\\s*\\. 10 days to go\\.`));
  await expect(cards.nth(1)).toHaveAttribute("href", `/dashboard/events/${dinner.id}`);
});

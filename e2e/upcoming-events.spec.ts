// "Coming up" on the My registries tab: the soonest events, with the days
// left until each, so they're in view without opening the Events tab.

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createAccount, createWishlist, db, signIn, uniqueId } from "./fixtures";

/** YYYY-MM-DD in UTC, `days` from today, as the dashboard counts. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function createEvent(ownerId: string, title: string, eventDate: string | null) {
  const { data, error } = await db
    .from("events")
    .insert({ owner_id: ownerId, slug: `e2e-soon-${uniqueId()}`, title, event_type: "birthday", event_date: eventDate })
    .select("id, slug, title")
    .single();
  if (error) throw error;
  return data;
}

test("the dashboard shows the soonest events and the days left", async ({ page }) => {
  const host = await createAccount("Hal Host");
  const friend = await createAccount("Fern Friend");
  const id = uniqueId();

  const party = await createEvent(host.id, `Pool Party ${id}`, inDays(3));
  const dinner = await createEvent(host.id, `Birthday Dinner ${id}`, inDays(10));
  await createEvent(host.id, `Someday Picnic ${id}`, null);
  await createEvent(host.id, `Last Week's Brunch ${id}`, inDays(-7));
  const { error: guestError } = await db.from("event_guests").insert([
    { event_id: party.id, name: "Ana", token: randomUUID().replace(/-/g, ""), rsvp_status: "yes", party_size: 2 },
    { event_id: party.id, name: "Ben", token: randomUUID().replace(/-/g, ""), rsvp_status: "pending", party_size: 1 },
  ]);
  if (guestError) throw guestError;

  // A friend's event that links the host's wishlist celebrates the host.
  const { registry } = await createWishlist(host.id);
  const shower = await createEvent(friend.id, `Surprise Party ${id}`, inDays(5));
  const { error: linkError } = await db.from("event_registries").insert({ event_id: shower.id, registry_id: registry.id });
  if (linkError) throw linkError;

  await signIn(page, host);
  await page.goto("/dashboard");
  const comingUp = page.getByRole("region", { name: "Coming up" });
  const cards = comingUp.getByRole("listitem").getByRole("link");

  // Soonest first, at most three. No date and past events stay on the Events tab.
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAccessibleName(new RegExp(`^Pool Party ${id}\\s*\\. 3 days to go\\..*2 going · 1 no reply`));
  await expect(cards.nth(0)).toHaveAttribute("href", `/dashboard/events/${party.id}`);
  await expect(cards.nth(1)).toHaveAccessibleName(new RegExp(`^Surprise Party ${id}\\s*\\. 5 days to go\\..*Celebrating you`));
  await expect(cards.nth(1)).toHaveAttribute("href", `/e/${shower.slug}`);
  await expect(cards.nth(2)).toHaveAccessibleName(new RegExp(`^Birthday Dinner ${id}\\s*\\. 10 days to go\\.`));
  await expect(cards.nth(2)).toHaveAttribute("href", `/dashboard/events/${dinner.id}`);
  await expect(comingUp.getByText(/Someday Picnic|Last Week's Brunch/)).toHaveCount(0);

  await comingUp.getByRole("link", { name: "All events" }).click();
  await page.waitForURL(/\/dashboard\/events$/);
  await expect(page.getByText(`Someday Picnic ${id}`, { exact: true })).toBeVisible();
});

test("an account with no dated events sees no Coming up", async ({ page }) => {
  const owner = await createAccount("Maya Owner");
  await createEvent(owner.id, `Someday Picnic ${uniqueId()}`, null);
  await signIn(page, owner);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "No registries yet" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Coming up" })).toHaveCount(0);
});

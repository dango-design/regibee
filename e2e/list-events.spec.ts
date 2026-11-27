// A list's page shows the events the list is on.
//
// The owner's dashboard page lists every one: the ones whose hosts linked
// the list, and the ones where a guest added it as their wishlist.
//
// Someone else opening the list's link sees only the events both they and
// the list's owner are invited to, where neither said no. Each opens their
// own invitation, or the event's page for one they host.

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createAccount, createWishlist, db, signIn, uniqueId } from "./fixtures";

/** YYYY-MM-DD in UTC, `days` from today. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function createEvent(ownerId: string, title: string, eventDate: string) {
  const { data, error } = await db
    .from("events")
    .insert({ owner_id: ownerId, slug: `e2e-list-events-${uniqueId()}`, title, event_type: "birthday", event_date: eventDate })
    .select("id, slug, title")
    .single();
  if (error) throw error;
  return data;
}

async function linkList(eventId: string, registryId: string, linkedBy: string) {
  const { error } = await db.from("event_registries").insert({ event_id: eventId, registry_id: registryId, linked_by: linkedBy });
  if (error) throw error;
}

async function addGuest(
  eventId: string,
  guest: { name: string; email?: string | null; profile_id?: string; rsvp_status?: string; wishlist_registry_id?: string },
) {
  const token = randomUUID().replace(/-/g, "");
  const { error } = await db.from("event_guests").insert({ event_id: eventId, token, ...guest });
  if (error) throw error;
  return token;
}

test("a list shows its events to its owner, and to guests invited with the owner", async ({ page, browser }) => {
  const host = await createAccount("Hal Host");
  const olive = await createAccount("Olive Owner");
  const vera = await createAccount("Vera Visitor");
  const { registry } = await createWishlist(olive.id);
  const id = uniqueId();

  // Linked by the host. Olive said yes and Vera hasn't replied.
  const party = await createEvent(host.id, `Pool Party ${id}`, inDays(4));
  await linkList(party.id, registry.id, host.id);
  await addGuest(party.id, { name: "Olive", email: olive.email, rsvp_status: "yes" });
  const partyToken = await addGuest(party.id, { name: "Vera", profile_id: vera.id });

  // Vera hosts this one and linked the list. Olive said maybe.
  const dinner = await createEvent(vera.id, `Vera's Dinner ${id}`, inDays(6));
  await linkList(dinner.id, registry.id, vera.id);
  await addGuest(dinner.id, { name: "Olive", profile_id: olive.id, rsvp_status: "maybe" });

  // Olive added the list herself, as a guest's wishlist. Vera said yes.
  const swap = await createEvent(host.id, `Gift Swap ${id}`, inDays(8));
  await addGuest(swap.id, { name: "Olive", profile_id: olive.id, rsvp_status: "yes", wishlist_registry_id: registry.id });
  const swapToken = await addGuest(swap.id, { name: "Vera", email: vera.email, rsvp_status: "yes" });

  // Olive said no to this one.
  const recital = await createEvent(host.id, `Recital ${id}`, inDays(5));
  await linkList(recital.id, registry.id, host.id);
  await addGuest(recital.id, { name: "Olive", email: olive.email, rsvp_status: "no" });
  await addGuest(recital.id, { name: "Vera", email: vera.email, rsvp_status: "yes" });

  // Vera said no to this one.
  const hike = await createEvent(host.id, `Hike ${id}`, inDays(7));
  await linkList(hike.id, registry.id, host.id);
  await addGuest(hike.id, { name: "Olive", email: olive.email, rsvp_status: "yes" });
  await addGuest(hike.id, { name: "Vera", email: vera.email, rsvp_status: "no" });

  // Olive isn't invited to this one.
  const concert = await createEvent(host.id, `Concert ${id}`, inDays(9));
  await linkList(concert.id, registry.id, host.id);
  await addGuest(concert.id, { name: "Vera", email: vera.email, rsvp_status: "yes" });

  // Vera sees the three events both are on, soonest first.
  await signIn(page, vera);
  await page.goto(`/r/${registry.slug}`);
  await expect(page.getByText("Events with this list")).toBeVisible();
  const rows = page.locator("li", { hasText: id });
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText(`Pool Party ${id}`);
  await expect(rows.nth(0)).toContainText("You haven't replied");
  await expect(rows.nth(0).getByRole("link")).toHaveAttribute("href", `/e/${party.slug}?g=${partyToken}`);
  await expect(rows.nth(1)).toContainText(`Vera's Dinner ${id}`);
  await expect(rows.nth(1)).toContainText("You're hosting");
  await expect(rows.nth(1).getByRole("link")).toHaveAttribute("href", `/dashboard/events/${dinner.id}`);
  await expect(rows.nth(2)).toContainText(`Gift Swap ${id}`);
  await expect(rows.nth(2)).toContainText("You're going");
  await expect(rows.nth(2).getByRole("link")).toHaveAttribute("href", `/e/${swap.slug}?g=${swapToken}`);
  await expect(page.getByText(new RegExp(`Recital ${id}|Hike ${id}|Concert ${id}`))).toHaveCount(0);

  // Olive's dashboard page lists all six. Only the host-linked ones she
  // doesn't host can be unlinked there.
  const olivePage = await (await browser.newContext()).newPage();
  await signIn(olivePage, olive);
  await olivePage.goto(`/dashboard/registry/${registry.id}`);
  // Each event is one part of the card under the list's title.
  const ownerRows = olivePage.getByRole("list", { name: "About this list" }).locator("li", { hasText: id });
  await expect(ownerRows).toHaveCount(6);
  const swapRow = ownerRows.filter({ hasText: `Gift Swap ${id}` });
  // Olive added her list to the swap as a guest, and the part says so.
  await expect(swapRow).toContainText("Your wishlist for");
  await expect(swapRow.getByRole("button", { name: /Unlink/ })).toHaveCount(0);
  await expect(ownerRows.filter({ hasText: `Pool Party ${id}` }).getByRole("button", { name: /Unlink/ })).toHaveCount(1);

  // Signed out, there's no such notice.
  const signedOut = await (await browser.newContext()).newPage();
  await signedOut.goto(`/r/${registry.slug}`);
  await expect(signedOut.getByRole("heading", { name: registry.title })).toBeVisible();
  await expect(signedOut.getByText("Events with this list")).toHaveCount(0);
});

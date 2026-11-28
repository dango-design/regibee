// The new event form: "Plan an event" on a registry's page. It asks one step
// at a time, like the new registry form, and saves what each step set.

import { expect, test } from "@playwright/test";
import { createAccount, createWishlist, db, signIn } from "./fixtures";

test("planning an event from a registry goes step by step and saves each one", async ({ page }) => {
  const host = await createAccount("Hal Host");
  const { registry } = await createWishlist(host.id);

  await signIn(page, host);
  await page.goto(`/dashboard/events/new?registry=${registry.id}`);

  // Picking an occasion moves on to the name. A click that lands before the
  // page's scripts have loaded does nothing, so it's tried again.
  await expect(async () => {
    await page.getByRole("button", { name: "Birthday", exact: true }).click();
    await expect(page.getByRole("button", { name: /Name and date/, expanded: true })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByLabel("Event name").fill("Maya's 30th");
  // A whole date moves on to the time and place.
  await page.getByLabel("Date (optional)").fill("2027-05-01");
  const timeAndPlace = page.getByRole("region", { name: /Time and place/ });
  await expect(page.getByRole("button", { name: /Time and place/, expanded: true })).toBeVisible();
  await timeAndPlace.getByLabel("Starts").fill("18:00");
  await timeAndPlace.getByLabel("Place").fill("The Garden Room");
  await timeAndPlace.getByRole("button", { name: "Continue" }).click();

  // The invitation comes next, then gifts.
  await page.getByRole("region", { name: /Invitation/ }).getByRole("button", { name: "Skip" }).click();

  // The registry it came from is already linked.
  const gifts = page.getByRole("region", { name: /Gifts(?! among)/ });
  await expect(gifts.getByText(registry.title)).toBeVisible();
  await gifts.getByRole("button", { name: "Continue" }).click();

  // A birthday's guests don't give each other gifts, so that step isn't there.
  await expect(page.getByRole("button", { name: /Gifts among the guests/ })).toHaveCount(0);

  const rsvps = page.getByRole("region", { name: /RSVPs/ });
  await rsvps.getByText("Ask how many kids are coming").click();
  await rsvps.getByRole("button", { name: "Done" }).click();
  // Every step closes with a summary.
  await expect(page.getByRole("button", { name: /Time and place/ })).toContainText("6 PM");
  await expect(page.getByRole("button", { name: /Time and place/ })).toContainText("The Garden Room");

  await page.getByRole("button", { name: "Create event" }).click();
  await page.waitForURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);
  const eventId = page.url().split("/dashboard/events/")[1];
  const { data: event } = await db
    .from("events")
    .select("owner_id, event_type, title, event_date, start_time, location_name, ask_kids, open_rsvp, remind_day_before")
    .eq("id", eventId)
    .single();
  expect(event).toEqual({
    owner_id: host.id,
    event_type: "birthday",
    title: "Maya's 30th",
    event_date: "2027-05-01",
    start_time: "18:00:00",
    location_name: "The Garden Room",
    ask_kids: true,
    open_rsvp: true,
    remind_day_before: true,
  });
  const { data: links } = await db.from("event_registries").select("registry_id").eq("event_id", eventId);
  expect(links?.map((l) => l.registry_id)).toEqual([registry.id]);
});

test("a new event without a name opens its name step instead of saving", async ({ page }) => {
  const host = await createAccount("Hal Host");
  await signIn(page, host);
  await page.goto("/dashboard/events/new");

  await expect(async () => {
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText("Give your event a name.")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(page.getByLabel("Event name")).toBeFocused();
  const { count } = await db.from("events").select("id", { count: "exact", head: true }).eq("owner_id", host.id);
  expect(count).toBe(0);
});

// A host picks a color for their event's invitation (src/lib/event-colors.ts).
// Guests see it on the invitation, and None takes it away again.

import { expect, test } from "@playwright/test";
import { createAccount, db, signIn, uniqueId } from "./fixtures";

test("the host picks a color for the invitation, and guests see it", async ({ page, browser }) => {
  const host = await createAccount("Hal Host");
  const id = uniqueId();
  const { data: event, error } = await db
    .from("events")
    .insert({ owner_id: host.id, slug: `e2e-color-${id}`, title: `Max Turns 30 ${id}`, event_type: "birthday" })
    .select("id, slug")
    .single();
  if (error) throw error;

  // The host picks Lavender under the invitation picture.
  const hostPage = await (await browser.newContext()).newPage();
  await signIn(hostPage, host);
  await hostPage.goto(`/dashboard/events/${event.id}/edit`);
  const colors = hostPage.getByRole("group", { name: "Color" });
  await expect(async () => {
    await colors.getByRole("button", { name: "Lavender" }).click();
    await expect(colors.getByRole("button", { name: "Lavender" })).toHaveAttribute("aria-pressed", "true", {
      timeout: 1000,
    });
  }).toPass();
  await hostPage.getByRole("button", { name: "Save changes" }).click();
  await hostPage.waitForURL(`**/dashboard/events/${event.id}`);
  const { data: saved } = await db.from("events").select("theme_color").eq("id", event.id).single();
  expect(saved?.theme_color).toBe("#d9c8f0");

  // With no picture, the invitation's top takes the color.
  await page.goto(`/e/${event.slug}`);
  const top = page.getByText("Birthday", { exact: true }).locator("xpath=..");
  await expect(top).toHaveCSS("background-color", "rgb(217, 200, 240)");

  // None takes it away, and the occasion's colors come back.
  await hostPage.goto(`/dashboard/events/${event.id}/edit`);
  await expect(async () => {
    await colors.getByRole("button", { name: "None" }).click();
    await expect(colors.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass();
  await hostPage.getByRole("button", { name: "Save changes" }).click();
  await hostPage.waitForURL(`**/dashboard/events/${event.id}`);
  const { data: cleared } = await db.from("events").select("theme_color").eq("id", event.id).single();
  expect(cleared?.theme_color).toBeNull();
  await hostPage.context().close();
});

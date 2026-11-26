// "Invite people you follow" on an event's guest list. The host picks people
// who approved their follow instead of typing emails. Regibee emails each one
// the invitation at the email on their account, and the host sees that email
// only when the two follow each other (src/lib/guest-emails.ts).

import { expect, test, type Page } from "@playwright/test";
import { createAccount, db, signIn, uniqueId, waitForReact } from "./fixtures";
import { waitForEmail } from "./mailbox";

async function follow(followerId: string, followeeId: string) {
  const { error } = await db
    .from("follows")
    .insert({ follower_id: followerId, followee_id: followeeId, status: "approved", approved_at: new Date().toISOString() });
  if (error) throw error;
}

/** React Aria's checkbox hides its input, so this clicks the person's name beside it. */
async function choose(page: Page, name: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("listitem").filter({ hasText: name }).getByText(name, { exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: new RegExp(name) })).toBeChecked();
}

async function openGuestList(page: Page, eventId: string) {
  await page.goto(`/dashboard/events/${eventId}`);
  await expect(page.getByRole("heading", { name: "Add guests" })).toBeVisible();
}

test("a host invites people they follow, and sees only the emails of people who follow them back", async ({ page }) => {
  const host = await createAccount("Hal Host");
  const glinda = await createAccount("Glinda Upland");
  const oz = await createAccount("Oz Diggs");
  // Glinda and the host follow each other. Oz approved the host's follow but
  // doesn't follow back.
  await follow(host.id, glinda.id);
  await follow(glinda.id, host.id);
  await follow(host.id, oz.id);

  const title = `Holiday Party ${uniqueId()}`;
  const { data: event, error } = await db
    .from("events")
    .insert({ owner_id: host.id, slug: `e2e-follow-${uniqueId()}`, title, event_type: "holiday" })
    .select("id")
    .single();
  if (error) throw error;

  await signIn(page, host);
  await openGuestList(page, event.id);
  const open = page.getByRole("button", { name: "Invite people you follow" });
  await waitForReact(open);
  await open.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Glinda Upland", { exact: true })).toBeVisible();
  await expect(dialog.getByText("You follow each other")).toBeVisible();
  await expect(dialog.getByText("Their email stays private")).toBeVisible();
  await choose(page, "Glinda Upland");
  await choose(page, "Oz Diggs");
  await dialog.getByRole("button", { name: "Add 2 guests" }).click();
  await expect(dialog).toBeHidden();

  // Both are on the list with the email on their account, linked to it.
  const { data: rows } = await db.from("event_guests").select("name, email, profile_id").eq("event_id", event.id);
  expect(rows).toEqual(
    expect.arrayContaining([
      { name: "Glinda Upland", email: glinda.email, profile_id: glinda.id },
      { name: "Oz Diggs", email: oz.email, profile_id: oz.id },
    ]),
  );

  // The host sees Glinda's email, but not Oz's, anywhere on the page.
  const list = page.locator("section", { has: page.getByRole("heading", { name: "Guest list" }) });
  await expect(list.getByText(glinda.email)).toBeVisible();
  await expect(list.getByText(/Email private/)).toBeVisible();
  expect(await page.content()).not.toContain(oz.email);

  // Picking again shows them as already on the list.
  await page.getByRole("button", { name: "Invite people you follow" }).click();
  await expect(dialog.getByText("Already on the guest list")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // "Send invitations" reaches both, the private email included.
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByText("Email the invitation to 2 guests now?")).toBeVisible();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await waitForEmail(glinda.email, new RegExp(title));
  await waitForEmail(oz.email, new RegExp(title));

  // A group saved from the list keeps Oz's email private too.
  await page.getByRole("button", { name: "Save as a group" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save group" }).click();
  await page.waitForURL(/\/dashboard\/groups\//);
  await expect(page.getByText(glinda.email)).toBeVisible();
  await expect(page.getByText(/Email private/)).toBeVisible();
  expect(await page.content()).not.toContain(oz.email);
});

test("a host can rename a guest from a follow, but not change their email", async ({ page }) => {
  const host = await createAccount("Hal Host");
  const oz = await createAccount("Oz Diggs");
  await follow(host.id, oz.id);
  const { data: event, error } = await db
    .from("events")
    .insert({ owner_id: host.id, slug: `e2e-follow-${uniqueId()}`, title: `Brunch ${uniqueId()}`, event_type: "other" })
    .select("id")
    .single();
  if (error) throw error;

  await signIn(page, host);
  await openGuestList(page, event.id);
  const open = page.getByRole("button", { name: "Invite people you follow" });
  await waitForReact(open);
  await open.click();
  await choose(page, "Oz Diggs");
  await page.getByRole("dialog").getByRole("button", { name: "Add 1 guest" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Edit Oz Diggs" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Private to them. Invitations still reach it.")).toBeVisible();
  await dialog.getByRole("textbox", { name: "Name" }).fill("Uncle Oz");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Uncle Oz")).toBeVisible();

  const { data: guest } = await db.from("event_guests").select("name, email").eq("event_id", event.id).single();
  expect(guest).toEqual({ name: "Uncle Oz", email: oz.email });
});

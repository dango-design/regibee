// Account levels (see "Account levels" in CLAUDE.md): a basic account's
// emails to typed-in addresses stop at its daily limit, and the rest wait for
// another day. A star account near the basic limit isn't stopped.
//
// Each test starts its host near the limit by logging earlier sends, and
// removes them afterwards. Basic accounts share one daily allowance, so
// leftover rows would cut into other runs.

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createAccount, db, signIn, uniqueEmail, uniqueId } from "./fixtures";
import { emailsTo, waitForEmail } from "./mailbox";
import { DAILY_EMAILS } from "../src/lib/account-levels";

/** A party hosted by the given account, with three guests to invite. */
async function createParty(hostId: string) {
  const id = uniqueId();
  const { data: event, error } = await db
    .from("events")
    .insert({ owner_id: hostId, slug: `e2e-party-${id}`, title: `Juniper's Party ${id}`, event_type: "birthday" })
    .select("id, slug, title")
    .single();
  if (error) throw error;
  const guests = ["Ada", "Bo", "Cy"].map((name) => ({ name, email: uniqueEmail(name.toLowerCase()) }));
  const { error: guestError } = await db.from("event_guests").insert(
    guests.map((g) => ({ event_id: event.id, name: g.name, email: g.email, token: randomUUID().replace(/-/g, "") })),
  );
  if (guestError) throw guestError;
  return { event, guests };
}

/** Logs that the account already sent this many emails today. */
async function alreadySent(userId: string, level: "basic" | "star", emails: number) {
  const { error } = await db.from("email_sends").insert({ user_id: userId, level, kind: "invitation", emails });
  if (error) throw error;
}

async function sentToday(userId: string): Promise<number> {
  const { data, error } = await db.from("email_sends").select("emails").eq("user_id", userId);
  if (error) throw error;
  return data.reduce((sum, row) => sum + row.emails, 0);
}

test("a basic account's invitations stop at the daily limit, and the rest wait", async ({ page }) => {
  const host = await createAccount("Basil Host", { star: false });
  try {
    await alreadySent(host.id, "basic", DAILY_EMAILS.basic - 2);
    const { event, guests } = await createParty(host.id);

    await signIn(page, host);
    await page.goto(`/dashboard/events/${event.id}`);
    await page.getByRole("button", { name: "Send invitations" }).click();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByText("Sent to 2 guests. You've reached today's limit for emails, so send to the other 1 tomorrow."),
    ).toBeVisible();

    // Two got theirs. The third is still uninvited, and got nothing.
    const { data: uninvited } = await db
      .from("event_guests")
      .select("email")
      .eq("event_id", event.id)
      .is("invited_at", null);
    expect(uninvited).toHaveLength(1);
    const waiting = uninvited![0].email as string;
    for (const guest of guests.filter((g) => g.email !== waiting)) {
      await waitForEmail(guest.email, `You're invited: ${event.title}`);
    }
    expect(await emailsTo(waiting)).toHaveLength(0);
    expect(await sentToday(host.id)).toBe(DAILY_EMAILS.basic);

    // With nothing left, the button sends nothing.
    await page.reload();
    await page.getByRole("button", { name: "Send invitations" }).click();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("You've reached today's limit for emails. Try again tomorrow.")).toBeVisible();
    expect(await emailsTo(waiting)).toHaveLength(0);
  } finally {
    await db.from("email_sends").delete().eq("user_id", host.id);
  }
});

test("a star account isn't held to the basic limit", async ({ page }) => {
  const host = await createAccount("Stella Host");
  try {
    await alreadySent(host.id, "star", DAILY_EMAILS.basic - 2);
    const { event, guests } = await createParty(host.id);

    await signIn(page, host);
    await page.goto(`/dashboard/events/${event.id}`);
    await page.getByRole("button", { name: "Send invitations" }).click();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    for (const guest of guests) await waitForEmail(guest.email, `You're invited: ${event.title}`);
    expect(await sentToday(host.id)).toBe(DAILY_EMAILS.basic + 1);
  } finally {
    await db.from("email_sends").delete().eq("user_id", host.id);
  }
});

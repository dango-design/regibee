// The event flow, start to finish: a host plans a birthday, adds guests and
// sends the invitations; guests open their links and reply; the host sees
// the replies, messages the guests and changes the time; and the day before,
// everyone going gets a reminder. Every step is saved as a screenshot, the
// emails included.
//
// The host is on a laptop. Guests are on a phone, since most open the
// invitation from an email or a text.

import { devices, expect, test, type Page } from "@playwright/test";
import { chooseOption, CRON_SECRET, createAccount, createWishlist, db, signIn, uniqueEmail, waitForReact } from "../fixtures";
import { linkIn, waitForEmail } from "../mailbox";
import { dateIn, nextDate } from "../../src/lib/event-updates";
import { FlowCapture } from "./capture";

const ZONE = "America/Los_Angeles";
const TITLE = "Maya's 30th Birthday";

test.use({ deviceScaleFactor: 2, timezoneId: ZONE, locale: "en-US" });

/** Picks an RSVP answer. A click before the page's scripts load does nothing, so it's tried again. */
async function answer(page: Page, label: string) {
  await expect(async () => {
    await page.getByRole("button", { name: label }).click();
    await expect(page.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass();
}

test("event hosting flow", async ({ page, browser }) => {
  test.setTimeout(600_000);
  const flow = new FlowCapture(
    "event-hosting",
    "Event hosting flow",
    "A host plans a birthday, invites four guests and keeps them up to date. The guests reply from their own links.",
  );
  flow.notes({
    notCovered: [
      "Other occasions: a wedding's meal and plus-one questions, a Secret Santa and its name draw, a meal train.",
      "Co-hosts, and the sign-up sheet for what guests bring.",
      "Adding guests from a pasted list, a group, another event or the people the host follows.",
      "A guest who replies from the event's public link, with no link of their own.",
      "A guest changing their answer, and the host's reminder to guests who haven't replied.",
      "The phone app.",
    ],
  });
  const HOST = "Maya (host)";

  // Who's in it. Cara has a Regibee account; the other guests don't.
  const host = await createAccount("Maya Chen");
  const cara = await createAccount("Cara Lind");
  const annEmail = uniqueEmail("ann");
  const benEmail = uniqueEmail("ben");
  const { registry } = await createWishlist(host.id);
  await db.from("registries").update({ title: "Maya's Birthday Wishlist", event_type: "birthday" }).eq("id", registry.id);
  await db.from("registry_items").update({ title: "Wool Scarf" }).eq("registry_id", registry.id);
  await db.from("registry_items").insert([
    { registry_id: registry.id, title: "Pour-over Coffee Set", price: 68, quantity_needed: 1 },
    { registry_id: registry.id, title: "Hiking Daypack", price: 95, quantity_needed: 1 },
  ]);

  const phone = async () => {
    const context = await browser.newContext({ ...devices["Pixel 7"], deviceScaleFactor: 2, timezoneId: ZONE, locale: "en-US" });
    return context.newPage();
  };

  // ── The host plans the event ────────────────────────────────────────────
  flow.phase("Plan the event", "The host fills in the new event form, one step at a time.");
  await signIn(page, host);
  await page.goto("/dashboard/events");
  await flow.page(page, {
    id: "events-tab-empty",
    trigger: "Maya opens the Events tab",
    lane: "host",
    who: HOST,
    title: "Events tab, before any event",
    note: "Where a host starts. Nothing is planned yet.",
  });

  await page.goto(`/dashboard/events/new?registry=${registry.id}`);
  await waitForReact(page.getByRole("button", { name: "Birthday", exact: true }));
  await flow.page(page, {
    id: "new-event-occasion",
    via: "New",
    lane: "host",
    who: HOST,
    title: "New event: pick the occasion",
    note: "The form asks one step at a time. Maya came from her wishlist, so it's already linked.",
  });

  await expect(async () => {
    await page.getByRole("button", { name: "Birthday", exact: true }).click();
    await expect(page.getByRole("button", { name: /Name and date/, expanded: true })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByLabel("Event name").fill(TITLE);
  await page.getByLabel("Date (optional)").fill("2027-05-01");
  const timeAndPlace = page.getByRole("region", { name: /Time and place/ });
  await expect(page.getByRole("button", { name: /Time and place/, expanded: true })).toBeVisible();
  await timeAndPlace.getByLabel("Starts").fill("18:00");
  await timeAndPlace.getByLabel("Place").fill("The Garden Room");
  await flow.page(page, {
    id: "new-event-time-place",
    via: "Birthday",
    focus: timeAndPlace,
    lane: "host",
    who: HOST,
    title: "New event: name, date, time and place",
    note: "A whole date moves on to the time and place. Each finished step closes to a one-line summary.",
  });
  await timeAndPlace.getByRole("button", { name: "Continue" }).click();

  const gifts = page.getByRole("region", { name: /Gifts(?! among)/ });
  await expect(gifts.getByText("Maya's Birthday Wishlist")).toBeVisible();
  await flow.page(page, {
    id: "new-event-gifts",
    via: "Continue",
    focus: gifts,
    lane: "host",
    who: HOST,
    title: "New event: gifts",
    note: "What guests will see about gifts. The wishlist she came from is linked.",
  });
  await gifts.getByRole("button", { name: "Continue" }).click();

  const invitation = page.getByRole("region", { name: /Invitation/ });
  await expect(invitation.getByRole("button", { name: "Skip" })).toBeVisible();
  await flow.page(page, {
    id: "new-event-invitation",
    via: "Continue",
    focus: invitation,
    lane: "host",
    who: HOST,
    title: "New event: invitation",
    note: "A picture and colors for the invitation. Maya skips it.",
  });
  await invitation.getByRole("button", { name: "Skip" }).click();

  const rsvps = page.getByRole("region", { name: /RSVPs/ });
  await chooseOption(rsvps, /People per RSVP/, "2");
  await flow.page(page, {
    id: "new-event-rsvps",
    via: "Skip",
    focus: rsvps,
    lane: "host",
    who: HOST,
    title: "New event: RSVPs",
    note: "Who can reply, how many people each guest can bring, and which emails go out. Maya lets each guest bring one person.",
  });
  await rsvps.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Create event" }).click();
  await page.waitForURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);
  const eventId = page.url().split("/dashboard/events/")[1];
  const another = page.getByRole("button", { name: "Add another guest" });
  await waitForReact(another);
  await flow.page(page, {
    id: "event-page-new",
    via: "Create event",
    lane: "host",
    who: HOST,
    title: "The event's page, just created",
    note: "The host's home for this event: the link to share, the guest list and the RSVPs. No guests yet.",
  });

  // ── The host adds guests and sends the invitations ──────────────────────
  flow.phase("Invite the guests", "The host adds guests and emails each one their own RSVP link.");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Ann Rivera");
  await page.getByRole("textbox", { name: "Email (optional)" }).fill(annEmail);
  await another.click();
  await page.getByRole("textbox", { name: "Guest 2 name" }).fill("Ben Okafor");
  await page.getByRole("textbox", { name: "Guest 2 email" }).fill(benEmail);
  await another.click();
  await page.getByRole("textbox", { name: "Guest 3 name" }).fill("Cara Lind");
  await page.getByRole("textbox", { name: "Guest 3 email" }).fill(cara.email);
  await another.click();
  // Dev has no email address: Maya will text him his link.
  await page.getByRole("textbox", { name: "Guest 4 name" }).fill("Dev Patel");
  await page.getByRole("button", { name: "Add 4 guests" }).click();
  await expect(page.getByText("Dev Patel", { exact: true })).toBeVisible();
  await expect(page.getByText(/haven't been sent the invitation/)).toBeVisible();
  await flow.page(page, {
    id: "guests-added",
    via: "Add 4 guests",
    lane: "host",
    who: HOST,
    title: "Four guests added",
    note: "Three have an email address. Dev doesn't, so Maya will copy his RSVP link and text it to him.",
  });

  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByText(/Email the invitation to 3 guests now\?/)).toBeVisible();
  await flow.page(page, {
    id: "send-invitations-confirm",
    via: "Send invitations",
    lane: "host",
    who: HOST,
    title: "Send invitations: confirm",
    note: "The site asks before it emails anyone, and says where replies to the email will go.",
  });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const inviteEmail = await waitForEmail(annEmail, /./);
  await expect(page.getByText(/replied yet/)).toBeVisible();
  await flow.page(page, {
    id: "invitations-sent",
    via: "Send",
    lane: "host",
    who: HOST,
    title: "Invitations sent",
    note: "Each guest with an email is marked as invited. From here Maya can remind the ones who haven't replied.",
  });

  await flow.email(browser, inviteEmail, {
    id: "email-invitation",
    via: "One email per guest",
    who: "Ann (guest)",
    title: "Email: the invitation",
    note: "Each guest gets their own RSVP link. Replies to the email go to the host.",
  });

  // ── Guests open their links and reply ───────────────────────────────────
  flow.phase("Guests reply", "Each guest opens their link and answers. No account is needed.");
  const { data: guestRows } = await db.from("event_guests").select("name, token").eq("event_id", eventId);
  const { data: eventRow } = await db.from("events").select("slug").eq("id", eventId).single();
  const linkFor = (name: string) => `/e/${eventRow!.slug}?g=${guestRows!.find((g) => g.name === name)!.token}`;

  const annPage = await phone();
  await annPage.goto(linkIn(inviteEmail, /\/e\//));
  await waitForReact(annPage.getByRole("button", { name: "Going" }));
  await flow.page(annPage, {
    id: "guest-invitation",
    via: "RSVP",
    lane: "guest",
    who: "Ann (guest)",
    title: "The invitation, from the email's link",
    note: "No account or sign-in. The link knows who Ann is, so the page greets her by name.",
  });

  await answer(annPage, "Going");
  await chooseOption(annPage, "How many people, including you?", "2");
  await annPage.getByLabel("Note to the host (optional)").fill("Can't wait! Bringing my partner, Sam.");
  await flow.page(annPage, {
    id: "guest-rsvp-form",
    via: "Going",
    focus: annPage.getByRole("button", { name: "Send RSVP" }),
    lane: "guest",
    who: "Ann (guest)",
    title: "Ann fills in her RSVP",
    note: "Going, two people, and a note to the host.",
  });
  await annPage.getByRole("button", { name: "Send RSVP" }).click();
  await expect(annPage.getByRole("heading", { name: /You're going/ })).toBeVisible();
  await flow.page(annPage, {
    id: "guest-rsvp-going",
    via: "Send RSVP",
    lane: "guest",
    who: "Ann (guest)",
    title: "Reply sent: going",
    note: "The page now shows her answer, with a way to change it, and the wishlist to shop from.",
  });

  const goingEmail = await waitForEmail(annEmail, /^You're going to /);
  await flow.email(browser, goingEmail, {
    id: "email-rsvp-confirmation",
    via: "To the guest",
    who: "Ann (guest)",
    title: "Email: Ann's confirmation",
    note: "Sent to the guest right after she replies.",
  });
  const hostNotice = await waitForEmail(host.email, /Ann Rivera is going to /);
  await flow.email(browser, hostNotice, {
    id: "email-host-notice",
    after: "guest-rsvp-going",
    via: "To the host",
    who: HOST,
    title: "Email: the host hears about it",
    note: "Sent to the host for each reply, unless she turned that off in the RSVPs step.",
  });

  const benPage = await phone();
  await benPage.goto(linkFor("Ben Okafor"));
  await answer(benPage, "Can't go");
  await benPage.getByLabel("Note to the host (optional)").fill("So sorry, I'm away that weekend. Happy birthday!");
  await benPage.getByRole("button", { name: "Send RSVP" }).click();
  await expect(benPage.getByRole("button", { name: "Send RSVP" })).toBeHidden();
  await flow.page(benPage, {
    id: "guest-rsvp-cant-go",
    after: "email-invitation",
    via: "Ben: Can't go",
    lane: "guest",
    who: "Ben (guest)",
    title: "Reply sent: can't go",
    note: "The other branch. Ben says no and leaves a note.",
  });

  const devPage = await phone();
  await devPage.goto(linkFor("Dev Patel"));
  await answer(devPage, "Maybe");
  await devPage.getByRole("button", { name: "Send RSVP" }).click();
  await expect(devPage.getByRole("button", { name: "Send RSVP" })).toBeHidden();
  await flow.page(devPage, {
    id: "guest-rsvp-maybe",
    after: "guests-added",
    via: "Dev: link sent by text, Maybe",
    lane: "guest",
    who: "Dev (guest)",
    title: "Reply sent: maybe",
    note: "Dev opened the link Maya texted him. With no email address, he gets no emails, so updates show on this page.",
  });

  // Cara has an account, so the invitation is also in her Events tab.
  const caraPage = await (await browser.newContext({ deviceScaleFactor: 2, timezoneId: ZONE, locale: "en-US", viewport: { width: 1280, height: 720 } })).newPage();
  await signIn(caraPage, cara);
  await caraPage.goto("/dashboard/events");
  await expect(caraPage.getByRole("region", { name: "Invited" })).toBeVisible();
  await flow.page(caraPage, {
    id: "guest-events-tab-invited",
    after: "guests-added",
    via: "Cara: has an account",
    lane: "guest",
    who: "Cara (guest with an account)",
    title: "A guest with an account: Events tab",
    note: "Cara was invited at her account's email, so the event is listed under Invited with an RSVP button. She hasn't replied.",
  });
  await caraPage.context().close();

  // ── The host sees the replies and keeps guests up to date ───────────────
  flow.phase("Keep guests up to date", "The host reads the replies, sends a message and changes the time.");
  await page.reload();
  await expect(page.getByText("Can't wait! Bringing my partner, Sam.")).toBeVisible();
  await flow.page(page, {
    id: "host-sees-rsvps",
    after: "email-host-notice",
    via: "See your guest list",
    lane: "host",
    who: HOST,
    title: "The replies come in",
    note: "Counts at the top, then each guest with their answer and note. Cara still hasn't replied.",
  });

  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Message everyone going" }).click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  await dialog.getByRole("textbox", { name: "Message" }).fill("Parking is behind the building. Come in through the side gate.");
  await flow.page(page, {
    id: "host-message-dialog",
    via: "Message everyone going",
    focus: dialog,
    lane: "host",
    who: HOST,
    title: "Message the guests",
    note: "The host picks who gets it (everyone going, by default) and writes a message.",
  });
  await dialog.getByRole("button", { name: /^Send to \d+ guests?$/ }).click();
  await expect(dialog).toBeHidden();
  const messageEmail = await waitForEmail(annEmail, /^About /);
  await flow.email(browser, messageEmail, {
    id: "email-host-message",
    via: "Send to 1 guest",
    who: "Ann (guest)",
    title: "Email: the host's message",
    note: "From the host's name, and a reply goes straight to her.",
  });

  await page.goto(`/dashboard/events/${eventId}/edit`);
  await expect(async () => {
    await page.getByLabel("Starts").fill("19:00");
    await expect(page.getByRole("checkbox", { name: /Email guests about the new time/ })).toBeChecked({ timeout: 1000 });
  }).toPass();
  await flow.page(page, {
    id: "host-edit-time",
    after: "host-sees-rsvps",
    via: "Edit",
    focus: page.getByRole("checkbox", { name: /Email guests about the new time/ }),
    lane: "host",
    who: HOST,
    title: "The host changes the time",
    note: "Changing the time, date or place adds a ticked box near Save: email the guests about it.",
  });
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(`**/dashboard/events/${eventId}`);
  const newTimeEmail = await waitForEmail(annEmail, /^New time: /);
  await flow.email(browser, newTimeEmail, {
    id: "email-new-time",
    via: "Save changes",
    who: "Ann (guest)",
    title: "Email: new time",
    note: "Goes to everyone who might come: going, maybe, and invited but not replied. Not to guests who said no.",
  });

  await devPage.reload();
  await expect(devPage.getByRole("region", { name: "Updates from the host" })).toBeVisible();
  await flow.page(devPage, {
    id: "guest-sees-updates",
    after: "host-edit-time",
    via: "Also posted on the invitation",
    focus: devPage.getByRole("region", { name: "Updates from the host" }),
    lane: "guest",
    who: "Dev (guest)",
    title: "Updates on the invitation",
    note: "The new time is posted on the invitation, so a guest with no email address still sees it.",
  });

  // ── The day before ──────────────────────────────────────────────────────
  flow.phase("The day before", "Everyone going gets one reminder.");
  // Time passes: the party is tomorrow.
  const tomorrow = nextDate(dateIn(ZONE));
  const { error: dateError } = await db.from("events").update({ event_date: tomorrow }).eq("id", eventId);
  if (dateError) throw dateError;
  const reminders = await page.request.get("/api/cron/event-reminders", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(reminders.status()).toBe(200);
  const reminderEmail = await waitForEmail(annEmail, /^Tomorrow: /);
  await flow.email(browser, reminderEmail, {
    id: "email-reminder",
    trigger: "A daily job, the day before the event",
    who: "Ann (guest)",
    title: "Email: reminder the day before",
    note: "A daily job sends it to everyone going, once, with the time and place.",
  });

  await page.goto("/dashboard/events");
  await expect(page.getByText(TITLE).first()).toBeVisible();
  await flow.page(page, {
    id: "events-tab-with-event",
    trigger: "Maya opens the Events tab",
    lane: "host",
    who: HOST,
    title: "Events tab, the day before",
    note: "The event is listed under Hosting with its date and how many are going.",
  });
});

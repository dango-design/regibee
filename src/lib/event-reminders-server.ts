// Server-only: the daily jobs for events. Vercel Cron calls
// /api/cron/event-reminders once a day (vercel.json). They send:
//
// - the reminder the day before, to everyone going (#100)
// - one RSVP reminder, 3 days before the reply-by date, to invited guests
//   who haven't replied, unless the host turned it off
// - a gift exchange reminder to each Secret Santa before the event
//
// Each is sent once per date: a *_for column holds the date it was sent for,
// so moving the date sends another. These emails count against no allowance,
// like the other daily emails (see "Account levels" in CLAUDE.md).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getEventRegistries, getGiftExchange, getSignupSheet } from "@/lib/events-server";
import { sendDayBeforeReminders, sendEventInvitations } from "@/lib/email";
import { sendExchangeAssignments } from "@/lib/event-email";
import { addDays, isDaysBefore, isTomorrowFor } from "@/lib/event-updates";
import { claimsByGuest, describeClaim } from "@/lib/signups";
import type { EventDetails, EventGuest, GiftExchange } from "@/lib/events";

export interface ReminderJobResult {
  /** Events that got a reminder. */
  events: number;
  /** Emails sent. */
  emails: number;
}

export async function processEventReminders(now: Date = new Date()): Promise<ReminderJobResult> {
  // An event is tomorrow somewhere between yesterday and two days from now in
  // UTC, whatever its time zone. isTomorrowFor settles it in the event's zone.
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("remind_day_before", true)
    .gte("event_date", from)
    .lte("event_date", to);
  const due = ((data || []) as (EventDetails & { reminded_for: string | null })[]).filter(
    (event) => isTomorrowFor(event, now) && event.reminded_for !== event.event_date,
  );

  const result: ReminderJobResult = { events: 0, emails: 0 };
  for (const event of due) {
    // A mailed gift exchange has no get-together to remind anyone about.
    const exchange = await getGiftExchange(event.id);
    if (exchange?.mailed) continue;

    // Claim the reminder first, so two runs can't both send it.
    const { data: claimed } = await supabaseAdmin
      .from("events")
      .update({ reminded_for: event.event_date })
      .eq("id", event.id)
      .or(`reminded_for.is.null,reminded_for.neq.${event.event_date}`)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const { data: guestRows } = await supabaseAdmin
      .from("event_guests")
      .select("id, name, email, token, party_size")
      .eq("event_id", event.id)
      .eq("rsvp_status", "yes")
      .not("email", "is", null);
    const guests = (guestRows || []) as (Pick<EventGuest, "id" | "name" | "token" | "party_size"> & { email: string })[];
    if (guests.length === 0) continue;

    const [registries, sheet, hostName, owner] = await Promise.all([
      getEventRegistries(event.id),
      getSignupSheet(event.id),
      hostNameOf(event),
      supabaseAdmin.auth.admin.getUserById(event.owner_id),
    ]);
    const claims = sheet ? claimsByGuest(sheet) : new Map();
    const sent = await sendDayBeforeReminders({
      event,
      registries,
      hostName,
      replyTo: owner.data.user?.email ?? null,
      guests: guests.map((g) => ({
        name: g.name,
        email: g.email,
        token: g.token,
        signups: (claims.get(g.id) ?? []).map(describeClaim),
      })),
    });
    if (sent > 0) {
      await supabaseAdmin.from("event_messages").insert({
        event_id: event.id,
        sent_by: null,
        kind: "reminder",
        audience: "going",
        subject: `Tomorrow: ${event.title}`.slice(0, 150),
        recipients: sent,
      });
      result.events += 1;
      result.emails += sent;
    }
  }
  return result;
}

async function hostNameOf(event: EventDetails): Promise<string> {
  if (event.hosted_by) return event.hosted_by;
  const { data } = await supabaseAdmin.from("profiles").select("full_name").eq("id", event.owner_id).single();
  return data?.full_name?.trim() || "Your host";
}

/** Days before the reply-by date that guests who haven't replied get a reminder. */
export const RSVP_REMINDER_DAYS = 3;

/** A host's manual reminder within this long means the automatic one skips that guest. */
const RECENT_REMINDER_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * One reminder, RSVP_REMINDER_DAYS before the reply-by date, to the invited
 * guests who haven't replied. The same email as the host's Remind button.
 */
export async function processRsvpReminders(now: Date = new Date()): Promise<ReminderJobResult> {
  const today = now.toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("auto_rsvp_reminder", true)
    .gte("rsvp_by", addDays(today, RSVP_REMINDER_DAYS - 1))
    .lte("rsvp_by", addDays(today, RSVP_REMINDER_DAYS + 1));
  const due = ((data || []) as (EventDetails & { rsvp_reminded_for: string | null })[]).filter(
    (event) =>
      isDaysBefore(event.rsvp_by, RSVP_REMINDER_DAYS, event.time_zone, now) && event.rsvp_reminded_for !== event.rsvp_by,
  );

  const result: ReminderJobResult = { events: 0, emails: 0 };
  for (const event of due) {
    const { data: claimed } = await supabaseAdmin
      .from("events")
      .update({ rsvp_reminded_for: event.rsvp_by })
      .eq("id", event.id)
      .or(`rsvp_reminded_for.is.null,rsvp_reminded_for.neq.${event.rsvp_by}`)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const { data: guestRows } = await supabaseAdmin
      .from("event_guests")
      .select("id, name, email, token, reminded_at")
      .eq("event_id", event.id)
      .eq("rsvp_status", "pending")
      .not("invited_at", "is", null)
      .not("email", "is", null);
    const guests = ((guestRows || []) as { name: string; email: string; token: string; reminded_at: string | null }[]).filter(
      (g) => !g.reminded_at || now.getTime() - Date.parse(g.reminded_at) >= RECENT_REMINDER_MS,
    );
    if (guests.length === 0) continue;

    const [registries, exchange, sheet, hostName, owner] = await Promise.all([
      getEventRegistries(event.id),
      getGiftExchange(event.id),
      getSignupSheet(event.id),
      hostNameOf(event),
      supabaseAdmin.auth.admin.getUserById(event.owner_id),
    ]);
    const { sentTokens } = await sendEventInvitations({
      event,
      registries,
      exchange,
      signupTitle: sheet?.sheet.title ?? null,
      hostName,
      replyTo: owner.data.user?.email ?? null,
      guests,
      reminder: true,
    });
    if (sentTokens.length > 0) {
      await supabaseAdmin
        .from("event_guests")
        .update({ reminded_at: now.toISOString() })
        .eq("event_id", event.id)
        .in("token", sentTokens);
      result.events += 1;
      result.emails += sentTokens.length;
    }
  }
  return result;
}

/** Days before the event each Secret Santa is reminded: more when gifts are mailed. */
export function exchangeReminderDays(mailed: boolean): number {
  return mailed ? 7 : 3;
}

/**
 * Reminds each Secret Santa to get their gift, a few days before the event,
 * with their person's latest wishlist. Once per event date.
 */
export async function processExchangeReminders(now: Date = new Date()): Promise<ReminderJobResult> {
  const today = now.toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("events")
    .select("*")
    .gte("event_date", addDays(today, 1))
    .lte("event_date", addDays(today, 9));
  const result: ReminderJobResult = { events: 0, emails: 0 };
  for (const event of (data || []) as (EventDetails & { exchange_reminded_for: string | null })[]) {
    if (event.exchange_reminded_for === event.event_date) continue;
    const exchange = (await getGiftExchange(event.id)) as GiftExchange | null;
    if (!exchange?.drawn_at || exchange.kind === "everyone") continue;
    const days = exchangeReminderDays(exchange.mailed);
    if (!isDaysBefore(event.event_date, days, event.time_zone, now)) continue;

    const { data: claimed } = await supabaseAdmin
      .from("events")
      .update({ exchange_reminded_for: event.event_date })
      .eq("id", event.id)
      .or(`exchange_reminded_for.is.null,exchange_reminded_for.neq.${event.event_date}`)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const { data: guestRows } = await supabaseAdmin
      .from("event_guests")
      .select("*")
      .eq("event_id", event.id)
      .eq("in_exchange", true);
    const guests = (guestRows || []) as EventGuest[];
    const byId = new Map(guests.map((g) => [g.id, g]));
    const pairs = guests
      .filter((g) => g.email && g.giftee_id && byId.has(g.giftee_id))
      .map((g) => ({ giver: g as EventGuest & { email: string }, giftee: byId.get(g.giftee_id!)! }));
    if (pairs.length === 0) continue;

    const [hostName, owner] = await Promise.all([hostNameOf(event), supabaseAdmin.auth.admin.getUserById(event.owner_id)]);
    await sendExchangeAssignments({
      event,
      exchange,
      hostName,
      replyTo: owner.data.user?.email ?? null,
      redraw: false,
      reason: "reminder",
      daysLeft: days,
      pairs,
    });
    result.events += 1;
    result.emails += pairs.length;
  }
  return result;
}


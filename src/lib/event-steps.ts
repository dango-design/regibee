// A new event's steps: which ones there are, what they're called, and the
// line each shows once it's closed. The website's event form
// (src/components/event-form.tsx) and the phone app's
// (mobile/src/app/event-form.tsx) both use them, so the steps and their words
// match. Editing an event shows every section at once instead.
//
// The phone app shares this file, so it only imports other shared files.

import { EXCHANGE_KINDS, formatEventTime } from "./events";
import { offersGiftExchange, usuallyHasGifts } from "./occasions";
import { hidesAddressUntilSignup } from "./signups";
import { formatStepDate, type StepInfo } from "./step-nav";

export type EventStepId = "what" | "details" | "when" | "gifts" | "exchange" | "invitation" | "rsvps";

/** What the steps need to know about the event so far. */
export interface EventStepValues {
  eventType: string;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  locationName: string;
  locationAddress: string;
  /** The titles of the lists the event links. */
  linkedTitles: string[];
  giftNote: string;
  exchangeOn: boolean;
  exchangeKind: string;
  budget: string;
  hasPicture: boolean;
  hostedBy: string;
  message: string;
  maxPartySize: number;
  openRsvp: boolean;
  rsvpBy: string;
}

/**
 * The steps, in order. Only the name is required. The invitation comes right
 * after the time and place, since that's the page guests open.
 *
 * Gifts come next only for occasions where guests usually bring them, like a
 * baby shower or a birthday (usuallyHasGifts). For the rest, like a potluck
 * or a game night, gifts are the last step, after the RSVPs. Gifts among the
 * guests only comes up for occasions that might have them, or once it's on.
 */
export function newEventSteps(eventType: string, exchangeOn: boolean): EventStepId[] {
  const exchange = exchangeOn || offersGiftExchange(eventType) ? (["exchange"] as const) : [];
  if (usuallyHasGifts(eventType)) {
    return ["what", "details", "when", "invitation", "gifts", ...exchange, "rsvps"];
  }
  return ["what", "details", "when", "invitation", "rsvps", "gifts", ...exchange];
}

export function eventStepTitle(id: EventStepId, eventType: string): string {
  switch (id) {
    case "what":
      return "What's the occasion?";
    case "details":
      return "Name and date";
    case "when":
      // A meal train's address is where meals are dropped off.
      return hidesAddressUntilSignup(eventType) ? "Time and drop-off" : "Time and place";
    case "gifts":
      return "Gifts";
    case "exchange":
      return "Gifts among the guests";
    case "invitation":
      return "Invitation";
    case "rsvps":
      return "RSVPs";
  }
}

export function eventStepInfo(values: EventStepValues): Record<EventStepId, StepInfo> {
  const named = Boolean(values.title.trim());
  return {
    what: { complete: true, optional: false, hasContent: true },
    details: { complete: named, optional: false, hasContent: named },
    when: {
      complete: true,
      optional: true,
      hasContent: Boolean(values.startTime || values.endTime || values.locationName.trim() || values.locationAddress.trim()),
    },
    gifts: { complete: true, optional: true, hasContent: values.linkedTitles.length > 0 || Boolean(values.giftNote.trim()) },
    exchange: { complete: true, optional: true, hasContent: values.exchangeOn },
    invitation: {
      complete: true,
      optional: true,
      hasContent: values.hasPicture || Boolean(values.hostedBy.trim() || values.message.trim()),
    },
    // The RSVP settings start with the occasion's own, so there's always something.
    rsvps: { complete: true, optional: false, hasContent: true },
  };
}

/**
 * The line under each step's title once it's closed. The name step's is empty
 * while the event has no name: the form says "Needs a name" instead. The RSVP
 * step's shows even before the host opens it, since it's what they get if
 * they skip it.
 */
export function eventStepSummaries(values: EventStepValues, occasionLabel: string): Record<EventStepId, string> {
  const time = formatEventTime({
    event_date: values.eventDate || null,
    start_time: values.startTime || null,
    end_time: values.endTime || null,
    time_zone: values.timeZone || null,
  });
  const place = hidesAddressUntilSignup(values.eventType)
    ? values.locationAddress.trim() && "Drop-off address added"
    : values.locationName.trim() || values.locationAddress.trim().split("\n")[0];
  const people = values.maxPartySize;
  const join = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" · ");

  return {
    what: occasionLabel,
    details: values.title.trim() ? join([values.title.trim(), values.eventDate && formatStepDate(values.eventDate)]) : "",
    when: join([time, place]) || "Skipped",
    gifts: join([values.linkedTitles.join(", "), values.giftNote.trim()]) || "Skipped",
    exchange: values.exchangeOn
      ? join([
          EXCHANGE_KINDS.find((k) => k.value === values.exchangeKind)?.label,
          values.budget.trim() && `${values.budget.trim()} budget`,
        ])
      : "Skipped",
    invitation: join([values.hasPicture && "Picture", values.hostedBy.trim() && `Hosted by ${values.hostedBy.trim()}`, values.message.trim()]) || "Skipped",
    rsvps: join([
      `${people === 1 ? "1 person" : `${people} people`} per RSVP`,
      values.openRsvp ? "anyone with the link can RSVP" : "invited guests only",
      values.rsvpBy && `reply by ${formatStepDate(values.rsvpBy)}`,
    ]),
  };
}

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DashboardEvent } from "@/lib/dashboard-page-types";
import { eventTheme, formatShortEventDate, MY_RSVP_LABELS, rsvpStatsText, type EventType } from "@/lib/events";
import { countdownLabel, daysUntil } from "@/lib/occasions";
import { cx } from "@/lib/utils/cx";

/** How many days are left, big enough to read at a glance: "12 days", "1 day" or "Today". */
function CountdownTile({ days, eventType }: { days: number; eventType: EventType }) {
  const theme = eventTheme(eventType);
  // Today's and tomorrow's stand out, like birthdays on the Following tab.
  const soon = days <= 1;
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-14 shrink-0 flex-col items-center justify-center rounded-xl",
        soon ? "bg-brand-solid text-primary_on-brand" : cx(theme.bg, theme.text),
      )}
    >
      {days === 0 ? (
        <span className="font-display text-sm font-semibold">Today</span>
      ) : (
        <>
          <span className="font-display text-xl leading-none font-semibold tabular-nums">{days}</span>
          <span className="mt-0.5 text-[11px] leading-none font-medium tracking-wide uppercase">
            {days === 1 ? "day" : "days"}
          </span>
        </>
      )}
    </span>
  );
}

/**
 * "Coming up" on the My registries tab: the next few events, with how many
 * days are left until each, so they're in view without opening the Events
 * tab. Events the user hosts open their page. Someone else's event opens its
 * invitation: on the user's own guest link when they're invited, so they can
 * RSVP. Renders nothing when there are none.
 */
export function UpcomingEvents({
  events,
  today,
  basePath = "",
}: {
  /** Soonest first (src/lib/upcoming-events.ts). */
  events: DashboardEvent[];
  /** YYYY-MM-DD. Passed in so stories get a fixed countdown. */
  today: string;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
}) {
  if (events.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-events-heading" className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 id="upcoming-events-heading" className="text-lg font-semibold">
          Coming up
        </h2>
        <Link
          href={`${basePath}/dashboard/events`}
          className="group inline-flex items-center gap-0.5 text-sm font-medium text-brand-tertiary hover:underline"
        >
          All events
          <ChevronRight
            aria-hidden="true"
            className="size-4 transition motion-safe:group-hover:translate-x-0.5"
          />
        </Link>
      </div>
      {/* The same columns as the registry cards below it. */}
      <ul className="mt-3 grid gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {events.map((event) => {
          const href =
            event.role === "host"
              ? `${basePath}/dashboard/events/${event.id}`
              : event.role === "guest" && event.guestToken
                ? `${basePath}/e/${event.slug}?g=${encodeURIComponent(event.guestToken)}`
                : `${basePath}/e/${event.slug}`;
          const when = `${formatShortEventDate(event.eventDate)}${event.time ? ` · ${event.time}` : ""}`;
          return (
            <li key={event.id}>
              <Link
                href={href}
                className="group clickable-card flex h-full items-center gap-4 rounded-2xl border border-secondary bg-primary p-4 shadow-sm"
              >
                <CountdownTile days={daysUntil(event.eventDate, today)} eventType={event.eventType} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-medium break-words text-primary">
                    {event.title}
                  </span>
                  <span className="sr-only">. {countdownLabel(event.eventDate, today, "personal")}. </span>
                  <span className="mt-0.5 block truncate text-sm text-tertiary">{when}</span>
                  <span className="block truncate text-sm text-secondary">
                    {event.summary
                      ? rsvpStatsText(event.summary)
                      : event.role === "guest" && event.rsvp
                        ? MY_RSVP_LABELS[event.rsvp]
                        : "Celebrating you"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

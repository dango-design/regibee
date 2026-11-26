import Link from "next/link";
import { HomeSection } from "@/components/home-section";
import type { DashboardEvent } from "@/lib/dashboard-page-types";
import { comingUpStatus, daysLeftText, eventDateParts } from "@/lib/events";
import { countdownLabel, daysUntil } from "@/lib/occasions";
import { cx } from "@/lib/utils/cx";

/**
 * "Coming up" on the My registries tab: the next few events as an agenda,
 * one row per event with its date at the left. Events are plain rows and
 * lists are cards with a colored cover (dashboard-registry-card.tsx), so the
 * two read as different things: dates to keep, and lists to look after. The
 * phone app's home screen draws the same rows (mobile/src/components/home/coming-up.tsx).
 *
 * Events the user hosts open their page. Someone else's event opens its
 * invitation: on the user's own guest link when they're invited, so they can
 * RSVP. Renders nothing when there are none.
 */
export function UpcomingEvents({
  events,
  today,
  basePath = "",
  className,
}: {
  /** Soonest first (src/lib/upcoming-events.ts). */
  events: DashboardEvent[];
  /** YYYY-MM-DD. Passed in so stories get a fixed countdown. */
  today: string;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
  className?: string;
}) {
  if (events.length === 0) return null;

  return (
    <HomeSection
      id="upcoming-events"
      title="Coming up"
      more={{ title: "All events", href: `${basePath}/dashboard/events` }}
      className={className}
    >
      <ul>
        {events.map((event, index) => {
          const href =
            event.role === "host"
              ? `${basePath}/dashboard/events/${event.id}`
              : event.role === "guest" && event.guestToken
                ? `${basePath}/e/${event.slug}?g=${encodeURIComponent(event.guestToken)}`
                : `${basePath}/e/${event.slug}`;
          const { month, day, weekday } = eventDateParts(event.eventDate);
          const days = daysUntil(event.eventDate, today);
          const details = [weekday, event.time, comingUpStatus(event)].filter(Boolean).join(" · ");
          // The next event stands out.
          const next = index === 0;
          return (
            <li key={event.id}>
              <Link
                href={href}
                className="group flex items-stretch gap-4 rounded-xl px-1 transition hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-ring"
              >
                {/* The title comes first in what screen readers say, so the date is only drawn. */}
                <span aria-hidden="true" className="flex w-11 shrink-0 flex-col items-center justify-center py-3">
                  <span className="text-[11px] leading-none font-bold tracking-wider text-brand-tertiary">{month}</span>
                  <span className="mt-1 font-display text-[28px] leading-none font-bold tabular-nums">{day}</span>
                </span>
                <span
                  className={cx(
                    "flex min-w-0 flex-1 items-center gap-3 py-3",
                    index > 0 && "border-t border-secondary",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-semibold break-words text-primary">{event.title}</span>
                    <span className="sr-only">. {countdownLabel(event.eventDate, today, "personal")}. </span>
                    <span className="mt-0.5 block truncate text-sm text-tertiary">{details}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cx(
                      "shrink-0 text-xs font-semibold whitespace-nowrap",
                      next ? "rounded-full bg-brand-primary px-2.5 py-1 text-brand-secondary" : "text-secondary",
                    )}
                  >
                    {daysLeftText(days)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </HomeSection>
  );
}

import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { eventTypeLabel, formatShortEventDate } from "@/lib/events";
import type { ListEventForViewer } from "@/lib/shared-events";
import { cx } from "@/lib/utils/cx";

/** How the visitor is on the event, in their own words. */
const PART_LABEL: Record<ListEventForViewer["part"], string> = {
  host: "You're hosting",
  yes: "You're going",
  maybe: "You said maybe",
  pending: "You haven't replied",
};

/**
 * On someone else's list: the events the list is on that the visitor and the
 * list's owner are both invited to, where neither said no
 * (listEventsOnListForViewer in src/lib/shared-events-server.ts). Each opens
 * the visitor's own invitation, or the event's page for a host.
 */
export function ListEventsNotice({
  events,
  basePath = "",
  className,
}: {
  events: ListEventForViewer[];
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
  className?: string;
}) {
  if (events.length === 0) return null;
  return (
    <div className={cx("flex items-start gap-3 rounded-2xl bg-blush-50 dark:bg-blush-300/10 p-4", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
        <CalendarHeart aria-hidden="true" className="h-4.5 w-4.5 text-blush-700 dark:text-blush-200" />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-primary">{events.length === 1 ? "Event with this list" : "Events with this list"}</p>
        <ul className="text-sm text-tertiary">
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`${basePath}${event.href}`} className="font-medium text-brand-tertiary hover:underline">
                {event.title}
              </Link>
              {" · "}
              {event.eventDate ? formatShortEventDate(event.eventDate) : eventTypeLabel(event.eventType)}
              {" · "}
              {PART_LABEL[event.part]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

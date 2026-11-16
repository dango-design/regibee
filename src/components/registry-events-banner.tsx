"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarHeart, CalendarPlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnlinkEventButton } from "@/components/unlink-event-button";
import { dismissEventPrompt } from "@/lib/actions/registry";
import { eventTypeLabel, formatShortEventDate, type EventDetails } from "@/lib/events";
import { cx } from "@/lib/utils/cx";

export type BannerEvent = Pick<EventDetails, "id" | "title" | "event_date" | "event_type"> & {
  slug?: string;
  /**
   * Whether the viewer hosts it. Hosts open the event's dashboard. Anyone
   * else sees the guest page, and can unlink this registry. Left out, it
   * counts as hosted.
   */
  canManage?: boolean;
};

function planHref(registryId: string, basePath: string) {
  return `${basePath}/dashboard/events/new?registry=${registryId}`;
}

/**
 * The quiet "Plan an event" button in a registry page's header. The page
 * shows it once the owner has dismissed the banner's prompt, so planning an
 * event is still one click away.
 */
export function PlanEventButton({ registryId, basePath = "" }: { registryId: string; basePath?: string }) {
  return (
    <Button variant="ghost" asChild>
      <Link href={planHref(registryId, basePath)}>
        <span className="inline-flex items-center gap-1.5">
          <CalendarPlus className="h-4 w-4 shrink-0" />
          Plan an event
        </span>
      </Link>
    </Button>
  );
}

/**
 * The band near the top of a registry's dashboard page. It lists the events
 * that link guests to this registry. With none, it suggests planning one.
 *
 * A registry doesn't need an event, so the suggestion is small and can be
 * dismissed. Once dismissed, it stays gone for this registry, and the page
 * shows a PlanEventButton in its header instead.
 *
 * The events can belong to anyone: a friend can link this registry to the
 * shower they're throwing. So they're "linked", not "yours". A registry can
 * have several (a shower and a sip-and-see, say), so once one exists,
 * planning another stays available but steps back to a quieter button.
 */
export function RegistryEventsBanner({
  registryId,
  events,
  promptDismissed = false,
  basePath = "",
  className,
  unlinkAction,
  dismissAction = dismissEventPrompt,
}: {
  registryId: string;
  events: BannerEvent[];
  /** Whether someone already dismissed the "Planning a party?" prompt on this registry. */
  promptDismissed?: boolean;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
  className?: string;
  /** Unlinks this registry from someone else's event. Stories pass a stand-in. */
  unlinkAction?: (eventId: string, registryId: string) => Promise<{ error: string | null }>;
  /** Saves the dismissal. Stories and the demo pass a stand-in. */
  dismissAction?: (registryId: string) => Promise<{ error: string | null }>;
}) {
  // Hide the prompt as soon as it's dismissed. The page then reloads its data
  // and shows the header button.
  const [hidden, setHidden] = useState(false);

  if (events.length === 0) {
    if (promptDismissed || hidden) return null;
    return (
      <div className={cx("flex items-start gap-3 rounded-xl border border-secondary py-3 pr-2 pl-4", className)}>
        <CalendarHeart aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tertiary sm:mt-2" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm text-tertiary">
            <span className="font-medium text-secondary">Planning a party?</span> Send invitations and track
            RSVPs, with guests linked to this registry.
          </p>
          <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" asChild>
            <Link href={planHref(registryId, basePath)}>Plan an event</Link>
          </Button>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          title="Dismiss"
          onClick={async () => {
            setHidden(true);
            const result = await dismissAction(registryId);
            // Bring it back if saving failed, so it doesn't vanish now and
            // reappear on the next visit.
            if (result.error) setHidden(false);
          }}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary transition outline-none hover:bg-secondary hover:text-secondary focus-visible:ring-2 focus-visible:ring-brand-600 max-sm:size-11 max-sm:-my-1.5"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "flex flex-col gap-3 rounded-2xl bg-blush-50 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
          <CalendarHeart aria-hidden="true" className="h-4.5 w-4.5 text-blush-700" />
        </span>
        <div>
          <p className="font-medium">{events.length === 1 ? "Linked event" : "Linked events"}</p>
          <ul className="text-sm text-tertiary">
            {events.map((event) => {
              const hosted = event.canManage ?? true;
              const href =
                hosted || !event.slug ? `${basePath}/dashboard/events/${event.id}` : `${basePath}/e/${event.slug}`;
              return (
                <li key={event.id} className="flex flex-wrap items-center gap-x-2">
                  <span>
                    <Link href={href} className="font-medium text-brand-600 hover:underline">
                      {event.title}
                    </Link>
                    {" · "}
                    {event.event_date ? formatShortEventDate(event.event_date) : eventTypeLabel(event.event_type)}
                    {!hosted && " · hosted by someone else"}
                  </span>
                  {!hosted && (
                    <UnlinkEventButton
                      eventId={event.id}
                      registryId={registryId}
                      {...(unlinkAction ? { unlinkAction } : {})}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0" asChild>
        <Link href={planHref(registryId, basePath)}>
          <span className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4 shrink-0" />
            Plan another event
          </span>
        </Link>
      </Button>
    </div>
  );
}

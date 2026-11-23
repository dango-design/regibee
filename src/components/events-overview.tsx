import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarHeart, Gift, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventCard, InvitedEventCard, type EventCardProps, type InvitedEventCardProps } from "@/components/event-card";

type HostCard = EventCardProps & { id: string };
type InviteCard = InvitedEventCardProps & { id: string };

export interface EventsOverviewProps {
  /** Events you host or co-host, today and later, soonest first. Events with no date come last. */
  upcoming: HostCard[];
  /** Events you hosted or co-hosted, before today, most recent first. */
  past: HostCard[];
  /**
   * Other people's events you're on the guest list for, today and later,
   * soonest first. Events with no date come last.
   */
  invited?: InviteCard[];
  /** Other people's events you were on the guest list for, before today, most recent first. */
  invitedPast?: InviteCard[];
  /** Put in front of the New link. The demo passes "/demo". */
  basePath?: string;
  /**
   * Events someone else hosts that link one of your registries, like a
   * shower a friend is throwing for you. You see the guest page, not the
   * host's.
   */
  linked?: { id: string; title: string; dateText: string | null; registryTitles: string[]; href: string }[];
}

/**
 * The New button: "Start something new" (/dashboard/new). The demo has no
 * picker, so with a base path it opens the demo's event form.
 */
export function NewEventButton({ basePath = "" }: { basePath?: string }) {
  return (
    <Button asChild>
      <Link href={basePath ? `${basePath}/dashboard/events/new` : "/dashboard/new"}>
        <span className="inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4 shrink-0" />
          New
        </span>
      </Link>
    </Button>
  );
}

/** The Events tab on the dashboard. Its page (dashboard/(tabs)/events) loads the events. */
function LinkedEvents({ linked }: { linked: NonNullable<EventsOverviewProps["linked"]> }) {
  return (
    <section aria-labelledby="linked-events-heading" className="mt-8 rounded-2xl bg-blush-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
          <Gift aria-hidden="true" className="size-4.5 text-blush-700" />
        </span>
        <div className="min-w-0">
          <h2 id="linked-events-heading" className="font-medium text-primary">
            Celebrating you
          </h2>
          <p className="text-sm text-tertiary">Events other people are hosting that link your registry.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {linked.map((event) => (
              <li key={event.id} className="text-sm">
                <Link href={event.href} className="font-medium text-brand-600 hover:underline">
                  {event.title}
                </Link>
                <span className="text-tertiary">
                  {event.dateText ? ` · ${event.dateText}` : ""} · links {event.registryTitles.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * Past events you hosted and ones you were invited to, most recent first.
 * Past events always have a date.
 */
function mergePast(past: HostCard[], invitedPast: InviteCard[]) {
  return [
    ...past.map((card) => ({ kind: "host" as const, card })),
    ...invitedPast.map((card) => ({ kind: "guest" as const, card })),
  ].sort((a, b) => (b.card.eventDate ?? "").localeCompare(a.card.eventDate ?? ""));
}

function EventsSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10 first:mt-0">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export function EventsOverview({
  upcoming,
  past,
  invited = [],
  invitedPast = [],
  basePath = "",
  linked = [],
}: EventsOverviewProps) {
  const pastEvents = mergePast(past, invitedPast);
  const none = upcoming.length === 0 && invited.length === 0 && pastEvents.length === 0;

  return (
    <div className="container mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          {/* The Events tab is the visible title (see (tabs)/layout.tsx). */}
          <h1 className="sr-only">Events</h1>
          <p className="text-tertiary">Send invitations and track RSVPs</p>
        </div>
        <NewEventButton basePath={basePath} />
      </div>

      {linked.length > 0 && <LinkedEvents linked={linked} />}

      {none ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-blush-100">
              <CalendarHeart aria-hidden="true" className="size-8 text-blush-700" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">Plan your first event</h2>
            <p className="mt-2 max-w-md text-tertiary">
              A baby shower, a birthday, a holiday party: upload your invitation, email it to guests, and see who&apos;s
              coming. Link your registry so guests know what to bring.
            </p>
            <div className="mt-6">
              <NewEventButton basePath={basePath} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8">
          {upcoming.length > 0 && (
            <EventsSection id="hosting-events-heading" title="Hosting">
              {upcoming.map(({ id, ...card }) => (
                <EventCard key={id} {...card} headingLevel={3} />
              ))}
            </EventsSection>
          )}
          {invited.length > 0 && (
            <EventsSection id="invited-events-heading" title="Invited">
              {invited.map(({ id, ...card }) => (
                <InvitedEventCard key={id} {...card} headingLevel={3} />
              ))}
            </EventsSection>
          )}
          {pastEvents.length > 0 && (
            <EventsSection id="past-events-heading" title="Past events">
              {pastEvents.map((entry) => {
                if (entry.kind === "host") {
                  const { id, ...card } = entry.card;
                  return <EventCard key={id} {...card} headingLevel={3} />;
                }
                // Among the ones you hosted, say which you were invited to.
                const { id, ...card } = entry.card;
                return <InvitedEventCard key={id} {...card} badge="Invited" headingLevel={3} />;
              })}
            </EventsSection>
          )}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { CircleCheck, CircleHelp, CircleX, CookingPot, ExternalLink, Mail, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { countdownLabel } from "@/lib/occasion-theme";
import {
  eventTheme,
  eventTypeLabel,
  formatShortEventDate,
  MY_RSVP_LABELS,
  rsvpStatsText,
  type EventType,
  type RsvpStatus,
  type RsvpSummary,
} from "@/lib/events";
import { cx } from "@/lib/utils/cx";

/** What every event card shows: the picture, the occasion, the title and when it is. */
interface EventCardBase {
  title: string;
  eventType: EventType;
  /** YYYY-MM-DD, or null when the event has no date yet. */
  eventDate: string | null;
  /** "2 – 5 PM PDT" */
  time: string | null;
  imageUrl: string | null;
  /** YYYY-MM-DD. Passed in so stories get a fixed countdown. */
  today: string;
  /** Shown next to the title, like "Co-host". */
  badge?: string;
  headingLevel?: 2 | 3;
}

export interface EventCardProps extends EventCardBase {
  summary: Pick<RsvpSummary, "guests" | "attending" | "maybe" | "pending" | "invited">;
  manageHref: string;
  publicHref: string;
}

export interface InvitedEventCardProps extends EventCardBase {
  /** The "Hosted by" line from the invitation. */
  hostedBy: string | null;
  /** The viewer's own reply. */
  rsvp: RsvpStatus;
  /** The invitation, on the viewer's own guest link so it opens with their RSVP. */
  href: string;
}

/** The card's picture, edge to edge, with the days left (or the date, once it's past). */
function EventCardPicture({ eventType, eventDate, imageUrl, today }: EventCardBase) {
  const theme = eventTheme(eventType);
  return (
    <div
      className={cx(
        "relative flex h-32 items-center justify-center overflow-hidden",
        imageUrl ? "bg-secondary" : theme.bg,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded pictures from Supabase Storage
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover transition duration-300 ease-out motion-safe:group-hover/card:scale-105"
        />
      ) : (
        <span className="flex size-12 items-center justify-center rounded-full bg-primary">
          {eventType === "meal_train" ? (
            <CookingPot aria-hidden="true" className={cx("size-6 motion-safe:group-hover/card:animate-hop", theme.icon)} />
          ) : (
            <PartyPopper aria-hidden="true" className={cx("size-6 motion-safe:group-hover/card:animate-wiggle", theme.icon)} />
          )}
        </span>
      )}
      {eventDate && (
        <span className="absolute top-3 right-3 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary shadow-sm">
          {countdownLabel(eventDate, today, "personal")}
        </span>
      )}
    </div>
  );
}

/** The occasion, the title (linking to `href`) and the date. */
function EventCardHeading({
  title,
  eventType,
  eventDate,
  time,
  badge,
  headingLevel = 2,
  href,
}: EventCardBase & { href: string }) {
  const theme = eventTheme(eventType);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div>
      <p className={cx("text-xs font-semibold tracking-wide uppercase", theme.text)}>{eventTypeLabel(eventType)}</p>
      <div className="mt-1 flex items-start gap-2">
        <Heading className="min-w-0 flex-1 text-lg leading-snug font-semibold text-primary">
          <Link href={href} className="card-link hover:underline">
            {title}
          </Link>
        </Heading>
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </div>
      <p className="mt-0.5 text-sm text-tertiary">
        {eventDate ? `${formatShortEventDate(eventDate)}${time ? ` · ${time}` : ""}` : "No date yet"}
      </p>
    </div>
  );
}

/**
 * An event the viewer hosts or co-hosts, on their Events tab. A click
 * anywhere on the card opens the event's page; the View button still opens
 * the invitation (see clickable-card in globals.css).
 */
export function EventCard({ summary, manageHref, publicHref, ...base }: EventCardProps) {
  return (
    <Card className="group/card clickable-card gap-0 overflow-hidden py-0">
      <EventCardPicture {...base} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <EventCardHeading {...base} href={manageHref} />
        <p className="text-sm text-secondary">{rsvpStatsText(summary)}</p>
        <div className="mt-auto flex gap-2">
          <Button size="sm" className="card-action flex-1" asChild>
            <Link href={manageHref}>Guests & RSVPs</Link>
          </Button>
          <Button size="sm" variant="outline" className="card-action" asChild>
            <a href={publicHref} target="_blank" rel="noopener noreferrer" aria-label={`View ${base.title} invitation`}>
              <span className="inline-flex items-center gap-1.5">
                <ExternalLink className="size-4 shrink-0" />
                View
              </span>
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}

const REPLY_ICONS = { yes: CircleCheck, maybe: CircleHelp, no: CircleX, pending: Mail } as const;
const REPLY_COLORS: Record<RsvpStatus, string> = {
  yes: "text-success-700",
  maybe: "text-warning-700",
  no: "text-tertiary",
  pending: "text-brand-700",
};

/**
 * Someone else's event the viewer is invited to, on their Events tab. It
 * shows the viewer's own reply, not the host's guest counts. A click anywhere
 * on the card opens the invitation on the viewer's guest link, where they can
 * RSVP or change their reply.
 */
export function InvitedEventCard({ hostedBy, rsvp, href, ...base }: InvitedEventCardProps) {
  const ReplyIcon = REPLY_ICONS[rsvp];
  // Asking for a reply makes sense only before the event.
  const needsReply = rsvp === "pending" && (base.eventDate === null || base.eventDate >= base.today);

  return (
    <Card className="group/card clickable-card gap-0 overflow-hidden py-0">
      <EventCardPicture {...base} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <EventCardHeading {...base} href={href} />
        <div className="flex flex-col gap-1 text-sm">
          {hostedBy && <p className="text-secondary">Hosted by {hostedBy}</p>}
          <p className={cx("inline-flex items-center gap-1.5 font-medium", REPLY_COLORS[rsvp])}>
            <ReplyIcon aria-hidden="true" className="size-4 shrink-0" />
            {MY_RSVP_LABELS[rsvp]}
          </p>
        </div>
        <div className="mt-auto flex gap-2">
          <Button size="sm" variant={needsReply ? "default" : "outline"} className="card-action flex-1" asChild>
            <Link href={href}>{needsReply ? "RSVP" : "See invitation"}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

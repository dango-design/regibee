import {
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Clock,
  CookingPot,
  Gift,
  MapPin,
  Megaphone,
  PartyPopper,
  Shuffle,
} from "lucide-react";
import {
  eventTheme,
  eventTypeLabel,
  formatEventDate,
  formatEventTime,
  mapsUrl,
  type EventDetails,
  type GiftExchange,
  type GuestWishList,
  type LinkedRegistry,
} from "@/lib/events";
import type { InvitationUpdate } from "@/lib/event-updates";
import type { InvitationEvent, InvitationRegistry } from "@/lib/invitation-page-types";
import { GuestWishLists } from "@/components/guest-wish-lists";
import { SignupSheetSection } from "@/components/signup-sheet";
import type { InvitationSignup } from "@/lib/invitation-page-types";
import { cx } from "@/lib/utils/cx";
import { normalizeThemeColor, themeColors } from "@/lib/event-colors";
import { HOST_FILL, HOST_INK, hostColorVars } from "@/lib/host-colors";

// The invitation's data types are shared with the phone app.
export type { InvitationEvent, InvitationRegistry };

export interface EventInvitationProps {
  event: InvitationEvent;
  /** The registries the event links, in order. */
  registries?: InvitationRegistry[];
  /** @deprecated One registry, from before events could link several. Use registries. */
  registry?: LinkedRegistry | null;
  /** The event's gift exchange, when it has one. */
  exchange?: Pick<GiftExchange, "kind" | "budget" | "draw_by" | "mailed" | "drawn_at"> | null;
  /**
   * Everyone gives everyone: each guest's wishlist, for the event's guests
   * and hosts only. They share one section with the lists the host linked.
   * Leave it out for anyone else, who sees only the host's lists there.
   */
  wishLists?: { lists: GuestWishList[]; waitingCount?: number } | null;
  /**
   * The event's slug and the guest's RSVP token. With both, gift links go
   * through the event, which tells the registry who the guest is.
   */
  eventSlug?: string;
  guestToken?: string | null;
  /** Add-to-calendar links, when the event has a date. */
  calendar?: { google: string; ics: string } | null;
  /** The event's sign-up sheet, as this guest sees it. */
  signup?: InvitationSignup | null;
  /**
   * A meal train's drop-off address, held back until the guest signs up.
   * The event passed in has no address; this says there is one.
   */
  addressHidden?: boolean;
  /** The host's messages and changes to the date, time or place, newest first. */
  updates?: InvitationUpdate[];
  /**
   * The guest's reply: the RSVP form, and the Secret Santa card once names are
   * drawn. It comes right after the details and the host's updates, before
   * the gift sections: a guest answers before browsing what to give.
   */
  reply?: React.ReactNode;
  /** What comes after the gift sections, such as group gifts. */
  children?: React.ReactNode;
  /** Put in front of the registry link. The demo passes "/demo". */
  basePath?: string;
}

function DetailRow({ icon: Icon, children }: { icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Icon aria-hidden="true" className="size-4.5 text-brand-tertiary" />
      </span>
      <div className="min-w-0 pt-1.5 text-secondary">{children}</div>
    </div>
  );
}

/**
 * A few of a list's gifts as small overlapping pictures, or a gift icon when
 * none has a picture. One on a phone, so the name has room, and three on a
 * wider screen.
 */
function RegistryPictures({ items }: { items: NonNullable<InvitationRegistry["items"]> }) {
  const pictures = items.filter((item) => item.image_url).slice(0, 3);
  if (pictures.length === 0) {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Gift aria-hidden="true" className="size-5 text-quaternary" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="flex shrink-0">
      {pictures.map((item, index) => (
        <span
          key={item.id}
          className={cx(
            "flex size-11 items-center justify-center overflow-hidden rounded-lg bg-secondary ring-2 ring-bg-primary",
            // Each picture after the first tucks under the one before it.
            // A margin on the picture itself, not -space-x on the row, so the
            // phone's single picture keeps its full width.
            index > 0 && "-ml-4 max-sm:hidden",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- product pictures from any store */}
          <img src={item.image_url!} alt="" className="size-full object-contain p-1" />
        </span>
      ))}
    </span>
  );
}

/** "Mar 5", the day it was posted where the event is. */
function formatPosted(iso: string, timeZone: string | null) {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  try {
    return new Date(iso).toLocaleDateString("en-US", { ...options, timeZone: timeZone || "UTC" });
  } catch {
    return new Date(iso).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
  }
}

/**
 * What the host told guests after the invitation went out: their messages,
 * and a line for each new date, time or place. Guests without email, and
 * guests whose email bounced, see them here.
 */
function HostUpdates({ updates, timeZone }: { updates: InvitationUpdate[]; timeZone: string | null }) {
  return (
    <section aria-labelledby="updates-heading" className="flex flex-col gap-3 rounded-2xl bg-secondary p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
          <Megaphone aria-hidden="true" className="size-4.5 text-brand-tertiary" />
        </span>
        <h2 id="updates-heading" className="font-medium text-primary">
          Updates from the host
        </h2>
      </div>
      <ol className="flex flex-col divide-y divide-secondary rounded-xl bg-primary px-3">
        {updates.map((update) => (
          <li key={update.id} className="flex flex-col gap-1 py-3">
            {update.kind === "message" ? (
              <>
                <p className="font-medium text-primary">{update.subject}</p>
                <p className="whitespace-pre-line text-secondary">{update.body}</p>
              </>
            ) : (
              <p className="font-medium text-primary">{update.body}</p>
            )}
            <p className="text-sm text-tertiary">
              <time dateTime={update.created_at}>{formatPosted(update.created_at, timeZone)}</time>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The event as guests see it: the invitation picture, the details, the
 * host's updates, a link to the registry, and the RSVP form below. The public
 * event page and the host's preview both use it.
 */
export function EventInvitation({
  event,
  registries: registryList,
  registry,
  exchange = null,
  wishLists = null,
  eventSlug,
  guestToken,
  calendar,
  signup = null,
  addressHidden = false,
  updates = [],
  reply,
  children,
  basePath = "",
}: EventInvitationProps) {
  const registries: InvitationRegistry[] = registryList ?? (registry ? [registry] : []);
  const giftHref = (slug: string) =>
    guestToken && eventSlug && !basePath
      ? `/e/${eventSlug}/gifts?g=${encodeURIComponent(guestToken)}&to=${encodeURIComponent(slug)}`
      : `${basePath}/r/${slug}`;
  const theme = eventTheme(event.event_type);
  // The host's own color, when they picked one (src/lib/event-colors.ts).
  const hostColor = normalizeThemeColor(event.theme_color);
  const colors = hostColor ? themeColors(hostColor) : null;
  const time = formatEventTime(event);
  const map = mapsUrl(event);
  const hasImage = Boolean(event.image_url);
  // Everyone gives everyone: the host's lists and the guests' lists are all
  // the same kind of thing, so they share one section instead of Gifts.
  const everyone = exchange?.kind === "everyone";

  return (
    <div
      className={cx(
        "mx-auto w-full",
        hasImage ? "max-w-5xl lg:grid lg:grid-cols-2 lg:items-start lg:gap-12" : "max-w-xl",
      )}
    >
      {hasImage ? (
        <div className="lg:sticky lg:top-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded pictures of any size, from Supabase Storage */}
          <img
            src={event.image_url!}
            alt={`${event.title} invitation`}
            className="mx-auto block h-auto max-h-[80vh] w-auto max-w-full rounded-2xl shadow-lg ring-1 ring-black/5 dark:ring-white/10"
          />
        </div>
      ) : (
        <div
          className={cx("flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center", colors ? HOST_FILL : theme.bg)}
          style={colors ? hostColorVars(colors) : undefined}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary">
            {/* A meal train is help after a birth, an illness or a loss, not a party. */}
            {event.event_type === "meal_train" ? (
              <CookingPot
                aria-hidden="true"
                className={cx("size-7", colors ? HOST_INK : theme.icon)}
                style={colors ? hostColorVars(colors) : undefined}
              />
            ) : (
              <PartyPopper
                aria-hidden="true"
                className={cx("size-7", colors ? HOST_INK : theme.icon)}
                style={colors ? hostColorVars(colors) : undefined}
              />
            )}
          </span>
          <p
            className={cx("text-sm font-semibold tracking-wide uppercase", colors ? HOST_INK : theme.text)}
            style={colors ? hostColorVars(colors) : undefined}
          >
            {eventTypeLabel(event.event_type)}
          </p>
        </div>
      )}

      <div className={cx("flex flex-col gap-6", hasImage ? "mt-8 lg:mt-0" : "mt-8")}>
        <div>
          {hasImage && (
            <p className={cx("text-sm font-semibold tracking-wide uppercase", theme.text)}>
              {eventTypeLabel(event.event_type)}
            </p>
          )}
          <h1 className="mt-1 font-display text-4xl leading-tight font-bold tracking-tight text-primary">
            {event.title}
          </h1>
          {event.hosted_by && <p className="mt-2 text-lg text-secondary">Hosted by {event.hosted_by}</p>}
        </div>

        <div className="flex flex-col gap-4">
          {event.event_date && (
            <DetailRow icon={CalendarDays}>
              <p className="font-medium text-primary">{formatEventDate(event.event_date)}</p>
              {time && <p>{time}</p>}
              {calendar && (
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm max-sm:gap-y-0">
                  <a
                    href={calendar.google}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand-tertiary hover:underline max-sm:min-h-11"
                  >
                    <CalendarPlus aria-hidden="true" className="size-3.5" />
                    Google Calendar
                  </a>
                  <a href={calendar.ics} className="font-medium text-brand-tertiary hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
                    Apple or Outlook (.ics)
                  </a>
                </p>
              )}
            </DetailRow>
          )}
          {(event.location_name || event.location_address) && (
            <DetailRow icon={MapPin}>
              {event.location_name && <p className="font-medium text-primary">{event.location_name}</p>}
              {event.location_address && <p className="whitespace-pre-line">{event.location_address}</p>}
              {map && (
                <a
                  href={map}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm font-medium text-brand-tertiary hover:underline max-sm:mt-0 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"
                >
                  Open in Maps
                </a>
              )}
            </DetailRow>
          )}
          {addressHidden && (
            <DetailRow icon={MapPin}>
              <p>The drop-off address shows here once you sign up for a day.</p>
            </DetailRow>
          )}
          {event.rsvp_by && (
            <DetailRow icon={Clock}>
              <p>Please reply by {formatEventDate(event.rsvp_by)}</p>
            </DetailRow>
          )}
        </div>

        {event.message && (
          <p className="text-lg leading-relaxed whitespace-pre-line text-secondary">{event.message}</p>
        )}

        {updates.length > 0 && <HostUpdates updates={updates} timeZone={event.time_zone} />}

        {reply}

        {everyone && (
          <GuestWishLists
            lists={wishLists?.lists ?? null}
            registries={registries}
            giftNote={event.gift_note}
            budget={exchange.budget}
            themeColor={hostColor}
            eventSlug={eventSlug}
            guestToken={guestToken}
            waitingCount={wishLists?.waitingCount}
            basePath={basePath || undefined}
          />
        )}

        {!everyone && (registries.length > 0 || event.gift_note) && (
          <section
            aria-labelledby="gifts-heading"
            className={cx("flex flex-col gap-4 rounded-2xl p-4", colors ? HOST_FILL : "bg-brand-primary")}
            style={colors ? hostColorVars(colors) : undefined}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
                <Gift
                  aria-hidden="true"
                  className={cx("size-4.5", colors ? HOST_INK : "text-brand-tertiary")}
                  style={colors ? hostColorVars(colors) : undefined}
                />
              </span>
              <div className="min-w-0 pt-1">
                <h2 id="gifts-heading" className="font-medium text-primary">
                  Gifts
                </h2>
                {event.gift_note && <p className="mt-1 whitespace-pre-line text-secondary">{event.gift_note}</p>}
              </div>
            </div>
            {registries.map((linked) => {
              const details = [
                linked.honoree ? `${linked.honoree}'s registry` : null,
                linked.itemsLeft !== undefined
                  ? linked.itemsLeft === 0
                    ? "Every gift is taken"
                    : `${linked.itemsLeft} ${linked.itemsLeft === 1 ? "gift" : "gifts"} still needed`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                // One compact row per list: a few pictures, its name and how
                // many gifts are left. The names and prices are on the list.
                <a
                  key={linked.slug}
                  href={giftHref(linked.slug)}
                  className="group clickable-card flex items-center gap-3 rounded-xl border border-transparent bg-primary p-3"
                >
                  <RegistryPictures items={linked.items ?? []} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium text-primary">{linked.title}</span>
                    {details && <span className="block text-sm text-tertiary">{details}</span>}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-quaternary transition motion-safe:group-hover:translate-x-0.5"
                  />
                </a>
              );
            })}
          </section>
        )}

        {signup && <SignupSheetSection signup={signup} />}

        {exchange && exchange.kind !== "everyone" && (
          <section aria-labelledby="exchange-heading" className="flex items-start gap-3 rounded-2xl bg-mint-50 dark:bg-mint-500/10 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
              <Shuffle aria-hidden="true" className="size-4.5 text-mint-800 dark:text-mint-300" />
            </span>
            <div className="min-w-0 pt-1">
              <h2 id="exchange-heading" className="font-medium text-primary">
                Gift exchange
              </h2>
              <p className="mt-1 text-secondary">
                Draw a name and give that person a gift{exchange.budget ? `, about ${exchange.budget}` : ""}.
              </p>
              <p className="mt-1 text-sm text-tertiary">
                {exchange.drawn_at
                  ? "Names have been drawn."
                  : exchange.draw_by
                    ? `Names are drawn by ${formatEventDate(exchange.draw_by)}.`
                    : "Names are drawn once everyone's in."}{" "}
                {exchange.mailed ? "Gifts are mailed." : "Bring your gift to the party."}
              </p>
            </div>
          </section>
        )}

        {children}
      </div>
    </div>
  );
}

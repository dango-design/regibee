import { ExternalLink, Gift, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvitationRegistry } from "@/components/event-invitation";
import { initialsFor } from "@/lib/initials";
import { storeName, type GuestWishList } from "@/lib/events";
import { cx } from "@/lib/utils/cx";

export interface GuestWishListsProps {
  /**
   * Each guest taking part, with their list. Null for someone who is neither
   * a guest nor a host: only they see the guests' lists.
   */
  lists: GuestWishList[] | null;
  /**
   * The lists the host linked to the event, in order. They show first, and
   * anyone with the invitation link sees them.
   */
  registries?: InvitationRegistry[];
  /** The host's note about gifts. */
  giftNote?: string | null;
  /** About how much each gift costs: "$25". */
  budget?: string | null;
  /**
   * The event's slug and the guest's RSVP token. With both, a Regibee list's
   * button goes through the event's gift link, so the list knows who the
   * guest is and shows them what the other guests reserved.
   */
  eventSlug?: string;
  guestToken?: string | null;
  /** Guests who haven't answered yet, so they aren't on the list. */
  waitingCount?: number;
  /** A host looking at it without being a guest: no "You" row to point at. */
  hostView?: boolean;
  /** Put in front of a Regibee list's link instead of going through the event. The demo passes "/demo". */
  basePath?: string;
}

/** One list in the section, a guest's or one the host linked. */
function ListRow({
  leading,
  name,
  isYou = false,
  detail,
  giftIdeas,
  href,
  external = false,
  button,
}: {
  leading: React.ReactNode;
  name: string;
  isYou?: boolean;
  detail: string | null;
  giftIdeas?: string | null;
  /** Where the list opens. Null on your own row, and for a guest with no list. */
  href: string | null;
  /** A list on another store's site, which opens in a new tab. */
  external?: boolean;
  button: React.ReactNode;
}) {
  const linkProps = external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {};
  return (
    <li
      className={cx(
        "flex flex-col gap-3 rounded-xl bg-primary p-3 sm:flex-row sm:items-center sm:justify-between",
        href && "clickable-card",
      )}
    >
      {/* A click anywhere on the row opens the list. The button below is the
          real link for keyboards and screen readers. */}
      {href && <a href={href} aria-hidden="true" tabIndex={-1} className="card-link absolute inset-0" {...linkProps} />}
      <div className="flex min-w-0 items-start gap-3">
        {leading}
        <div className="min-w-0">
          <p className="font-medium break-words text-primary">
            {name}
            {isYou && <span className="ml-1.5 text-sm font-normal text-tertiary">(you)</span>}
          </p>
          {detail && <p className="text-sm break-words text-tertiary">{detail}</p>}
          {giftIdeas && (
            <p className="mt-1 text-sm whitespace-pre-line text-secondary">
              <Gift aria-hidden="true" className="mr-1 inline size-3.5 align-[-2px] text-tertiary" />
              {giftIdeas}
            </p>
          )}
        </div>
      </div>
      {href && (
        <Button variant="outline" size="sm" className="card-action shrink-0 max-sm:min-h-11" asChild>
          <a href={href} {...linkProps}>
            <span className="inline-flex items-center gap-1.5">
              {button}
              {external && <ExternalLink aria-hidden="true" className="size-3.5" />}
            </span>
          </a>
        </Button>
      )}
    </li>
  );
}

/** A linked list's first picture, or a gift icon when none of its gifts has one. */
function ListPicture({ items }: { items: InvitationRegistry["items"] }) {
  const picture = items?.find((item) => item.image_url)?.image_url;
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary"
    >
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element -- product pictures from any store
        <img src={picture} alt="" className="size-full object-contain p-0.5" />
      ) : (
        <Gift className="size-4.5 text-quaternary" />
      )}
    </span>
  );
}

/** "Remi & Max's registry · 3 gifts still needed", for a list the host linked. */
function linkedDetail(linked: InvitationRegistry): string | null {
  const parts = [
    linked.honoree ? `${linked.honoree}'s registry` : null,
    linked.itemsLeft !== undefined
      ? linked.itemsLeft === 0
        ? "Every gift is taken"
        : `${linked.itemsLeft} ${linked.itemsLeft === 1 ? "gift" : "gifts"} still needed`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Everyone's wish lists, on an everyone-gives-everyone invitation: how the
 * exchange works, the lists the host linked, and each guest's list. Anyone
 * with the link sees the host's lists; only the event's guests and hosts see
 * the guests' lists. A guest's own list is first among them, without a
 * button to shop it: nobody sees what's been reserved from their own list.
 */
export function GuestWishLists({
  lists,
  registries = [],
  giftNote = null,
  budget = null,
  eventSlug,
  guestToken,
  waitingCount = 0,
  hostView = false,
  basePath,
}: GuestWishListsProps) {
  const hrefFor = (slug: string) =>
    basePath
      ? `${basePath}/r/${slug}`
      : eventSlug && guestToken
      ? `/e/${eventSlug}/gifts?g=${encodeURIComponent(guestToken)}&to=${encodeURIComponent(slug)}`
      : `/r/${slug}`;
  // A list the host linked that's also a guest's wish list shows once, on
  // the guest's row, which knows whether it's yours.
  const guestSlugs = new Set((lists ?? []).flatMap((entry) => (entry.registry ? [entry.registry.slug] : [])));
  const linked = registries.filter((registry) => !guestSlugs.has(registry.slug));
  const withList = lists?.filter((l) => l.url).length ?? 0;

  return (
    <section aria-labelledby="wish-lists-heading" className="flex flex-col gap-4 rounded-2xl bg-mint-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
          <Users aria-hidden="true" className="size-4.5 text-mint-800" />
        </span>
        <div className="min-w-0 pt-1">
          <h2 id="wish-lists-heading" className="font-medium text-primary">
            Everyone&apos;s wish lists
          </h2>
          {giftNote && <p className="mt-1 whitespace-pre-line text-secondary">{giftNote}</p>}
          <p className="mt-1 text-secondary">
            Everyone gives everyone: each guest adds a wish list when they RSVP, and shops from the others&apos;
            {budget ? `, about ${budget} a gift` : ""}.{" "}
            {lists === null
              ? "Guests see each other's lists here."
              : hostView
                ? "Guests see these lists, and what the others reserved from each one."
                : "Open a list to see what the others reserved, so nobody doubles up."}
          </p>
          <p className="mt-1 text-sm text-tertiary">
            Nobody sees what&apos;s been reserved from their own list until the day after.
          </p>
        </div>
      </div>

      {(linked.length > 0 || (lists && lists.length > 0)) && (
        <ul className="flex flex-col gap-2">
          {linked.map((registry) => (
            <ListRow
              key={`linked:${registry.slug}`}
              leading={<ListPicture items={registry.items} />}
              name={registry.title}
              detail={linkedDetail(registry)}
              href={hrefFor(registry.slug)}
              button={
                registry.honoree ? (
                  `See ${registry.honoree}'s list`
                ) : (
                  <>
                    See list<span className="sr-only">: {registry.title}</span>
                  </>
                )
              }
            />
          ))}
          {(lists ?? []).map((entry) => {
            const href = entry.registry ? hrefFor(entry.registry.slug) : entry.url;
            return (
              <ListRow
                key={entry.guestId}
                leading={
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      entry.isYou ? "bg-brand-600 text-white" : "bg-mint-200 text-mint-900",
                    )}
                  >
                    {initialsFor(entry.name)}
                  </span>
                }
                name={entry.name}
                isYou={entry.isYou}
                detail={
                  entry.registry
                    ? entry.registry.title
                    : entry.url
                      ? `A list on ${storeName(entry.url)}`
                      : entry.isYou
                        ? "Add your wish list above"
                        : "No wish list yet"
                }
                giftIdeas={entry.giftIdeas}
                // Where a click on the row goes: nowhere on your own row.
                href={href && !entry.isYou ? href : null}
                external={!entry.registry}
                button={`See ${entry.name.split(/\s+/)[0]}'s list`}
              />
            );
          })}
        </ul>
      )}

      {lists && lists.length === 0 && (
        <p className="rounded-xl bg-primary p-3 text-sm text-tertiary">
          Nobody has RSVPed yet. Lists show here as guests add them.
        </p>
      )}

      {lists && (waitingCount > 0 || (lists.length > 0 && withList < lists.length)) && (
        <p className="text-xs text-tertiary">
          {[
            lists.length > 0 && withList < lists.length
              ? `${lists.length - withList} of ${lists.length} ${lists.length - withList === 1 ? "hasn't" : "haven't"} added a list yet.`
              : null,
            waitingCount > 0
              ? `${waitingCount === 1 ? "1 guest hasn't" : `${waitingCount} guests haven't`} answered yet.`
              : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
    </section>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarHeart,
  ChevronRight,
  ClipboardList,
  EyeOff,
  Globe,
  Link2,
  Lock,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { ListProgressBar, ListProgressKey } from "@/components/list-progress-bar";
import { RegistryAvatar } from "@/components/registry-avatar";
import { UnlinkEventButton } from "@/components/unlink-event-button";
import type { BannerEvent } from "@/components/registry-events-banner";
import { dismissEventPrompt } from "@/lib/actions/registry";
import { eventTypeLabel, formatShortEventDate } from "@/lib/events";
import type { ListProgress } from "@/lib/gifts";
import type { ListVisibility } from "@/lib/list-access";
import { listHeader, type ListHeader } from "@/lib/list-headers";
import { HEADER_BAND, HEADER_INK, listHeaderVars } from "@/lib/list-header-style";
import { cx } from "@/lib/utils/cx";

export interface OwnerListTopProps {
  registryId: string;
  title: string;
  photoUrl?: string | null;
  /** "Wishlist", "Baby registry": occasionLabel (src/lib/registry-copy.ts). */
  occasion: string;
  itemCount: number;
  /** "Due date: February 4, 2027", for lists with a date. */
  dateLabel?: string | null;
  /** Who can open the list and who sees it on the profile, with a link to change it. */
  access: { visibility: ListVisibility; label: string; href: string };
  /** The viewer co-manages the list instead of owning it. */
  manager?: boolean;
  /** Share, Preview, Settings and the rest, under the title. */
  actions: ReactNode;
  /** Where the items stand (listProgress in src/lib/gifts.ts). Null while reservations are hidden, since the count would be wrong. */
  progress: ListProgress | null;
  /** Reservations are hidden from the owner. `href` opens the Gift Activity tab, which explains it. */
  hidden?: { revealed: number; href: string } | null;
  /** Events this list is on. */
  events: BannerEvent[];
  /** Show "Planning a party?" with no events, until the owner dismisses it. */
  planPrompt?: boolean;
  /** Baby registries' checklist. */
  checklist?: {
    matched: number;
    total: number;
    /** The essentials done, of all of them. Shown instead of the whole count when there. */
    essentials?: { done: number; total: number };
    href: string;
  } | null;
  /** The band's color and pattern. Defaults to the light teal with dots. */
  header?: ListHeader;
  /** The Header button (ListHeaderPicker), in the band's top corner. */
  customize?: ReactNode;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
  /** Stories and the demo pass stand-ins. */
  unlinkAction?: (eventId: string, registryId: string) => Promise<{ error: string | null }>;
  dismissAction?: (registryId: string) => Promise<{ error: string | null }>;
}

const ACCESS_ICON: Record<ListVisibility, LucideIcon> = { private: Lock, link: Link2, public: Globe };

/**
 * The top of a list's page for its owner. It looks like the page guests see
 * (WishListHero): a band in the color and pattern the owner chose
 * (src/lib/list-headers.ts) with the title, and a card hanging
 * off its edge. The card holds how much has been gifted and one part for each
 * thing that needs the owner: hidden gifts, linked events, the checklist. A
 * part shows only when it has something to say, so the items start soon
 * after. The phone app's list screen has the same layout
 * (mobile/src/app/registry/[id]/index.tsx).
 */
export function OwnerListTop({
  registryId,
  title,
  photoUrl,
  occasion,
  itemCount,
  dateLabel,
  access,
  manager = false,
  actions,
  progress,
  hidden,
  events,
  planPrompt = false,
  checklist,
  header = listHeader(),
  customize,
  basePath = "",
  unlinkAction,
  dismissAction = dismissEventPrompt,
}: OwnerListTopProps) {
  // Hide the prompt as soon as it's dismissed. The page then reloads its data.
  const [promptHidden, setPromptHidden] = useState(false);
  const AccessIcon = ACCESS_ICON[access.visibility];
  const planHref = `${basePath}/dashboard/events/new?registry=${registryId}`;

  const parts: { key: string; node: ReactNode }[] = [];

  if (progress && progress.total > 0) {
    const percent = (progress.gifted / progress.total) * 100;
    parts.push({
      key: "progress",
      node: (
        <div className="flex h-full flex-col justify-center gap-2 px-5 py-4">
          <div className="flex items-baseline justify-between gap-3 text-xs text-tertiary">
            <span className="font-semibold text-secondary">
              {progress.gifted} of {progress.total} items gifted
            </span>
            <span className="tabular-nums">{Math.round(percent)}%</span>
          </div>
          <ListProgressBar progress={progress} label="Items gifted" />
          <ListProgressKey progress={progress} />
        </div>
      ),
    });
  }

  if (hidden) {
    parts.push({
      key: "hidden",
      node: (
        <Row
          icon={EyeOff}
          href={hidden.href}
          label="Gifts hidden from you"
          detail={hidden.revealed > 0 ? `${hidden.revealed} revealed` : "See why"}
        />
      ),
    });
  }

  for (const event of events) {
    const hosted = event.canManage ?? true;
    const href = hosted || !event.slug ? `${basePath}/dashboard/events/${event.id}` : `${basePath}/e/${event.slug}`;
    const when = event.event_date ? formatShortEventDate(event.event_date) : eventTypeLabel(event.event_type);
    const who = hosted ? null : event.guestList ? "added by a guest" : "hosted by someone else";
    parts.push({
      key: `event-${event.id}`,
      node: (
        <Row
          icon={CalendarHeart}
          href={href}
          label={event.title}
          detail={[when, who].filter(Boolean).join(" · ")}
          trailing={
            !hosted && !event.guestList ? (
              <UnlinkEventButton eventId={event.id} registryId={registryId} {...(unlinkAction ? { unlinkAction } : {})} />
            ) : undefined
          }
        />
      ),
    });
  }

  if (events.length === 0 && planPrompt && !promptHidden) {
    parts.push({
      key: "plan",
      node: (
        <Row
          icon={CalendarHeart}
          href={planHref}
          label="Planning a party?"
          detail="Plan an event"
          trailing={
            <button
              type="button"
              aria-label="Dismiss"
              title="Dismiss"
              onClick={async () => {
                setPromptHidden(true);
                const result = await dismissAction(registryId);
                // Bring it back if saving failed, so it doesn't vanish now
                // and reappear on the next visit.
                if (result.error) setPromptHidden(false);
              }}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary transition outline-none hover:bg-secondary hover:text-secondary focus-visible:ring-2 focus-visible:ring-brand-solid max-sm:size-11"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          }
        />
      ),
    });
  }

  if (checklist) {
    parts.push({
      key: "checklist",
      node: (
        <Row
          icon={ClipboardList}
          href={checklist.href}
          label="Checklist"
          detail={
            checklist.essentials
              ? `${checklist.essentials.done} of ${checklist.essentials.total} essentials`
              : `${checklist.matched} of ${checklist.total} added`
          }
        />
      ),
    });
  }

  // One part per cell, up to four across. The last part stretches to fill
  // its row, so no empty cell shows.
  const n = parts.length;
  const lgCols = Math.min(n, 4);
  const smCols = Math.min(n, 2);
  const span = (cols: number) => (n % cols === 0 ? 1 : cols - (n % cols) + 1);

  return (
    <>
      <section
        className={cx(HEADER_BAND, "relative px-4 pb-20 sm:pt-10 sm:pb-24", customize ? "pt-16" : "pt-8")}
        style={listHeaderVars(header)}
      >
        {customize && <div className="absolute top-3 right-3 sm:top-4 sm:right-4">{customize}</div>}
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
          {photoUrl && <RegistryAvatar photoUrl={photoUrl} names={null} className="mb-1 size-20" />}
          <p className={cx(HEADER_INK, "text-xs font-semibold tracking-[0.08em] uppercase")}>
            {occasion} · {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
          <h1 className="break-words text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl">{title}</h1>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
            {dateLabel && (
              <span className="inline-flex items-center gap-1.5 text-sm text-secondary">
                <Calendar aria-hidden="true" className="size-4 shrink-0" />
                {dateLabel}
              </span>
            )}
            <Link
              href={access.href}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-secondary bg-primary px-3 py-1 text-xs font-medium text-secondary transition hover:text-primary"
            >
              <AccessIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{access.label}</span>
            </Link>
            {manager && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary">
                <Users aria-hidden="true" className="size-3.5 shrink-0" />
                Manager
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
        </div>
      </section>

      {n > 0 && (
        <div className="container mx-auto px-4">
          {/* The 1px gaps show the card's background through as dividers, in
              any arrangement of parts, as in WishListHero. */}
          <ul
            aria-label="About this list"
            className={cx(
              "relative -mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[20px] border border-secondary bg-[var(--color-border-secondary)] shadow-[0_8px_24px_rgba(35,27,24,0.06)] sm:-mt-16",
              SM_COLS[smCols],
              LG_COLS[lgCols],
            )}
          >
            {parts.map((part, index) => (
              <li
                key={part.key}
                className="min-w-0 bg-primary sm:col-span-(--span-sm) lg:col-span-(--span-lg)"
                style={
                  {
                    "--span-sm": index === n - 1 ? span(smCols) : 1,
                    "--span-lg": index === n - 1 ? span(lgCols) : 1,
                  } as React.CSSProperties
                }
              >
                {part.node}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const SM_COLS: Record<number, string> = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2" };
const LG_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** One part of the card: an icon, a label and a detail, opening `href`. */
function Row({
  icon: Icon,
  href,
  label,
  detail,
  trailing,
}: {
  icon: LucideIcon;
  href: string;
  label: string;
  detail?: string;
  /** A button of its own, such as Unlink. It sits beside the link, not in it. */
  trailing?: ReactNode;
}) {
  return (
    // The whole part opens the link (card-link in globals.css). A trailing
    // button sits above that layer (card-action), so it keeps its own click.
    <div className="group relative flex h-full items-center gap-3 py-3 pr-3 pl-5 transition hover:bg-secondary has-[.card-link:focus-visible]:bg-secondary has-[.card-link:focus-visible]:ring-2 has-[.card-link:focus-visible]:ring-focus-ring has-[.card-link:focus-visible]:ring-inset">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-tertiary group-hover:bg-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <Link href={href} className="card-link flex min-w-0 flex-1 flex-col">
        {/* Four across leaves a part about 250px wide, so long words wrap to
            a second line instead of being cut off. */}
        <span className="line-clamp-2 text-sm font-medium break-words text-primary">{label}</span>
        {detail && <span className="line-clamp-2 text-xs break-words text-tertiary">{detail}</span>}
      </Link>
      {trailing ? (
        <span className="card-action shrink-0">{trailing}</span>
      ) : (
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-quaternary" />
      )}
    </div>
  );
}

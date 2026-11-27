"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger,
  Heading as AriaHeading,
  Popover as AriaPopover,
  type PopoverProps as AriaPopoverProps,
} from "react-aria-components";
import {
  Calendar,
  CalendarHeart,
  Check,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Gift,
  MoreHorizontal,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { SelectField } from "@/components/base/select/select-field";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { ListProgressBar, ListProgressKey } from "@/components/list-progress-bar";
import { RegistryAvatar } from "@/components/registry-avatar";
import { UnlinkEventButton } from "@/components/unlink-event-button";
import type { BannerEvent } from "@/components/registry-events-banner";
import { dismissEventPrompt, updateListSharing } from "@/lib/actions/registry";
import { trackClick } from "@/lib/analytics-client";
import { eventTypeLabel, formatShortEventDate } from "@/lib/events";
import { reservationsHiddenText, type ListProgress } from "@/lib/gifts";
import {
  LIST_ACCESS,
  LIST_VISIBILITIES,
  PROFILE_AUDIENCE,
  accessChangeWarning,
  clampProfileAudience,
  profileAudienceChoices,
  profileChangeNotice,
  type ListVisibility,
  type ProfileAudience,
} from "@/lib/list-access";
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
  /**
   * Who can open the list and who sees it on the profile. Share changes them.
   * `href` is the Settings page's sharing section, for the rest.
   * `noProfile` is for a guest account, which has no profile.
   */
  access: { visibility: ListVisibility; audience: ProfileAudience; href: string; noProfile?: boolean };
  /** The list's own link, "/r/<slug>". Share copies it. */
  sharePath: string;
  /** The ⋯ menu's links. `plan` shows "Plan an event" when it's set. */
  links: { preview: string; settings: string; plan?: string | null };
  /** The viewer co-manages the list instead of owning it. */
  manager?: boolean;
  /** Where the items stand (listProgress in src/lib/gifts.ts). Null while reservations are hidden, since the count would be wrong. */
  progress: ListProgress | null;
  /**
   * Reservations are hidden from the owner. `href` opens the Gift Activity
   * tab and `settingsHref` the setting. `next` and `turnedOnByExchange` fill
   * in the explanation, as on the Gift Activity tab.
   */
  hidden?: {
    revealed: number;
    href: string;
    settingsHref?: string;
    next?: { date: string; eventTitle: string } | null;
    turnedOnByExchange?: boolean;
  } | null;
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
  /** The Header button (ListHeaderPicker with `compact`), among the band's tools. */
  customize?: ReactNode;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
  /** Stories and the demo pass stand-ins. */
  unlinkAction?: (eventId: string, registryId: string) => Promise<{ error: string | null }>;
  dismissAction?: (registryId: string) => Promise<{ error: string | null }>;
  /** Saves a change from Share. Defaults to updateListSharing. */
  shareAction?: (
    registryId: string,
    change: { visibility: ListVisibility; profileAudience?: ProfileAudience },
  ) => Promise<{ error: string } | { error: null; visibility: ListVisibility; audience: ProfileAudience }>;
}

/**
 * The top of a list's page for its owner. It looks like the page guests see
 * (WishListHero): a band in the color and pattern the owner chose
 * (src/lib/list-headers.ts) with the title, and a card hanging off its edge.
 *
 * The owner's tools sit in the band's top right corner, so nothing but the
 * title sits in the middle: Share (copies the link and changes who can open
 * it), a crossed-out gift when gifts are hidden from the owner, the Header
 * button and a ⋯ menu with Preview, Plan an event and Settings.
 *
 * The card holds how much has been gifted and one part for each thing that
 * needs the owner: linked events, the checklist. A part shows only when it
 * has something to say, so the items start soon after. The card is only as
 * wide as its parts need. The phone app's list screen has the same layout
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
  sharePath,
  links,
  manager = false,
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
  shareAction = updateListSharing,
}: OwnerListTopProps) {
  // Hide the prompt as soon as it's dismissed. The page then reloads its data.
  const [promptHidden, setPromptHidden] = useState(false);
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

  // The band's gift icon says gifts are hidden. A part only shows once an
  // event has passed and its gifts are shown, for thank-you notes.
  if (hidden && hidden.revealed > 0) {
    parts.push({
      key: "revealed",
      node: <Row icon={Gift} href={hidden.href} label="Gift activity" detail={`${hidden.revealed} revealed`} />,
    });
  }

  for (const event of events) {
    const hosted = event.canManage ?? true;
    const href = hosted || !event.slug ? `${basePath}/dashboard/events/${event.id}` : `${basePath}/e/${event.slug}`;
    const when = event.event_date ? formatShortEventDate(event.event_date) : eventTypeLabel(event.event_type);
    const who = hosted || event.guestList ? null : "hosted by someone else";
    parts.push({
      key: `event-${event.id}`,
      node: (
        <Row
          icon={CalendarHeart}
          href={href}
          // Says how the list and the event are linked: the list shows on
          // the event's invitation, or it's the owner's wishlist as a guest.
          caption={event.guestList ? "Your wishlist for" : "On the invitation for"}
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
        className={cx(HEADER_BAND, "relative px-4 pt-20 pb-20 sm:pt-20 sm:pb-24")}
        style={listHeaderVars(header)}
      >
        <div className="absolute top-3 right-3 flex items-center gap-1 sm:top-4 sm:right-4">
          <ShareButton
            registryId={registryId}
            path={sharePath}
            access={access}
            events={events}
            manager={manager}
            shareAction={shareAction}
          />
          {hidden && <HiddenGiftsButton hidden={hidden} />}
          {customize}
          <MoreMenu links={links} />
        </div>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
          {photoUrl && <RegistryAvatar photoUrl={photoUrl} names={null} className="mb-1 size-20" />}
          <p className={cx(HEADER_INK, "text-xs font-semibold tracking-[0.08em] uppercase")}>
            {occasion} · {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
          <h1 className="break-words text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl">{title}</h1>
          {(dateLabel || manager) && (
            <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
              {dateLabel && (
                <span className="inline-flex items-center gap-1.5 text-sm text-secondary">
                  <Calendar aria-hidden="true" className="size-4 shrink-0" />
                  {dateLabel}
                </span>
              )}
              {manager && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary">
                  <Users aria-hidden="true" className="size-3.5 shrink-0" />
                  Manager
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {n > 0 && (
        <div className="container mx-auto px-4">
          {/* The 1px gaps show the card's background through as dividers, in
              any arrangement of parts, as in WishListHero. Each part gets
              about 24rem at most, so one event isn't a bar across a wide
              screen. */}
          <ul
            aria-label="About this list"
            className={cx(
              "relative mx-auto -mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[20px] border border-secondary bg-[var(--color-border-secondary)] shadow-[0_8px_24px_rgba(35,27,24,0.06)] sm:-mt-16",
              SM_COLS[smCols],
              LG_COLS[lgCols],
              MAX_WIDTH[lgCols],
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
// About 24rem a part. With two parts on a phone-sized tablet the card still
// fills the width, since max-width only caps it.
const MAX_WIDTH: Record<number, string> = {
  1: "max-w-sm",
  2: "max-w-3xl",
  3: "max-w-6xl",
  4: "max-w-none",
};

/** The look of the band's small square tools, so they line up with the Header button. */
const TOOL =
  "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-secondary transition outline-none hover:bg-primary/80 hover:text-primary focus-visible:ring-2 focus-visible:ring-brand-solid data-[pressed]:bg-primary max-sm:size-11";

function Panel({ className, ...props }: Omit<AriaPopoverProps, "className"> & { className?: string }) {
  return (
    <AriaPopover
      placement="bottom end"
      offset={6}
      containerPadding={12}
      {...props}
      className={(state) =>
        cx(
          "max-w-[calc(100vw-1.5rem)] rounded-xl bg-primary p-4 text-left shadow-lg ring-1 ring-secondary_alt outline-hidden",
          state.isEntering &&
            "duration-150 ease-out animate-in fade-in placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
          state.isExiting && "duration-100 ease-in animate-out fade-out",
          className,
        )
      }
    />
  );
}

/**
 * Share: copies the list's link at once, and opens a panel that says so. The
 * panel changes who can open the list and who sees it on the profile, with
 * the same rules as the Settings page (sharingColumns in
 * src/lib/list-access.ts). Each change saves as soon as it's picked, except
 * going private or public, which warn first and wait for a confirm
 * (accessChangeWarning). A private list has no link to share, so the panel
 * says that instead of showing one.
 *
 * Only the owner chooses who sees it on the profile. A co-manager sees the
 * owner's choice, and a guest account has no profile, so it shows nothing.
 */
function ShareButton({
  registryId,
  path,
  access,
  events,
  manager,
  shareAction,
}: {
  registryId: string;
  path: string;
  access: OwnerListTopProps["access"];
  events: BannerEvent[];
  manager: boolean;
  shareAction: NonNullable<OwnerListTopProps["shareAction"]>;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState<boolean | null>(null);
  // What's saved. It follows the page's data, which reloads after a save.
  const [visibility, setVisibility] = useState(access.visibility);
  const [audience, setAudience] = useState(access.audience);
  useEffect(() => {
    setVisibility(access.visibility);
    setAudience(access.audience);
  }, [access.visibility, access.audience]);
  // A change waiting for its warning's confirm.
  const [pending, setPending] = useState<ListVisibility | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const isOwner = !manager;
  const showProfile = !access.noProfile;
  const isPrivate = visibility === "private";
  const shownVisibility = pending ?? visibility;
  const warning = pending
    ? accessChangeWarning(visibility, pending, {
        events: events.map((event) => event.title),
        onProfile: showProfile && audience !== "hidden",
        isOwner,
      })
    : null;

  const linkFor = () => `${window.location.origin}${path}`;

  const copy = async () => {
    const link = linkFor();
    setUrl(link);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      trackClick("link_copied", { page: "list" });
    } catch {
      setCopied(false);
    }
  };

  const save = async (change: { visibility: ListVisibility; profileAudience?: ProfileAudience }) => {
    const before = { visibility, audience };
    setPending(null);
    setError(null);
    setNotice(null);
    setStatus("saving");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    // Show the choice at once, and put it back if saving fails.
    setVisibility(change.visibility);
    if (change.profileAudience) setAudience(change.profileAudience);
    const result = await shareAction(registryId, change);
    if (result.error !== null) {
      setVisibility(before.visibility);
      setAudience(before.audience);
      setError(result.error);
      setStatus("idle");
      return;
    }
    setVisibility(result.visibility);
    setAudience(result.audience);
    if (showProfile) setNotice(profileChangeNotice(before, result.visibility, isOwner));
    // A list that was private had no link in the panel. Show it now; copying
    // it is one more click, since the browser may refuse a copy this late.
    if (before.visibility === "private" && result.visibility !== "private") {
      setUrl(linkFor());
      setCopied(false);
    }
    setStatus("saved");
    savedTimer.current = setTimeout(() => setStatus("idle"), 2000);
  };

  const chooseVisibility = (next: ListVisibility) => {
    if (next === visibility) {
      setPending(null);
      return;
    }
    const nextWarning = accessChangeWarning(visibility, next, {
      events: [],
      onProfile: false,
      isOwner,
    });
    if (nextWarning) setPending(next);
    else void save({ visibility: next });
  };

  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (open && !isPrivate) void copy();
        if (!open) {
          setPending(null);
          setError(null);
          setNotice(null);
        }
      }}
    >
      <AriaButton className="me-1 inline-flex h-9 cursor-pointer items-center rounded-lg bg-brand-solid px-4 text-sm font-semibold text-primary_on-brand transition outline-none hover:bg-brand-solid_hover focus-visible:ring-2 focus-visible:ring-brand-solid focus-visible:ring-offset-2 max-sm:h-11">
        Share
      </AriaButton>
      <Panel className="w-80">
        <AriaDialog aria-label="Share" className="flex flex-col gap-4 text-sm outline-hidden">
          {({ close }) => (
          <>
          {isPrivate ? (
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-primary">This list is private</p>
              <p className="text-secondary">{LIST_ACCESS.private.description}</p>
            </div>
          ) : (
            <p role="status" className={cx("flex items-center gap-2 font-medium", copied === false ? "text-secondary" : "text-success-primary")}>
              {copied === false ? (
                "Copy the link below."
              ) : (
                <>
                  <Check aria-hidden="true" className="size-4" />
                  Link copied
                </>
              )}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <SelectField
              label="Who can open it"
              value={shownVisibility}
              onChange={(value) => chooseVisibility(value as ListVisibility)}
              options={LIST_VISIBILITIES.map((value) => ({ value, label: LIST_ACCESS[value].label }))}
              disabled={status === "saving"}
            />
            {warning && pending && (
              <div className="flex flex-col gap-1 rounded-lg bg-warning-primary px-3 py-2.5 text-warning-800 dark:text-warning-300">
                <p className="font-semibold">{warning.title}</p>
                <p>{warning.text}</p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" color="secondary" onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    color={pending === "private" ? "primary-destructive" : "primary"}
                    onClick={() => void save({ visibility: pending })}
                  >
                    {warning.confirm}
                  </Button>
                </div>
              </div>
            )}
            {showProfile && shownVisibility !== "private" && (
              isOwner ? (
                <SelectField
                  label="On your profile"
                  value={clampProfileAudience(audience, shownVisibility)}
                  onChange={(value) => void save({ visibility, profileAudience: value as ProfileAudience })}
                  options={profileAudienceChoices(shownVisibility).map((value) => ({
                    value,
                    label: PROFILE_AUDIENCE[value].label,
                  }))}
                  // Who Friends are isn't obvious from the word.
                  hint={audience === "friends" ? PROFILE_AUDIENCE.friends.description : undefined}
                  disabled={status === "saving" || pending !== null}
                />
              ) : (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-tertiary">On the owner&apos;s profile</span>
                  <span className="font-medium text-primary">{PROFILE_AUDIENCE[audience].label}</span>
                </div>
              )
            )}
            {(status !== "idle" || error || notice) && (
              <p role="status" className={cx("text-xs", error ? "text-error-primary" : "text-tertiary")}>
                {error ?? (status === "saving" ? "Saving…" : notice ?? "Saved")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-secondary pt-4">
            {!isPrivate && (
              <input
                aria-label="List link"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 min-w-0 rounded-lg border border-secondary bg-secondary px-2.5 text-xs text-secondary outline-none focus-visible:ring-2 focus-visible:ring-brand-solid"
              />
            )}
            {/* A link opens its page in place, so the panel closes itself. */}
            <Link href={access.href} onClick={close} className="font-medium text-brand-tertiary hover:underline">
              More sharing settings
            </Link>
          </div>
          </>
          )}
        </AriaDialog>
      </Panel>
    </DialogTrigger>
  );
}

/** A gift with a line through it, for gifts the owner can't see. Lucide has no such icon. */
function GiftOff({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

/**
 * A grayed, crossed-out gift, shown when the owner hides what's been
 * reserved from themselves. Hovering shows why. A click opens the same words
 * with links to Gift activity and the setting. The words are the Gift
 * Activity tab's (ReservationsHiddenNotice). The phone app's
 * HiddenGiftsButton does the same.
 */
function HiddenGiftsButton({ hidden }: { hidden: NonNullable<OwnerListTopProps["hidden"]> }) {
  const text = reservationsHiddenText({
    revealedCount: hidden.revealed,
    next: hidden.next,
    turnedOnByExchange: hidden.turnedOnByExchange,
  });
  // Not text.revealed: it says "shown below", which is true on the Gift
  // Activity tab. Here the card's Gift activity part counts them.
  const lines = [text.next, text.why].filter(Boolean) as string[];
  return (
    <DialogTrigger>
      <Tooltip title={text.title} description={lines.join(" ")} placement="bottom">
        <AriaButton aria-label="Gifts hidden from you" className={cx(TOOL, "text-quaternary hover:text-tertiary")}>
          <GiftOff className="size-[18px]" />
        </AriaButton>
      </Tooltip>
      <Panel className="w-80">
        <AriaDialog className="flex flex-col gap-1 text-sm outline-hidden">
          {({ close }) => (
            <>
              <AriaHeading slot="title" className="font-semibold text-primary">
                {text.title}
              </AriaHeading>
              {text.next && <p className="text-secondary">{text.next}</p>}
              <p className="text-tertiary">{text.why}</p>
              {/* The links open their page in place, so the panel closes itself. */}
              <div className="mt-2 flex gap-4">
                <Link href={hidden.href} onClick={close} className="font-medium text-brand-tertiary hover:underline">
                  Gift activity
                </Link>
                {hidden.settingsHref && (
                  <Link href={hidden.settingsHref} onClick={close} className="font-medium text-brand-tertiary hover:underline">
                    Change in settings
                  </Link>
                )}
              </div>
            </>
          )}
        </AriaDialog>
      </Panel>
    </DialogTrigger>
  );
}

/** The ⋯ menu: the owner's tools that don't need a button of their own. */
function MoreMenu({ links }: { links: OwnerListTopProps["links"] }) {
  return (
    <Dropdown.Root>
      <AriaButton aria-label="More" className={TOOL}>
        <MoreHorizontal aria-hidden="true" className="size-[18px]" />
      </AriaButton>
      <Dropdown.Popover placement="bottom end" className="w-56">
        <Dropdown.Menu aria-label="More" selectionMode="none">
          <Dropdown.Item
            id="preview"
            href={links.preview}
            target="_blank"
            rel="noopener noreferrer"
            icon={ExternalLink}
            label="Preview as a guest"
          />
          {links.plan ? <Dropdown.Item id="plan" href={links.plan} icon={CalendarHeart} label="Plan an event" /> : null}
          <Dropdown.Separator />
          <Dropdown.Item id="settings" href={links.settings} icon={Settings} label="Settings" />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

/** One part of the card: an icon, a label and a detail, opening `href`. */
function Row({
  icon: Icon,
  href,
  caption,
  label,
  detail,
  trailing,
}: {
  icon: LucideIcon;
  href: string;
  /** A small line above the label that says what it is, such as "On the invitation for". */
  caption?: string;
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
        {caption && <span className="text-xs text-tertiary">{caption}</span>}
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

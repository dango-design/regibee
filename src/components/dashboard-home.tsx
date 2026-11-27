import Link from "next/link";
import type { ReactNode } from "react";
import { Link2, Plus, UserPlus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardRegistryCard } from "@/components/dashboard-registry-card";
import { HomeSection } from "@/components/home-section";
import { PandaMark } from "@/components/panda-mark";
import { UpcomingEvents } from "@/components/upcoming-events";
import type { DashboardCard, DashboardData } from "@/lib/dashboard-page-types";
import { cx } from "@/lib/utils/cx";

/** What a list's card needs. DashboardCard has it all; the demo builds just this. */
export type HomeList = Pick<
  DashboardCard,
  | "id"
  | "title"
  | "registry_type"
  | "event_type"
  | "event_date"
  | "photo_url"
  | "is_private"
  | "totalItems"
  | "fulfilledItems"
  | "progress"
  | "giftsThisWeek"
  | "reservationsHidden"
>;

export interface DashboardHomeProps
  extends Pick<DashboardData, "giftsThisWeek" | "followRequestCount" | "showProfilePrompt" | "upcomingEvents" | "today"> {
  owned: HomeList[];
  shared: HomeList[];
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
  /** The button at the top right. The demo sends people to sign up instead. */
  newButton?: { label: string; href: string };
  /** Shown under the top row, like the demo's tour. */
  intro?: ReactNode;
}

/** A one-line note that asks the person to do something. The whole row is the link. */
function HomeNote({
  href,
  icon: Icon,
  text,
  action,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  text: string;
  /** The words at the right: a short one on a phone, like the app's, and a longer one on a wider screen. */
  action: { short: string; long: string };
  tone: "blush" | "brand";
}) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2.5 transition hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        tone === "blush" ? "bg-blush-50 dark:bg-blush-300/10" : "bg-brand-primary",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cx("size-4.5 shrink-0", tone === "blush" ? "text-blush-700 dark:text-blush-200" : "text-brand-tertiary")}
      />
      <span className="min-w-0 flex-1 text-primary">{text}</span>
      <span
        className={cx(
          "shrink-0 text-sm font-semibold",
          tone === "blush" ? "text-blush-700 dark:text-blush-200" : "text-brand-secondary",
        )}
      >
        <span className="sm:hidden">{action.short}</span>
        <span className="hidden sm:inline">{action.long}</span>
      </span>
    </Link>
  );
}

/**
 * The My registries tab: first what's waiting on the person, then their
 * events, then their lists. On a wide screen the events sit in a column at
 * the right. The real page (src/app/(protected)/dashboard/(tabs)/(overview)/page.tsx)
 * and the demo both draw this, and the phone app's home screen follows it
 * (mobile/src/app/(tabs)/(home)/index.tsx).
 */
export function DashboardHome({
  owned,
  shared,
  giftsThisWeek,
  followRequestCount,
  showProfilePrompt,
  upcomingEvents,
  today,
  basePath = "",
  newButton = { label: "New", href: `${basePath}/dashboard/new` },
  intro,
}: DashboardHomeProps) {
  const hasEvents = upcomingEvents.length > 0;
  const hasNoLists = owned.length === 0 && shared.length === 0;
  // Two columns of cards next to the events, three when the lists have the width.
  const grid = cx("grid gap-5 sm:grid-cols-2", !hasEvents && "lg:grid-cols-3");
  const card = (list: HomeList, headingLevel: 2 | 3) => (
    <DashboardRegistryCard
      key={list.id}
      title={list.title}
      registryType={list.registry_type}
      eventType={list.event_type}
      eventDate={list.event_date}
      today={today}
      totalItems={list.totalItems}
      fulfilledItems={list.fulfilledItems}
      progress={list.progress}
      giftsThisWeek={list.giftsThisWeek}
      manageHref={`${basePath}/dashboard/registry/${list.id}`}
      photoUrl={list.photo_url}
      isPrivate={list.is_private}
      reservationsHidden={list.reservationsHidden}
      headingLevel={headingLevel}
    />
  );

  return (
    <div className="container mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          {/* The My registries tab is the visible title (see (tabs)/layout.tsx). */}
          <h1 className="sr-only">My Registries</h1>
          {giftsThisWeek > 0 && (
            <p className="flex items-start gap-2 text-tertiary">
              <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-mint-500" />
              {giftsThisWeek === 1 ? "1 gift reserved this week" : `${giftsThisWeek} gifts reserved this week`}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href={newButton.href}>
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4 shrink-0" />
              {newButton.label}
            </span>
          </Link>
        </Button>
      </div>

      {intro && <div className="mt-6">{intro}</div>}

      {/* What's waiting on the person. These show with no lists too:
          someone with no list can still have follow requests. */}
      {(followRequestCount > 0 || showProfilePrompt) && (
        <div className="mt-6 flex flex-col gap-3">
          {followRequestCount > 0 && (
            <HomeNote
              href={`${basePath}/dashboard/account#follow-requests`}
              icon={UserPlus}
              tone="blush"
              text={
                followRequestCount === 1
                  ? "1 person wants to follow you"
                  : `${followRequestCount} people want to follow you`
              }
              action={{ short: "Review", long: "Review requests" }}
            />
          )}
          {showProfilePrompt && (
            <HomeNote
              href={`${basePath}/dashboard/account#profile-registries`}
              icon={Link2}
              tone="brand"
              text="Give friends one link to all your registries"
              action={{ short: "Choose", long: "Choose registries" }}
            />
          )}
        </div>
      )}

      <div className={cx("mt-8 grid gap-10", hasEvents && "lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12")}>
        {/* First on a phone, in the right-hand column on a wide screen. */}
        <UpcomingEvents events={upcomingEvents} today={today} basePath={basePath} className="lg:order-2" />

        <div className="flex min-w-0 flex-col gap-10 lg:order-1">
          {owned.length > 0 && (
            <HomeSection id="your-lists" title="Your lists">
              <div className={grid}>{owned.map((list) => card(list, 3))}</div>
            </HomeSection>
          )}

          {shared.length > 0 && (
            <HomeSection id="shared-lists" title="Shared with you">
              <div className={grid}>{shared.map((list) => card(list, 3))}</div>
            </HomeSection>
          )}

          {hasNoLists && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <PandaMark className="h-20 w-auto" />
                <h2 className="mt-4 text-xl font-semibold">No registries yet</h2>
                <Button className="mt-6" asChild>
                  <Link href={newButton.href}>
                    <span className="inline-flex items-center gap-1.5">
                      <Plus className="h-4 w-4 shrink-0" />
                      Start something new
                    </span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

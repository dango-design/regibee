import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Placeholders shown while a page's data loads (each route's loading.tsx).
// Each one copies the real page's heading and spacing, so nothing jumps when
// the real page replaces it. If you change a page's heading, change it here too.
// The dashboard and Following skeletons show under the dashboard tabs, which
// stay on screen, so they have only a screen-reader heading.

function LoadingMessage({ children }: { children: string }) {
  return (
    <span role="status" className="sr-only">
      {children}
    </span>
  );
}

/** Matches src/components/dashboard-registry-card.tsx. */
function RegistryCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex h-16 items-center justify-between bg-secondary px-5">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div>
          <div className="mb-2 flex justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-8" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-full" />
          <Skeleton className="h-9 w-10 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

/** Matches src/app/(protected)/dashboard/(tabs)/(overview)/page.tsx. */
export function DashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 pt-6 pb-8" aria-busy="true">
      <LoadingMessage>Loading your registries</LoadingMessage>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="sr-only">My Registries</h1>
          <p className="text-tertiary">Manage your registries and track gifts</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new">
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4 shrink-0" />
              New
            </span>
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <RegistryCardSkeleton />
        <RegistryCardSkeleton />
        <RegistryCardSkeleton />
      </div>
    </div>
  );
}

/** Matches src/components/event-card.tsx. */
function EventCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="h-32 bg-secondary" />
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

/** Matches src/components/events-overview.tsx. */
export function EventsSkeleton() {
  return (
    <div className="container mx-auto px-4 pt-6 pb-8" aria-busy="true">
      <LoadingMessage>Loading your events</LoadingMessage>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="sr-only">Events</h1>
          <p className="text-tertiary">Send invitations and track RSVPs</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new">
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4 shrink-0" />
              New
            </span>
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </div>
    </div>
  );
}

function ProfileRegistryCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-secondary bg-primary p-4 shadow-sm">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3.5 w-1/3" />
      </div>
    </div>
  );
}

/** Matches FollowingFeed in src/components/following-feed.tsx. */
export function FollowingSkeleton() {
  return (
    <div className="container mx-auto px-4 pt-6 pb-8" aria-busy="true">
      <div className="max-w-2xl">
        <LoadingMessage>Loading the registries you follow</LoadingMessage>
        <h1 className="sr-only">Following</h1>
        <p className="text-tertiary">Registries from people who&apos;ve approved your follow.</p>

        {/* The people search box */}
        <div className="mt-6 space-y-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>

        <section className="mt-8">
          <Skeleton className="h-6 w-28" />
          <div className="mt-3 flex flex-col gap-3">
            <ProfileRegistryCardSkeleton />
            <ProfileRegistryCardSkeleton />
            <ProfileRegistryCardSkeleton />
          </div>
        </section>
      </div>
    </div>
  );
}

function SavedItemCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-secondary p-3">
      <div className="flex gap-3">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="size-16 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/** The Saved tab while it loads: the filters and a grid of item cards. */
export function SavedSkeleton() {
  return (
    <div className="container mx-auto px-4 pt-6 pb-8" aria-busy="true">
      <LoadingMessage>Loading your saved items</LoadingMessage>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="sr-only">Saved</h1>
          <p className="text-tertiary">Everything on your lists, in one place.</p>
        </div>
        <Skeleton className="h-10 w-36 shrink-0 rounded-lg" />
      </div>

      <section className="mt-6">
        {/* Still wanted / Gifted / All, and the search box */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-9 w-full rounded-lg sm:w-72" />
          <Skeleton className="h-10 w-full rounded-lg sm:max-w-64" />
        </div>

        <div className="mt-4 flex min-h-5 items-center">
          <Skeleton className="h-5 w-32" />
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SavedItemCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Matches the idea cards in src/components/gift-ideas.tsx. */
function GiftIdeaCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-secondary p-3">
      <div className="flex gap-3">
        <Skeleton className="size-16 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-14 rounded-lg" />
      </div>
    </div>
  );
}

/** The Saved tab's Gift ideas view while it loads: one person's ideas. */
export function GiftIdeasSkeleton() {
  return (
    <div className="container mx-auto px-4 pt-6 pb-8" aria-busy="true">
      <LoadingMessage>Loading your gift ideas</LoadingMessage>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="sr-only">Gift ideas</h1>
          <p className="text-tertiary">Gifts you might give other people. Only you can see these.</p>
        </div>
        <Skeleton className="h-10 w-44 shrink-0 rounded-lg" />
      </div>

      <div className="mt-6 flex gap-1.5">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      <section className="mt-11">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-1.5 h-4 w-16" />
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <GiftIdeaCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}

function CheckboxSkeleton() {
  return (
    <div className="flex items-start gap-2">
      <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
    </div>
  );
}

/** Matches AccountSettings in src/components/account-settings.tsx. */
export function AccountSkeleton() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl" aria-busy="true">
      <LoadingMessage>Loading your account</LoadingMessage>
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Account</h1>
      </div>

      {/* Like the page (src/components/account-settings.tsx): its sections
          in a row under the top bar, or a column on the left from lg. */}
      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="-mx-4 mb-6 flex gap-1 overflow-hidden border-b border-secondary px-4 py-2 lg:mx-0 lg:mb-0 lg:flex-col lg:gap-0.5 lg:border-0 lg:p-0">
          {["w-24", "w-24", "w-32", "w-20", "w-20", "w-28", "w-40", "w-28"].map((width, index) => (
            <div key={index} className="flex min-h-9 shrink-0 items-center px-3 lg:min-h-10">
              <Skeleton className={`h-4 ${width}`} />
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldSkeleton />
              <CheckboxSkeleton />
              <CheckboxSkeleton />
              <CheckboxSkeleton />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** A page's back link, as on the event and group pages. */
function BackLinkSkeleton() {
  return (
    <div className="flex items-center max-sm:min-h-11">
      <Skeleton className="h-5 w-24" />
    </div>
  );
}

/** Matches an item's row on a list's manage page (src/components/item-card.tsx). */
function ItemRowSkeleton() {
  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        <Skeleton className="size-20 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Matches src/app/(protected)/dashboard/registry/[registryId]/page.tsx. */
export function ListPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8" aria-busy="true">
      <LoadingMessage>Loading your list</LoadingMessage>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {["Total items", "Gifted", "Completion", "Total value"].map((label) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-tertiary">{label}</p>
              <Skeleton className="mt-1 h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="my-8 h-px bg-border-secondary" />

      <div className="mb-6 flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <div className="space-y-4">
        <ItemRowSkeleton />
        <ItemRowSkeleton />
        <ItemRowSkeleton />
        <ItemRowSkeleton />
      </div>
    </div>
  );
}

/** Matches src/app/(protected)/dashboard/events/[eventId]/page.tsx. */
export function EventPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8" aria-busy="true">
      <LoadingMessage>Loading your event</LoadingMessage>
      <BackLinkSkeleton />
      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-56 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {[0, 1].map((index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Card>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * A page that is one form: a back link, a title, a line under it and fields.
 * `wide` matches the edit event page, which has section links on the left.
 */
export function FormPageSkeleton({
  title,
  message,
  wide = false,
  backLink = true,
}: {
  /** The page's real heading, so it doesn't change when the page arrives. */
  title: string;
  /** What a screen reader hears while the page loads. */
  message: string;
  wide?: boolean;
  backLink?: boolean;
}) {
  return (
    <div
      className={wide ? "container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl" : "container mx-auto max-w-xl px-4 py-8"}
      aria-busy="true"
    >
      <LoadingMessage>{message}</LoadingMessage>
      {backLink && <BackLinkSkeleton />}
      <h1 className={backLink ? "mt-4 text-3xl font-bold" : "text-3xl font-bold"}>{title}</h1>
      <Skeleton className="mt-2 h-5 w-72 max-w-full" />
      <div className="mt-6 space-y-6">
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </div>
  );
}

/** Matches src/app/(protected)/dashboard/new/page.tsx. */
export function PlanPickerSkeleton() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8" aria-busy="true">
      <LoadingMessage>Loading</LoadingMessage>
      <h1 className="text-3xl font-bold">Start something new</h1>
      <p className="mt-1 text-tertiary">
        A gift list on its own, or an event with invitations. You can add the other one later.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Matches src/app/(protected)/dashboard/groups/[groupId]/page.tsx. */
export function GroupSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8" aria-busy="true">
      <LoadingMessage>Loading your group</LoadingMessage>
      <BackLinkSkeleton />
      <div className="mt-4 space-y-6">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** For pages with no skeleton of their own: a title and a few lines. */
export function PageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8" aria-busy="true">
      <LoadingMessage>Loading</LoadingMessage>
      <Skeleton className="h-9 w-64 max-w-full" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Link2, Plus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardRegistryCard } from "@/components/dashboard-registry-card";
import { PandaMark } from "@/components/panda-mark";
import { UpcomingEvents } from "@/components/upcoming-events";
import { loadDashboard, type DashboardCard } from "@/lib/dashboard-page";

function RegistryCard({
  registry,
  today,
  badge,
  headingLevel,
}: {
  registry: DashboardCard;
  today: string;
  badge?: string;
  headingLevel?: 2 | 3;
}) {
  return (
    <DashboardRegistryCard
      title={registry.title}
      registryType={registry.registry_type}
      eventType={registry.event_type}
      eventDate={registry.event_date}
      today={today}
      totalItems={registry.totalItems}
      fulfilledItems={registry.fulfilledItems}
      totalValue={registry.totalValue}
      recentActivity={registry.recentActivity}
      manageHref={`/dashboard/registry/${registry.id}`}
      publicHref={`/r/${registry.slug}`}
      reservationsHidden={registry.reservationsHidden}
      badge={badge}
      headingLevel={headingLevel}
    />
  );
}

export default async function DashboardPage() {
  // The phone app loads the same data (src/lib/dashboard-page.ts).
  const data = await loadDashboard();

  if (!data) {
    redirect("/login");
  }

  const {
    owned: registries,
    shared: sharedRegistries,
    giftsThisWeek,
    followRequestCount,
    showProfilePrompt,
    upcomingEvents,
    today,
  } = data;
  const hasNoRegistries = registries.length === 0 && sharedRegistries.length === 0;

  return (
    <div className="container mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          {/* The My registries tab is the visible title (see (tabs)/layout.tsx). */}
          <h1 className="sr-only">My Registries</h1>
          {giftsThisWeek > 0 ? (
            <p className="flex items-start gap-2 text-tertiary">
              <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-mint-500" />
              {giftsThisWeek === 1 ? "1 gift reserved this week" : `${giftsThisWeek} gifts reserved this week`}
            </p>
          ) : (
            <p className="text-tertiary">Manage your registries and track gifts</p>
          )}
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

      {followRequestCount > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-blush-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
              <UserPlus aria-hidden="true" className="h-4.5 w-4.5 text-blush-700" />
            </span>
            <div>
              <p className="font-medium">
                {followRequestCount === 1
                  ? "1 person wants to follow you"
                  : `${followRequestCount} people want to follow you`}
              </p>
              <p className="text-sm text-tertiary">
                People you approve can see the private registries on your profile.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href="/dashboard/account#follow-requests">Review requests</Link>
          </Button>
        </div>
      )}

      {showProfilePrompt && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
              <Link2 aria-hidden="true" className="h-4.5 w-4.5 text-brand-600" />
            </span>
            <div>
              <p className="font-medium">Give friends one link to all your registries</p>
              <p className="text-sm text-tertiary">
                Your profile shows only the registries you choose. Friends can follow it to see new ones.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href="/dashboard/account#profile-registries">Choose registries</Link>
          </Button>
        </div>
      )}

      {/* The Events tab is easy to miss, so the soonest events show here too. */}
      <UpcomingEvents events={upcomingEvents} today={today} />

      {hasNoRegistries ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <PandaMark className="h-20 w-auto" />
            <h2 className="mt-4 text-xl font-semibold">No registries yet</h2>
            <p className="mt-2 text-tertiary">
              Create your first registry to start adding items.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/dashboard/new">
                <span className="inline-flex items-center gap-1.5">
                  <Plus className="h-4 w-4 shrink-0" />
                  Start something new
                </span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {registries.length > 0 && (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {registries.map((registry) => (
                <RegistryCard key={registry.id} registry={registry} today={today} />
              ))}
            </div>
          )}

          {sharedRegistries.length > 0 && (
            <>
              <div className="mt-10">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Shared with you
                </h2>
                <p className="text-sm text-tertiary mt-1">
                  Registries you&apos;ve been invited to manage
                </p>
              </div>
              <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sharedRegistries.map((registry) => (
                  <RegistryCard key={registry.id} registry={registry} today={today} badge="Manager" headingLevel={3} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

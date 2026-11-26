"use client";

import { DashboardHome, type HomeList } from "@/components/dashboard-home";
import { demoOwnRegistries } from "@/lib/demo-registries";
import { DEMO_FOLLOWS } from "@/lib/demo-people";
import { demoEvents, isDemoHost } from "@/lib/demo-events";
import { formatEventTime, summarizeRsvps } from "@/lib/events";
import { pickUpcomingEvents } from "@/lib/upcoming-events";
import { addDays } from "@/lib/demo-data";
import { useDemoToday } from "../demo-today";
import { DemoOwnerShell } from "../_components/demo-shell";
import { DemoTour } from "../_components/demo-tour";

/** The demo's My registries tab. Like src/app/(protected)/dashboard/(tabs)/(overview)/page.tsx. */
export default function DemoDashboardPage() {
  const today = useDemoToday();
  const registries = demoOwnRegistries(today);
  const weekAgo = `${addDays(today, -7)}T00:00:00Z`;
  const giftsThisWeek = registries
    .flatMap((r) => r.purchases)
    .filter((p) => p.status !== "cancelled" && p.created_at >= weekAgo).length;
  const requestCount = DEMO_FOLLOWS.requests.length;
  // What the Events tab lists (../dashboard/events/page.tsx): events Remi &
  // Max host, then other people's that link their registries.
  const ownIds = new Set(registries.map((r) => r.id));
  const events = demoEvents(today);
  const upcomingEvents = pickUpcomingEvents(
    [
      ...events.filter(isDemoHost).map((event) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        eventType: event.event_type,
        eventDate: event.event_date,
        time: formatEventTime(event),
        role: "host" as const,
        summary: summarizeRsvps(event.guests),
      })),
      ...events
        .filter((e) => !isDemoHost(e) && e.registryId && ownIds.has(e.registryId))
        .map((event) => ({
          id: event.id,
          slug: event.slug,
          title: event.title,
          eventType: event.event_type,
          eventDate: event.event_date,
          time: null,
          role: "celebrating" as const,
          summary: null,
        })),
    ],
    today,
  );

  // Each list as the real page's loader shapes it (src/lib/dashboard-page.ts).
  const owned: HomeList[] = registries.map((registry) => ({
    id: registry.id,
    title: registry.title,
    registry_type: registry.registry_type,
    event_type: registry.event_type,
    event_date: registry.event_date,
    photo_url: null,
    is_private: false,
    totalItems: registry.items.length,
    fulfilledItems: registry.items.filter((i) => i.quantity_fulfilled >= i.quantity_needed).length,
    giftsThisWeek: registry.purchases.filter((p) => p.status !== "cancelled" && p.created_at >= weekAgo).length,
    reservationsHidden: false,
  }));

  return (
    <DemoOwnerShell tabs>
      <DashboardHome
        owned={owned}
        shared={[]}
        giftsThisWeek={giftsThisWeek}
        followRequestCount={requestCount}
        showProfilePrompt={false}
        upcomingEvents={upcomingEvents}
        today={today}
        basePath="/demo"
        // The demo can't make registries, so this is where you make your own.
        newButton={{ label: "New Registry", href: "/signup" }}
        intro={<DemoTour />}
      />
    </DemoOwnerShell>
  );
}

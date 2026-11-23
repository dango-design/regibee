import { redirect } from "next/navigation";
import { EventsOverview } from "@/components/events-overview";
import { GroupsSection } from "@/components/groups-section";
import { loadEventsTab } from "@/lib/events-page";

export default async function EventsPage() {
  // The phone app loads the same data (src/lib/events-page.ts).
  const data = await loadEventsTab();
  if (!data) redirect("/login");

  const toCard = (event: (typeof data.upcoming)[number]) => ({
    id: event.id,
    title: event.title,
    eventType: event.eventType,
    eventDate: event.eventDate,
    time: event.time,
    imageUrl: event.imageUrl,
    today: data.today,
    summary: event.summary,
    manageHref: `/dashboard/events/${event.id}`,
    publicHref: `/e/${event.slug}`,
    badge: event.coHost ? "Co-host" : undefined,
  });

  // Someone else's event opens its invitation on the viewer's own guest link,
  // so they can RSVP.
  const toInviteCard = (event: (typeof data.invited)[number]) => ({
    id: event.id,
    title: event.title,
    eventType: event.eventType,
    eventDate: event.eventDate,
    time: event.time,
    imageUrl: event.imageUrl,
    today: data.today,
    hostedBy: event.hostedBy,
    rsvp: event.rsvp,
    href: `/e/${event.slug}?g=${encodeURIComponent(event.guestToken)}`,
  });

  return (
    <>
      <EventsOverview
        upcoming={data.upcoming.map(toCard)}
        past={data.past.map(toCard)}
        invited={data.invited.map(toInviteCard)}
        invitedPast={data.invitedPast.map(toInviteCard)}
        linked={data.linked.map((event) => ({
          id: event.id,
          title: event.title,
          dateText: event.dateText,
          registryTitles: event.registryTitles,
          href: `/e/${event.slug}`,
        }))}
      />
      <div className="container mx-auto px-4 pb-8">
        <GroupsSection groups={data.groups} />
      </div>
    </>
  );
}

import type { Meta, StoryObj } from "@storybook/react";
import { EventsOverview } from "./events-overview";
import { DashboardTabs } from "./dashboard-tabs";
import { formatEventTime, formatShortEventDate, summarizeRsvps } from "@/lib/events";
import { SAMPLE_TODAY, sampleEvent, sampleGuests, sampleLinkedRegistries } from "@/lib/event-sample-data";

// The Events tab. Its page loads events on the server, which Storybook can't
// render, so these pass the cards in.

const base = {
  today: SAMPLE_TODAY,
  manageHref: "#",
  publicHref: "#",
};

// Other people's events you're on the guest list for, with your own reply.
const invitedBase = {
  today: SAMPLE_TODAY,
  href: "#",
};

const meta: Meta<typeof EventsOverview> = {
  title: "Pages/Events",
  component: EventsOverview,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard/events" } },
  },
  render: (args) => (
    <>
      <DashboardTabs hasAccount />
      <EventsOverview {...args} />
    </>
  ),
};
export default meta;
type Story = StoryObj<typeof EventsOverview>;

export const WithEvents: Story = {
  args: {
    upcoming: [
      {
        ...base,
        id: "shower",
        title: sampleEvent.title,
        eventType: "baby_shower",
        eventDate: sampleEvent.event_date,
        time: formatEventTime(sampleEvent),
        imageUrl: sampleEvent.image_url,
        summary: summarizeRsvps(sampleGuests),
      },
      {
        ...base,
        id: "birthday",
        title: "Max Turns 30",
        eventType: "birthday",
        eventDate: "2026-04-18",
        time: "7 – 11 PM PDT",
        imageUrl: null,
        summary: { guests: 0, attending: 0, maybe: 0, pending: 0, invited: 0 },
        badge: "Co-host",
      },
      {
        ...base,
        id: "holiday",
        title: "Cookie Swap",
        eventType: "christmas",
        eventDate: null,
        time: null,
        imageUrl: null,
        summary: { guests: 4, attending: 0, maybe: 0, pending: 4, invited: 0 },
      },
    ],
    past: [
      {
        ...base,
        id: "housewarming",
        title: "Come See Our New Place",
        eventType: "housewarming",
        eventDate: "2026-01-10",
        time: "1 – 4 PM PST",
        imageUrl: null,
        summary: { guests: 18, attending: 22, maybe: 0, pending: 2, invited: 18 },
      },
    ],
    invited: [
      {
        ...invitedBase,
        id: "game-night",
        title: "Game Night at Priya's",
        eventType: "gathering",
        eventDate: "2026-03-07",
        time: "7 – 10 PM PST",
        imageUrl: null,
        hostedBy: "Priya",
        rsvp: "pending",
      },
      {
        ...invitedBase,
        id: "graduation",
        title: "Jordan's Graduation Party",
        eventType: "graduation",
        eventDate: "2026-05-30",
        time: "3 – 6 PM PDT",
        imageUrl: null,
        hostedBy: "The Parks",
        rsvp: "yes",
      },
      {
        ...invitedBase,
        id: "potluck",
        title: "Neighborhood Potluck",
        eventType: "other",
        eventDate: null,
        time: null,
        imageUrl: null,
        hostedBy: null,
        rsvp: "maybe",
      },
    ],
    invitedPast: [
      {
        ...invitedBase,
        id: "new-year",
        title: "New Year's Eve Party",
        eventType: "holiday",
        eventDate: "2025-12-31",
        time: "9 PM – 1 AM PST",
        imageUrl: null,
        hostedBy: "Sam & Alex",
        rsvp: "no",
      },
    ],
  },
};

/**
 * Someone who hosts nothing but is on two guest lists sees them under
 * Invited, not the "Plan your first event" card.
 */
export const InvitedOnly: Story = {
  args: {
    upcoming: [],
    past: [],
    invited: [
      {
        ...invitedBase,
        id: "shower",
        title: sampleEvent.title,
        eventType: "baby_shower",
        eventDate: sampleEvent.event_date,
        time: formatEventTime(sampleEvent),
        imageUrl: sampleEvent.image_url,
        hostedBy: sampleEvent.hosted_by,
        rsvp: "yes",
      },
      {
        ...invitedBase,
        id: "game-night",
        title: "Game Night at Priya's",
        eventType: "gathering",
        eventDate: "2026-03-07",
        time: "7 – 10 PM PST",
        imageUrl: null,
        hostedBy: "Priya",
        rsvp: "pending",
      },
    ],
  },
};

export const Empty: Story = { args: { upcoming: [], past: [] } };

/**
 * Remi & Max haven't planned an event, but friends are hosting two that link
 * their registries. Those show as "Celebrating you" above the empty state.
 */
export const CelebratingYou: Story = {
  args: {
    upcoming: [],
    past: [],
    linked: [
      {
        id: sampleEvent.id,
        title: sampleEvent.title,
        dateText: formatShortEventDate(sampleEvent.event_date!),
        registryTitles: sampleLinkedRegistries.map((r) => r.title),
        href: `/e/${sampleEvent.slug}`,
      },
      {
        id: "sip-and-see",
        title: "Come Meet Baby Remi",
        dateText: null,
        registryTitles: [sampleLinkedRegistries[0].title],
        href: "#",
      },
    ],
  },
};

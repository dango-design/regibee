import type { Meta, StoryObj } from "@storybook/react";
import type { DashboardEvent } from "@/lib/dashboard-page-types";
import { UpcomingEvents } from "./upcoming-events";

// A fixed "today", so the countdowns don't change from day to day in Chromatic.
const TODAY = "2026-11-20";

const shower: DashboardEvent = {
  id: "shower",
  slug: "remi-and-max-baby-shower-7k2m",
  title: "Remi & Max's Baby Shower",
  eventType: "baby_shower",
  eventDate: "2026-11-21",
  time: "2 – 5 PM PST",
  role: "host",
  summary: { guests: 18, attending: 11, maybe: 2, pending: 4 },
};

const santa: DashboardEvent = {
  id: "santa",
  slug: "friendsmas-secret-santa-4n8p",
  title: "Friendsmas Secret Santa",
  eventType: "gift_exchange",
  eventDate: "2026-12-12",
  time: "7 PM PST",
  role: "host",
  summary: { guests: 8, attending: 6, maybe: 0, pending: 2 },
};

const birthday: DashboardEvent = {
  id: "birthday",
  slug: "max-turns-30-z5t7",
  title: "Max Turns 30",
  eventType: "birthday",
  eventDate: "2026-12-30",
  time: null,
  role: "host",
  summary: { guests: 0, attending: 0, maybe: 0, pending: 0 },
};

const meta: Meta<typeof UpcomingEvents> = {
  title: "Components/UpcomingEvents",
  component: UpcomingEvents,
  decorators: [
    (Story) => (
      <div className="container mx-auto px-4 pb-8">
        <Story />
      </div>
    ),
  ],
  args: { today: TODAY, events: [shower, santa, birthday] },
};
export default meta;
type Story = StoryObj<typeof UpcomingEvents>;

// Soonest first. Tomorrow's stands out.
export const ThreeComingUp: Story = {};

// An event today, and a shower a friend is throwing, which opens its invitation.
export const TodayAndCelebratingYou: Story = {
  args: {
    events: [
      { ...santa, id: "cookies", eventType: "holiday", eventDate: TODAY, title: "Cookie Swap" },
      {
        id: "friends-shower",
        slug: "shower-for-remi-and-max-9q3w",
        title: "Shower for Remi & Max, hosted by Glinda",
        eventType: "baby_shower",
        eventDate: "2026-12-06",
        time: null,
        role: "celebrating",
        summary: null,
      },
    ],
  },
};

// A phone-sized screen, with a long title.
export const Mobile: Story = {
  args: {
    events: [
      shower,
      { ...birthday, title: "Elphaba's Thirtieth Birthday Picnic in the Emerald City Botanical Gardens" },
    ],
  },
  globals: { viewport: { value: "mobile1" } },
};

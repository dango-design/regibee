import type { Meta, StoryObj } from "@storybook/react";
import { DashboardHome, type DashboardHomeProps, type HomeList } from "./dashboard-home";

// A fixed "today", so the countdowns don't change from day to day in Chromatic.
const TODAY = "2026-11-20";

const babyList: HomeList = {
  id: "baby",
  title: "Remi & Max's Baby Registry",
  registry_type: "baby",
  event_type: null,
  event_date: "2027-02-14",
  photo_url: null,
  is_private: false,
  totalItems: 32,
  fulfilledItems: 9,
  giftsThisWeek: 3,
  reservationsHidden: false,
};

const grandmaList: HomeList = {
  id: "grandma",
  title: "Grandma Rose turns 80",
  registry_type: "personal",
  event_type: "birthday",
  event_date: "2027-01-09",
  photo_url: null,
  is_private: false,
  totalItems: 10,
  fulfilledItems: 6,
  giftsThisWeek: 0,
  reservationsHidden: false,
};

const base: DashboardHomeProps = {
  owned: [babyList],
  shared: [grandmaList],
  giftsThisWeek: 3,
  followRequestCount: 0,
  showProfilePrompt: true,
  upcomingEvents: [],
  today: TODAY,
};

const meta: Meta<typeof DashboardHome> = {
  title: "Components/DashboardHome",
  component: DashboardHome,
  args: base,
};
export default meta;
type Story = StoryObj<typeof DashboardHome>;

// No events coming up, so the lists take the whole width. One list is shared
// with the account, and none is on their profile yet.
export const SharedWithYou: Story = {};

// No lists yet, with an event coming up.
export const NoListsYet: Story = {
  args: {
    owned: [],
    shared: [],
    giftsThisWeek: 0,
    showProfilePrompt: false,
    followRequestCount: 1,
    upcomingEvents: [
      {
        id: "game-night",
        slug: "game-night-at-priyas-3h6d",
        title: "Game Night at Priya's",
        eventType: "gathering",
        eventDate: "2026-11-28",
        time: "7 – 10 PM PST",
        role: "guest",
        summary: null,
        rsvp: "yes",
        guestToken: "sample-guest-token",
      },
    ],
  },
};

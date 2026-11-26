import type { Meta, StoryObj } from "@storybook/react";
import { DashboardRegistryCard, type DashboardRegistryCardProps } from "./dashboard-registry-card";

// A fixed "today", so the countdowns don't change from day to day in Chromatic.
const TODAY = "2026-11-07";

const base: DashboardRegistryCardProps = {
  title: "Remi & Max's Baby Registry",
  registryType: "baby",
  eventType: null,
  eventDate: "2027-03-14",
  today: TODAY,
  totalItems: 32,
  fulfilledItems: 9,
  giftsThisWeek: 2,
  manageHref: "/dashboard/registry/demo",
};

const meta: Meta<typeof DashboardRegistryCard> = {
  title: "Components/DashboardRegistryCard",
  component: DashboardRegistryCard,
  args: base,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof DashboardRegistryCard>;

export const Baby: Story = {};

export const Birthday: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    title: "Maya turns 30",
    registryType: "personal",
    eventType: "birthday",
    eventDate: "2026-11-19",
    totalItems: 10,
    fulfilledItems: 4,
    giftsThisWeek: 0,
  },
};

export const ChristmasTomorrow: Story = {
  args: {
    title: "The Parks' Christmas list",
    registryType: "personal",
    eventType: "christmas",
    eventDate: "2026-11-08",
    totalItems: 6,
    fulfilledItems: 1,
    giftsThisWeek: 0,
  },
};

export const WeddingAllDone: Story = {
  args: {
    title: "Ana & Leo's Wedding",
    registryType: "personal",
    eventType: "wedding",
    eventDate: "2026-09-06",
    totalItems: 18,
    fulfilledItems: 18,
    giftsThisWeek: 0,
  },
};

export const SharedNoDate: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    title: "Office Holiday Swap",
    registryType: "personal",
    eventType: "other",
    eventDate: null,
    totalItems: 0,
    fulfilledItems: 0,
    giftsThisWeek: 0,
  },
};

// The owner hid what's been reserved from themselves, as Regibee does for a
// wishlist in a gift exchange. The card says so instead of showing progress.
export const ReservationsHidden: Story = {
  args: {
    title: "Maya's Christmas wishlist",
    registryType: "personal",
    eventType: "christmas",
    eventDate: "2026-12-25",
    totalItems: 8,
    fulfilledItems: 0,
    giftsThisWeek: 0,
    reservationsHidden: true,
  },
};

// Only its owner and co-managers can open it.
export const Private: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    title: "Our housewarming",
    registryType: "personal",
    eventType: "housewarming",
    eventDate: null,
    totalItems: 14,
    fulfilledItems: 3,
    giftsThisWeek: 1,
    isPrivate: true,
  },
};

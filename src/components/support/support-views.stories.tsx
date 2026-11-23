import type { Meta, StoryObj } from "@storybook/react";
import type { ListPageData } from "@/lib/list-page-types";
import type { SupportAccount, SupportListFacts, SupportSearchResults } from "@/lib/support";
import { SupportAccountView } from "./support-account";
import { SupportListView } from "./support-list";
import { SupportSearch } from "./support-search";

// The support team's pages (/support). The data is made up.

const meta: Meta = {
  title: "Pages/Support",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const LIST_ID = "00000000-0000-4000-8000-000000000002";

const results: SupportSearchResults = {
  accounts: [
    { id: OWNER_ID, email: "remi@example.com", name: "Remi Chen", confirmed: true, createdAt: "2026-10-02T18:20:00Z" },
    { id: "00000000-0000-4000-8000-000000000003", email: "remi.c@example.com", name: null, confirmed: false, createdAt: "2026-11-20T09:05:00Z" },
  ],
  lists: [
    {
      id: LIST_ID,
      title: "Remi & Max's Baby Registry",
      slug: "remi-max-s-baby-registry-k7m2p9qx4tab",
      ownerId: OWNER_ID,
      ownerName: "Remi Chen",
      isPrivate: false,
      isPublic: false,
      createdAt: "2026-10-03T16:00:00Z",
    },
  ],
};

export const Search: Story = {
  render: () => <SupportSearch query="remi" results={results} />,
};

const account: SupportAccount = {
  id: OWNER_ID,
  email: "remi@example.com",
  name: "Remi Chen",
  profilePath: "/u/remi-chen-k7m2p9qx4t",
  confirmed: true,
  createdAt: "2026-10-02T18:20:00Z",
  lastSignInAt: "2026-11-21T22:41:00Z",
  signInMethods: ["email"],
  level: "basic",
  emailsToday: { sent: 12, limit: 50 },
  ownedLists: [
    {
      id: LIST_ID,
      title: "Remi & Max's Baby Registry",
      slug: "remi-max-s-baby-registry-k7m2p9qx4tab",
      isPrivate: false,
      isPublic: false,
      registryType: "baby",
      eventType: null,
      eventDate: "2027-02-14",
      createdAt: "2026-10-03T16:00:00Z",
      itemCount: 24,
    },
    {
      id: "00000000-0000-4000-8000-000000000004",
      title: "Remi's Christmas List",
      slug: "remi-s-christmas-list-a2b3c4d5e6f7",
      isPrivate: true,
      isPublic: false,
      registryType: "personal",
      eventType: "christmas",
      eventDate: null,
      createdAt: "2026-11-10T12:00:00Z",
      itemCount: 3,
    },
  ],
  managedLists: [],
  events: [
    {
      id: "00000000-0000-4000-8000-000000000005",
      title: "Remi's Baby Shower",
      eventType: "baby_shower",
      eventDate: "2027-01-10",
      guestCount: 18,
      owns: true,
    },
  ],
  giftIdeas: [
    {
      id: "00000000-0000-4000-8000-000000000006",
      recipient: "Mom",
      title: "Cashmere Wrap Scarf",
      externalUrl: "https://example.com/scarf",
      imageUrl: null,
      price: 89,
      notes: null,
      boughtAt: null,
      createdAt: "2026-11-15T10:00:00Z",
    },
  ],
};

export const Account: Story = {
  render: () => <SupportAccountView account={account} />,
};

const page = {
  registry: {
    id: LIST_ID,
    owner_id: OWNER_ID,
    title: "Remi & Max's Baby Registry",
    slug: "remi-max-s-baby-registry-k7m2p9qx4tab",
    event_date: "2027-02-14",
    registry_type: "baby",
    event_type: null,
    settings: { hide_reservations: true },
    is_public: false,
    is_private: false,
    created_at: "2026-10-03T16:00:00Z",
  },
  isOwner: true,
  categories: [{ id: "c1", name: "Nursery", sort_order: 0 }],
  items: [
    {
      id: "i1",
      registry_id: LIST_ID,
      title: "Hatch Rest Sound Machine",
      external_url: "https://example.com/hatch",
      image_url: null,
      price: 59.99,
      quantity_needed: 1,
      quantity_fulfilled: 0,
      is_essential: true,
      is_parent_purchased: false,
      is_open_to_used: false,
      minimum_condition: null,
      notes: null,
      category_id: "c1",
      sort_order: 0,
      created_at: "2026-10-03T16:05:00Z",
      home_registry_id: LIST_ID,
      placed: false,
      otherLists: [],
    },
    {
      id: "i2",
      registry_id: LIST_ID,
      title: "Muslin Swaddle Blankets, 4 pack",
      external_url: null,
      image_url: null,
      price: 39,
      quantity_needed: 2,
      quantity_fulfilled: 0,
      is_essential: false,
      is_parent_purchased: false,
      is_open_to_used: true,
      minimum_condition: null,
      notes: "Any neutral colors",
      category_id: null,
      sort_order: 1,
      created_at: "2026-10-03T16:06:00Z",
      home_registry_id: LIST_ID,
      placed: false,
      otherLists: ["Remi's Christmas List"],
    },
  ],
  funds: [{ id: "f1", title: "Diaper Fund", description: null, goal_amount: 300, current_amount: 0 }],
  purchases: [],
  suggestions: [
    {
      id: "s1",
      title: "Baby Bjorn Bouncer",
      external_url: null,
      price: 199,
      notes: null,
      suggested_by_name: "Aunt Linda",
      suggested_by_email: "linda@example.com",
      status: "pending",
      created_at: "2026-11-18T08:00:00Z",
    },
  ],
  pendingSuggestionCount: 1,
  hideReservations: true,
  turnedOnByExchange: false,
  linkedEvents: [
    {
      id: "e1",
      slug: "remi-s-baby-shower",
      title: "Remi's Baby Shower",
      event_date: "2027-01-10",
      event_type: "baby_shower",
      canManage: true,
    },
  ],
  showChecklist: true,
  checklistProgress: { matched: 2, total: 40 },
  plainLinkGroups: [],
  perkRows: [],
  perkEmails: false,
  readyPerkCount: 0,
  canPlanEvents: true,
  eventPromptDismissed: false,
  showPlanEventButton: false,
} as unknown as ListPageData;

const facts: SupportListFacts = {
  owner: { id: OWNER_ID, name: "Remi Chen", email: "remi@example.com" },
  managers: [{ id: "00000000-0000-4000-8000-000000000007", name: "Max Chen", email: "max@example.com" }],
  pendingInvites: [{ email: "grandma@example.com", expiresAt: "2026-11-28T00:00:00Z" }],
  oldLinkCount: 1,
};

export const List: Story = {
  render: () => <SupportListView page={page} facts={facts} showHiddenGifts={false} ownerHidesGifts />,
};

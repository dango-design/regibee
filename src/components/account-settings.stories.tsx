import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";
import { AccountSettings, type AccountRegistry } from "./account-settings";

const mockSave = async () => {
  await new Promise((r) => setTimeout(r, 500));
  return { success: true };
};
const mockList = async () => ({ success: true });

const registries: AccountRegistry[] = [
  {
    id: "1",
    title: "Remi & Max's Baby Registry",
    is_public: true,
    listed_on_profile: true,
    has_shipping_address: true,
    registry_type: "baby",
    event_type: null,
  },
  {
    id: "2",
    title: "Max's 30th Birthday",
    is_public: true,
    listed_on_profile: true,
    profile_audience: "friends",
    has_shipping_address: false,
    registry_type: "personal",
    event_type: "birthday",
  },
  {
    id: "3",
    title: "Secret Santa List",
    is_public: false,
    listed_on_profile: false,
    has_shipping_address: false,
    registry_type: "personal",
    event_type: "christmas",
  },
  {
    id: "4",
    title: "Ideas for Later",
    is_public: false,
    is_private: true,
    listed_on_profile: false,
    has_shipping_address: false,
    registry_type: "personal",
    event_type: null,
  },
];

// The page goes to the section in the URL's #fragment when it first shows,
// and Storybook keeps the URL between stories, so each story starts without one.
const withoutSectionInUrl: Decorator = (Story) => {
  if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return <Story />;
};

const meta: Meta<typeof AccountSettings> = {
  title: "Components/AccountSettings",
  component: AccountSettings,
  decorators: [withoutSectionInUrl],
  args: {
    registries,
    saveAction: mockSave as never,
    listAction: mockList as never,
    uploadPhoto: async () => ({ url: "/hero/panda.svg" }),
    photoAction: mockList,
    giftProfileAction: mockSave,
    birthdayEmailsAction: mockList,
    deleteAccountActions: {
      loadSummary: async () => ({ deleted: [], handedOver: [], leaving: [], events: 0 }),
      deleteAction: async () => ({}),
    },
  },
};
export default meta;
type Story = StoryObj<typeof AccountSettings>;

// A new account: findable by name and email, no followers yet, an empty gift
// profile and birthday emails on.
export const NewAccount: Story = {
  args: {
    profile: {
      public_id: "k7m2p9qx4t",
      full_name: "Remi & Max",
      discoverable: true,
      findable_by_email: true,
    },
    follows: { requests: [], followers: [], following: [] },
    giftProfile: {},
    birthdayEmails: true,
  },
};

// With a profile photo: Change photo and Remove.
export const WithPhoto: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    profile: {
      public_id: "k7m2p9qx4t",
      full_name: "Remi & Max",
      avatar_url: "/hero/panda.svg",
      discoverable: true,
      findable_by_email: true,
    },
    follows: { requests: [], followers: [], following: [] },
    giftProfile: {},
    birthdayEmails: true,
  },
};

// An older account that hasn't turned on email search, with a request waiting.
export const WithFollowers: Story = {
  args: {
    profile: { public_id: "k7m2p9qx4t", full_name: "Remi & Max", discoverable: true },
    follows: {
      requests: [{ public_id: "r4d8w2nb6h", full_name: "Grandma Dorothy", status: "pending" }],
      followers: [{ public_id: "a3f9c2xz7e", full_name: "Alex Kim", status: "approved" }],
      following: [],
    },
  },
};

const withRequests = {
  profile: { public_id: "k7m2p9qx4t", full_name: "Remi & Max", discoverable: true, findable_by_email: true },
  follows: {
    requests: [
      { public_id: "r4d8w2nb6h", full_name: "Grandma Dorothy", status: "pending" as const },
      { public_id: "s6g2t8vy3j", full_name: "Sam Ortiz", status: "pending" as const },
    ],
    followers: [{ public_id: "a3f9c2xz7e", full_name: "Alex Kim", status: "approved" as const }],
    following: [],
  },
  giftProfile: {},
  birthdayEmails: true,
};

// Arriving from the dashboard's Review requests button, or a follow request
// email. Those emails used to link to #follows, which still lands here: the
// Follow requests section is current in the navigation, and focus is on its
// title, so Approve and Decline are the next things to Tab to.
export const LandedOnFollowRequests: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: withRequests,
  globals: { viewport: { value: "desktop" } },
  play: async ({ canvas }) => {
    window.location.hash = "follows";
    const nav = within(canvas.getByRole("navigation", { name: "Account sections" }));
    await waitFor(() =>
      expect(nav.getByRole("link", { name: "Follow requests 2 waiting" })).toHaveAttribute("aria-current", "location"),
    );
    await expect(canvas.getByRole("heading", { name: "Follow requests" })).toHaveFocus();
    await expect(window.location.hash).toBe("#follow-requests");
  },
};

// On a phone, the sections are a row of links under the top bar.
export const Phone: Story = {
  args: withRequests,
  globals: { viewport: { value: "mobile1" } },
};

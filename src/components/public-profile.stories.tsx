import type { Meta, StoryObj } from "@storybook/react";
import { FollowButton } from "./follow-button";
import { PublicProfile } from "./public-profile";
import { PHONE_MODES } from "@/stories/viewports";

const mockFollow = async () => ({ success: true });

const meta: Meta<typeof PublicProfile> = {
  title: "Components/PublicProfile",
  component: PublicProfile,
  args: {
    fullName: "Remi & Max",
    today: "2026-11-02",
    registries: [
      {
        slug: "past-housewarming",
        title: "Our New Home",
        event_date: "2026-03-14",
        registry_type: "personal",
        event_type: "housewarming",
        is_public: true,
      },
      {
        slug: "anytime-wishlist",
        title: "Remi's Wishlist",
        event_date: null,
        registry_type: "personal",
        event_type: null,
        is_public: true,
      },
      {
        slug: "christmas",
        title: "Remi & Max's Christmas",
        event_date: "2026-12-25",
        registry_type: "personal",
        event_type: "christmas",
        is_public: true,
      },
      {
        slug: "baby",
        title: "Remi & Max's Baby Registry",
        event_date: "2027-02-10",
        registry_type: "baby",
        event_type: null,
        is_public: false,
      },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof PublicProfile>;

// What an approved follower or the owner sees: private ones carry a badge.
export const WithRegistries: Story = {
  args: {
    followAction: <FollowButton
        publicId="k7m2p9qx4t"
        name="Remi & Max"
        state="approved"
        returnTo="/u/remi-max-k7m2p9qx4t"
        cancelAction={mockFollow}
      />,
  },
};

// A signed-in visitor who goes to some of the same events: they show under
// the registries, upcoming first, then past.
export const WithSharedEvents: Story = {
  args: {
    sharedEvents: [
      {
        id: "1",
        title: "Friendsgiving potluck",
        eventType: "potluck",
        eventDate: "2026-11-21",
        time: "5 – 9 PM PST",
        href: "/e/friendsgiving?g=token",
      },
      {
        id: "2",
        title: "Remi & Max's baby shower",
        eventType: "baby_shower",
        eventDate: null,
        time: null,
        href: "/dashboard/events/2",
      },
      {
        id: "3",
        title: "Jo's 30th birthday",
        eventType: "birthday",
        eventDate: "2026-08-15",
        time: "7 PM PDT",
        href: "/e/jo-30?g=token",
      },
    ],
    followAction: (
      <FollowButton
        publicId="k7m2p9qx4t"
        name="Remi & Max"
        state="approved"
        followsYou
        returnTo="/u/remi-max-k7m2p9qx4t"
        cancelAction={mockFollow}
      />
    ),
  },
};

// A profile with a photo, which shows instead of the initials.
export const WithPhoto: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    photoUrl: "/hero/panda.svg",
    isOwnProfile: true,
  },
};

// A visitor who doesn't follow yet, and nothing they can see: the empty state.
export const VisitorNotFollowing: Story = {
  args: {
    registries: [],
    followAction: (
      <FollowButton
        publicId="k7m2p9qx4t"
        name="Remi & Max"
        state="none"
        returnTo="/u/remi-max-k7m2p9qx4t"
        requestAction={mockFollow}
        cancelAction={mockFollow}
      />
    ),
  },
};

// The owner's own gift profile, with a line under its heading that says who
// sees each part.
export const OwnGiftProfile: Story = {
  args: {
    isOwnProfile: true,
    giftProfile: {
      birthday: { month: 3, day: 3 },
      sizes: { tops: "M", shoes: "8.5" },
      likes: ["Bubbles", "Tea", "Gardening"],
      skip: ["Candles"],
      audience: { birthday: "everyone", sizes: "private" },
    },
    showBirthday: true,
  },
};

// The owner's own page: "Edit profile" in place of the follow button, and a
// link to choose registries in the empty state.
export const OwnProfileNothingListed: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { registries: [], isOwnProfile: true },
};


// A friend's profile: they follow each other, so the button says so, and the
// gift profile shows. Anyone else sees only the name, photo, public note and
// registries. A follower who isn't followed back sees the birthday too.
export const FriendWithGiftProfile: Story = {
  args: {
    publicNote: "Mostly here for birthdays.\nNo gifts needed for the housewarming!",
    giftProfile: {
      birthday: { month: 3, day: 3 },
      sizes: { tops: "M", shoes: "8.5" },
      colors: "Soft pink, silver",
      likes: ["Bubbles", "Tea", "Gardening"],
      skip: ["Candles"],
    },
    showBirthday: true,
    followAction: (
      <FollowButton
        publicId="k7m2p9qx4t"
        name="Remi & Max"
        state="approved"
        followsYou
        returnTo="/u/remi-max-k7m2p9qx4t"
        cancelAction={mockFollow}
      />
    ),
  },
  parameters: { chromatic: { modes: PHONE_MODES } },
  globals: { viewport: { value: "mobile1" } },
};

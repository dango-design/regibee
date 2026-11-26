import type { Meta, StoryObj } from "@storybook/react";
import type { GiftProfile } from "@/lib/gift-profile";
import { GiftProfileCard } from "./gift-profile-card";

const dorothy: GiftProfile = {
  birthday: { month: 6, day: 1 },
  sizes: { tops: "S", bottoms: "28", shoes: "7", other: "Hat M" },
  colors: "Gingham blue, ruby red",
  likes: ["Hiking", "Baking", "Mystery novels", "Houseplants", "Jigsaw puzzles", "Vinyl"],
  skip: ["Perfume", "Scented candles"],
  notes: "A small kitchen, so nothing bulky please.",
};

const meta: Meta<typeof GiftProfileCard> = {
  title: "Components/GiftProfileCard",
  component: GiftProfileCard,
  args: { profile: dorothy, name: "Dorothy" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md p-4">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof GiftProfileCard>;

// A child's gift profile, as anyone who opens the child's list sees it: no
// birthday.
export const OnAWishList: Story = {};

// What the people Dorothy follows, who follow her back, see on her profile.
export const ForFollowers: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { showBirthday: true },
};

// Dorothy's own profile, with the line saying who sees the card.
export const OwnProfile: Story = {
  args: {
    showBirthday: true,
    caption: "Only you and your friends see this. Approved followers see your birthday.",
  },
};

// Only a couple of fields filled in.
export const Short: Story = {
  args: {
    name: "Scarecrow",
    showBirthday: true,
    profile: { birthday: { month: 10, day: 31 }, likes: ["Crosswords", "Philosophy books"] },
  },
};

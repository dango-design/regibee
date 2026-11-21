import type { Decorator, Meta, StoryObj } from "@storybook/react";
import type { GiftProfile } from "@/lib/gift-profile";
import { FollowButton, type FollowButtonState } from "./follow-button";
import { GiftProfileCard } from "./gift-profile-card";
import { NavBar } from "./nav-bar";
import { PublicRegistryGrid } from "./public-registry-grid";
import { PublicRegistryHero } from "./public-registry-hero";
import { SuggestItemDialog } from "./suggest-item-dialog";

// The stories never follow anyone or send a suggestion.
const mockFollow = async () => ({ success: true });

const item = (id: string, title: string, price: number, fulfilled = 0) => ({
  id,
  title,
  price,
  external_url: null,
  image_url: null,
  quantity_needed: 1,
  quantity_fulfilled: fulfilled,
  is_essential: false,
  is_parent_purchased: false,
  is_open_to_used: false,
  minimum_condition: null,
  notes: null,
  category_id: "kitchen",
});

const items = [
  item("1", "Bread Knife", 35),
  item("2", "Sourdough Starter Kit", 28, 1),
  item("3", "Linen Apron", 42),
  item("4", "Enameled Dutch Oven", 120),
  item("5", "Proofing Basket", 24),
  item("6", "Bench Scraper", 12),
];
const categories = [{ id: "kitchen", name: "Kitchen", sort_order: 0 }];

/**
 * The share page around the header (src/app/r/[slug]/page.tsx): the site's
 * top bar, signed out, above it and the items under it, so a snapshot shows
 * where the list starts.
 */
const withListPage: Decorator = (Story) => (
  <div className="min-h-screen bg-primary">
    <NavBar account={null} returnTo="/r/dorothy-christmas-k7m2p9qx4t" />
    <div id="main-content">
      <Story />
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <PublicRegistryGrid
          items={items}
          categories={categories}
          cashFunds={[]}
          parentName="Dorothy"
          myGifts={{}}
          coverCounts={{}}
          suggestButton={
            <SuggestItemDialog
              registryId="registry-1"
              categories={categories.map(({ id, name }) => ({ id, name }))}
              action={async () => undefined}
            />
          }
        />
      </main>
    </div>
  </div>
);

const follow = (state: FollowButtonState, name = "Dorothy Gale") => (
  <FollowButton
    publicId="k7m2p9qx4t"
    name={name}
    state={state}
    returnTo="/r/dorothy-christmas-k7m2p9qx4t"
    requestAction={mockFollow}
    cancelAction={mockFollow}
    align="start"
  />
);

const dorothy: GiftProfile = {
  birthday: { month: 3, day: 23 },
  sizes: { tops: "M", bottoms: "29x29 or Small", shoes: "8" },
  likes: ["Bread", "Hiking", "Houseplants"],
};

const meta: Meta<typeof PublicRegistryHero> = {
  title: "Components/PublicRegistryHero",
  component: PublicRegistryHero,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  decorators: [withListPage],
};
export default meta;
type Story = StoryObj<typeof PublicRegistryHero>;

// A personal wish list, as a follower the owner approved sees it: the list on
// the left; who shared it, Following and what they like on the right. Only
// approved followers see the birthday.
export const WishList: Story = {
  args: {
    isBabyRegistry: false,
    title: "Dorothy's Christmas Wishlist",
    names: null,
    eventDate: "2026-12-25",
    description: "Welcome to my wishlist!",
    fulfilledItems: 1,
    totalItems: 6,
    owner: { name: "Dorothy Gale", path: "/u/dorothy-gale-k7m2p9qx4t" },
    followButton: follow("approved"),
    about: <GiftProfileCard variant="compact" profile={dorothy} name="Dorothy Gale" showBirthday />,
  },
};

// The same list on a phone: everything stacks, the person after the list.
export const WishListOnPhone: Story = {
  args: WishList.args,
  globals: { viewport: { value: "mobile1" } },
};

// A baby registry with initials, a longer welcome and Follow for a signed-out
// guest. From lg up, the illustrations sit under the owner.
export const BabyRegistry: Story = {
  args: {
    isBabyRegistry: true,
    title: "Remi & Max's Baby Registry",
    names: "Remi & Max",
    eventDate: "2027-01-30",
    description:
      "We're so excited to welcome our little one! Thank you for being part of this journey. We've put together a list of things we'd love for the baby — any help is hugely appreciated!",
    fulfilledItems: 10,
    totalItems: 32,
    owner: { name: "Remi & Max", path: "/u/remi-max-k7m2p9qx4t" },
    followButton: follow("signed-out", "Remi & Max"),
  },
};

export const BabyRegistryOnPhone: Story = {
  args: BabyRegistry.args,
  globals: { viewport: { value: "mobile1" } },
};

// A list kept for a child that isn't on anyone's profile: no "Shared by",
// and anyone with the link sees the sizes and likes but not the birthday.
// Every field is filled in, so the right side is at its tallest.
export const UnlistedWithEverything: Story = {
  args: {
    isBabyRegistry: false,
    title: "Toto's Third Birthday",
    names: "Toto",
    eventDate: "2027-05-02",
    description: "Toto turns three! He's into anything with wheels this year.",
    fulfilledItems: 0,
    totalItems: 6,
    owner: null,
    about: (
      <GiftProfileCard
        variant="compact"
        name="Toto"
        profile={{
          birthday: { month: 5, day: 2 },
          sizes: { tops: "3T", bottoms: "3T", shoes: "Toddler 9", other: "Hat S" },
          colors: "Red, anything shiny",
          likes: ["Trucks", "Dinosaurs", "Bath toys", "Picture books"],
          skip: ["Anything loud", "Stickers"],
          notes: "We're short on space, so small things are best.\nHe already has a balance bike.",
        }}
      />
    ),
  },
};

// The owner opening their own list: "Shared by" without a Follow button, and
// no welcome message or date yet.
export const OwnersOwnList: Story = {
  args: {
    isBabyRegistry: false,
    title: "Things I'd Love",
    names: null,
    eventDate: null,
    description: null,
    fulfilledItems: 0,
    totalItems: 6,
    owner: { name: "Dorothy Gale", path: "/u/dorothy-gale-k7m2p9qx4t" },
    about: <GiftProfileCard variant="compact" profile={dorothy} name="Dorothy Gale" showBirthday />,
  },
};

// Nothing but the title and progress: an unlisted list with no gift profile.
export const TitleOnly: Story = {
  args: {
    isBabyRegistry: false,
    title: "Housewarming",
    names: null,
    eventDate: null,
    description: null,
    fulfilledItems: 0,
    totalItems: 6,
  },
};

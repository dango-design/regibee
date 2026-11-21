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

const dorothy: GiftProfile = {
  birthday: { month: 3, day: 23 },
  sizes: { tops: "M", bottoms: "29x29 or Small", shoes: "8" },
  likes: ["Bread", "Hiking", "Houseplants"],
};

/**
 * The share page around the header (src/app/r/[slug]/page.tsx): the site's
 * top bar above it, and the About card and items under it, so a snapshot
 * shows how much of the first screen the header takes.
 */
const withListPage: Decorator = (Story, { parameters }) => (
  <div className="min-h-screen bg-primary">
    <NavBar account={null} returnTo="/r/dorothy-christmas-k7m2p9qx4t" />
    <div id="main-content">
      <Story />
      <main className="container mx-auto px-4 py-8">
        {parameters.about && (
          <GiftProfileCard
            className="mx-auto mb-8 max-w-2xl"
            layout="row"
            profile={dorothy}
            name="Dorothy Gale"
            showBirthday={parameters.about === "with birthday"}
          />
        )}
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

const follow = (state: FollowButtonState) => (
  <FollowButton
    publicId="k7m2p9qx4t"
    name="Dorothy Gale"
    state={state}
    returnTo="/r/dorothy-christmas-k7m2p9qx4t"
    requestAction={mockFollow}
    cancelAction={mockFollow}
    layout="inline"
  />
);

const meta: Meta<typeof PublicRegistryHero> = {
  title: "Components/PublicRegistryHero",
  component: PublicRegistryHero,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  decorators: [withListPage],
};
export default meta;
type Story = StoryObj<typeof PublicRegistryHero>;

// A wish list, as a follower the owner approved sees it. The date and
// "Shared by" share a line with Following at its end, and the About card's
// details sit side by side. Only approved followers see the birthday.
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
  },
  parameters: { about: "with birthday" },
};

// The same list on a phone. The meta line wraps, with Following under it.
export const WishListOnPhone: Story = {
  args: WishList.args,
  parameters: { about: "with birthday" },
  globals: { viewport: { value: "mobile1" } },
};

// A signed-out guest on a wish list with no date: "Shared by" and Follow
// alone on the line, the hint under them, and no birthday in the About card.
export const WishListSignedOut: Story = {
  args: {
    ...WishList.args,
    eventDate: null,
    names: "Dorothy Gale",
    followButton: follow("signed-out"),
  },
  parameters: { about: "without birthday" },
};

// A wish list that isn't on anyone's profile, with no gift profile: just the
// title and progress.
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

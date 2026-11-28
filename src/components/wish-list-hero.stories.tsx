import type { Decorator, Meta, StoryObj } from "@storybook/react";
import type { GiftProfile } from "@/lib/gift-profile";
import { listHeader } from "@/lib/list-headers";
import type { FollowButtonState } from "./follow-button";
import { NavBar } from "./nav-bar";
import { OwnerChip } from "./owner-chip";
import { PublicRegistryGrid } from "./public-registry-grid";
import { SuggestItemDialog } from "./suggest-item-dialog";
import { WishListHero } from "./wish-list-hero";
import { PHONE_MODES } from "@/stories/viewports";

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
 * top bar above it and the items under it, so a snapshot shows how much of
 * the first screen the header takes.
 */
const withListPage: Decorator = (Story) => (
  <div className="min-h-screen bg-primary">
    <NavBar account={null} returnTo="/r/dorothy-wishlist-k7m2p9qx4t" />
    <div id="main-content">
      <Story />
      <main className="container mx-auto px-4 py-8">
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
              action={async () => undefined}
            />
          }
        />
      </main>
    </div>
  </div>
);

const chip = (state: FollowButtonState | null) => (
  <OwnerChip
    name="Dorothy Gale"
    path="/u/dorothy-gale-k7m2p9qx4t"
    publicId="k7m2p9qx4t"
    state={state}
    returnTo="/r/dorothy-wishlist-k7m2p9qx4t"
    requestAction={mockFollow}
    cancelAction={mockFollow}
  />
);

const twoParagraphs =
  "Welcome to my wishlist! I keep this one list for birthdays, the holidays and everything in between, so it's always up to date.\n\nSecondhand is great, and anything handmade is even better. If you want to go off-list, my sizes are right here.";

const dorothy: GiftProfile = {
  birthday: { month: 3, day: 23 },
  sizes: { tops: "M", bottoms: "29x29 or Small", shoes: "8" },
  likes: ["Bread", "Coffee", "Hiking"],
};

const meta: Meta<typeof WishListHero> = {
  title: "Components/WishListHero",
  component: WishListHero,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  decorators: [withListPage],
};
export default meta;
type Story = StoryObj<typeof WishListHero>;

// As a follower the owner approved sees it: "Following" sits in the owner
// chip, with no button, and the About part shows the birthday. A two-
// paragraph note is cut to four lines with "Read more".
export const Following: Story = {
  args: {
    title: "Dorothy's Wishlist",
    description: twoParagraphs,
    fulfilledItems: 1,
    totalItems: 6,
    ownerName: "Dorothy Gale",
    ownerChip: chip("approved"),
    giftProfile: dorothy,
    giftProfileName: "Dorothy Gale",
    showBirthday: true,
  },
};

// Someone signed in who doesn't follow Dorothy: a Follow button beside the
// chip, and no birthday.
export const NotFollowing: Story = {
  args: { ...Following.args, ownerChip: chip("none"), showBirthday: false },
};

// A signed-out guest on a phone. Progress and sizes share a row.
export const OnPhone: Story = {
  args: { ...Following.args, ownerChip: chip("signed-out"), showBirthday: false },
  parameters: { chromatic: { modes: PHONE_MODES } },
  globals: { viewport: { value: "mobile1" } },
};

// After asking to follow, with a one-line note and only sizes in the
// profile: the note shows whole, and the sizes sit under "About Dorothy Gale".
export const RequestedShortNote: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    ...Following.args,
    description: "Welcome to my wishlist!",
    ownerChip: chip("pending"),
    giftProfile: { sizes: { tops: "M", shoes: "8" } },
    showBirthday: false,
  },
};

// A list that isn't on anyone's profile, with no note or gift profile: the
// title, and the progress on its own.
export const TitleOnly: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    title: "Housewarming",
    description: null,
    fulfilledItems: 0,
    totalItems: 6,
  },
};

// A birthday wishlist with the header its owner picked.
export const WithHeader: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { ...Following.args, header: listHeader({ color: "sunshine", pattern: "balloons" }) },
};

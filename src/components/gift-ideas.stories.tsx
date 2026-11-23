import type { Meta, StoryObj } from "@storybook/react";
import type { GiftIdea } from "@/lib/gift-ideas";
import { GiftIdeasSkeleton } from "./page-skeletons";
import { GiftIdeas } from "./gift-ideas";

// Server actions can't run in Storybook, so these pretend to work. "Bought
// it" shows straight away, so ticking it works here.
const mockSave = async () => ({ success: true as const, id: "new-idea" });
const mockDelete = async (id: string) => ({ success: true as const, id });
const mockSetBought = async (id: string) => ({ success: true as const, id });
const mockRead = async () => ({ error: "Storybook can't read links." });

function idea(
  id: string,
  recipient: string,
  title: string,
  price: number | null,
  externalUrl: string | null,
  extra: Partial<GiftIdea> = {},
): GiftIdea {
  return {
    id,
    recipient,
    title,
    externalUrl,
    imageUrl: null,
    price,
    notes: null,
    boughtAt: null,
    createdAt: `2026-11-${id.padStart(2, "0")}T12:00:00Z`,
    ...extra,
  };
}

const ideas: GiftIdea[] = [
  idea("9", "Mom", "Wool scarf in forest green", 48, "https://shop.example.com/wool-scarf", {
    notes: "She stopped to look at the green one at the market. Her coat is navy.",
  }),
  idea("8", "Sam", "Climbing chalk bag", 22.5, "https://outdoors.example.com/chalk-bag"),
  idea("7", "Mom", "Pour-over coffee set", 65, "https://www.example.com/pour-over", {
    notes: "For Mother's Day?",
  }),
  idea("6", "Dad", "Cast iron skillet, 12 inch", 39.99, "https://www.example.com/skillet"),
  idea("5", "Sam", "The new Becky Chambers book", null, null, { notes: "Check if it's out in paperback." }),
  idea("4", "Mom", "Hand cream gift set", 32, "https://www.example.com/hand-cream", {
    boughtAt: "2026-11-10T12:00:00Z",
  }),
];

const meta: Meta<typeof GiftIdeas> = {
  title: "Components/GiftIdeas",
  component: GiftIdeas,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard/saved/ideas" } },
  },
  args: {
    ideas,
    saveAction: mockSave,
    deleteAction: mockDelete,
    setBoughtAction: mockSetBought,
    readLink: mockRead,
  },
};
export default meta;
type Story = StoryObj<typeof GiftIdeas>;

/**
 * Ideas for Mom, Sam and Dad, the person with the newest idea first. Mom's
 * hand cream is bought, so it comes last in her group.
 */
export const Default: Story = {};

/** Only Mom's ideas, picked from the people at the top. */
export const OnePerson: Story = {
  name: "One person",
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("radio", { name: /^Mom/ }));
  },
};

/**
 * Two ideas saved without saying who they're for. They come last, under "Not
 * sure who yet", after the people.
 */
export const NotSureWhoYet: Story = {
  name: "Not sure who yet",
  args: {
    ideas: [
      idea("10", "", "Pottery class for two", 120, "https://www.example.com/pottery", {
        notes: "Could be a good birthday gift for someone.",
      }),
      ...ideas,
      idea("3", "", "Puzzle of a map of the city", 28, null),
    ],
  },
};

/** Just after ticking "Bought it": the card says it's saving until the server has it. */
export const Saving: Story = {
  args: { setBoughtAction: () => new Promise<never>(() => {}) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("checkbox", { name: /Bought it\W+Wool scarf in forest green/ }));
    await canvas.findByText("Saving…");
  },
};

/** Nothing saved yet: what gift ideas are, and the ways to save one. */
export const Empty: Story = {
  args: { ideas: [] },
};

/** On a phone. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
};

/** The placeholder while the view loads. */
export const Loading: Story = {
  render: () => <GiftIdeasSkeleton />,
};

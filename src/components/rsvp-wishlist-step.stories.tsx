import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { RsvpWishlistStep } from "./rsvp-wishlist-step";

// The step after a guest says they're coming to an everyone-gives-everyone
// event, like a family Christmas. The RSVP Form stories show it after a reply.

const meta: Meta<typeof RsvpWishlistStep> = {
  title: "Components/RsvpWishlistStep",
  component: RsvpWishlistStep,
  parameters: { layout: "padded" },
  args: {
    slug: "christmas-at-aunt-lindas-k3m9q2xa",
    token: "token-g4",
    current: null,
    giftIdeas: null,
    account: null,
    saveAction: fn(async () => ({ error: null })),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof RsvpWishlistStep>;

/**
 * Not signed in: make a free account and a list, or log in to use one. Both
 * come back to the guest's own link. A wish list here is a Regibee list, so
 * there's no pasting another store's link.
 */
export const SignedOut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      `/login?redirect=${encodeURIComponent("/e/christmas-at-aunt-lindas-k3m9q2xa?g=token-g4#wishlist")}`,
    );
    await expect(canvas.queryByRole("button", { name: /Paste a link/ })).toBeNull();
    await expect(canvas.queryByLabelText(/Gift ideas/)).toBeNull();
  },
};

/** Signed in with lists of their own: one click links one. */
export const SignedInWithLists: Story = {
  args: {
    account: {
      lists: [
        { id: "list-1", title: "Fiyero's Christmas List" },
        { id: "list-2", title: "Fiyero's Birthday Wishlist" },
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Use Fiyero's Christmas List" }));
    await expect(args.saveAction).toHaveBeenCalledWith(expect.objectContaining({ registryId: "list-1" }));
  },
};

/** Signed in with no list yet, like someone who just made an account: one button makes it. */
export const SignedInNoLists: Story = {
  args: { account: { lists: [] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Make my wish list" }));
    await expect(args.saveAction).toHaveBeenCalledWith(expect.objectContaining({ makeNew: true }));
  },
};

/** Linked to one of their own lists, which they can open to add things. */
export const Linked: Story = {
  args: {
    current: { url: "https://regibee.com/r/fiyeros-list-5j2c", title: "Fiyero's Christmas List", ownListId: "list-1" },
    giftIdeas: "Anything for the garden",
    account: { lists: [{ id: "list-1", title: "Fiyero's Christmas List" }] },
  },
};

/**
 * A list from another store, saved before a wish list here had to be a
 * Regibee list. It still shows. Change opens the choices again, with a way back.
 */
export const LinkedElsewhere: Story = {
  args: {
    current: { url: "https://www.amazon.com/hz/wishlist/ls/3KQ9", title: null, ownListId: null },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("A list on amazon.com")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Change" }));
    await expect(canvas.getByRole("heading", { name: "Change your wish list" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Keep my wish list as it is" })).toBeVisible();
  },
};

/** The host picked a color for the invitation, so it fills the step. Without one, it has no fill. */
export const WithHostColor: Story = {
  args: { ...SignedInWithLists.args, themeColor: "#f9b8b9" },
};

export const SignedOutPhone: Story = {
  ...SignedOut,
  play: undefined,
  globals: { viewport: { value: "mobile1" } },
};

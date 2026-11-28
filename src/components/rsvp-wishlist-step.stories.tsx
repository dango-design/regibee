import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { RsvpWishlistStep } from "./rsvp-wishlist-step";
import { PHONE_MODES } from "@/stories/viewports";

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

/** Opens the wishlist's "…" menu and picks a choice. The menu opens outside the story. */
async function chooseFromMenu(canvasElement: HTMLElement, choice: string) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "Wishlist options" }));
  await userEvent.click(await within(document.body).findByRole("menuitem", { name: choice }));
}

/**
 * Not signed in: make a free account and a list, or log in to use one. Both
 * come back to the guest's own link. A wishlist here is a Regibee list, so
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
  parameters: { chromatic: { disableSnapshot: true } },
  args: { account: { lists: [] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Make my wishlist" }));
    await expect(args.saveAction).toHaveBeenCalledWith(expect.objectContaining({ makeNew: true }));
  },
};

/** Linked to one of their own lists. Its name opens it, to add things. */
export const Linked: Story = {
  args: {
    current: { url: "https://regibee.com/r/fiyeros-list-5j2c", title: "Fiyero's Christmas List", ownListId: "list-1" },
    giftIdeas: "Anything for the garden",
    account: { lists: [{ id: "list-1", title: "Fiyero's Christmas List" }] },
  },
};

/**
 * A parent with their own wishlist linked adds the list they keep for their
 * child. Everyone sees it under theirs.
 */
export const AddAnotherList: Story = {
  args: {
    current: { url: "https://regibee.com/r/fiyeros-list-5j2c", title: "Fiyero's Christmas List", ownListId: "list-1" },
    account: {
      lists: [
        { id: "list-1", title: "Fiyero's Christmas List" },
        { id: "list-3", title: "Nessa's Christmas List" },
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await chooseFromMenu(canvasElement, "Add another list");
    // The wishlist itself isn't offered again.
    await expect(canvas.queryByRole("button", { name: "Add Fiyero's Christmas List" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Add Nessa's Christmas List" }));
    await expect(args.saveAction).toHaveBeenCalledWith(expect.objectContaining({ addRegistryId: "list-3" }));
  },
};

/** With their child's list added too. Either name opens it, and the menu takes the child's off. */
export const WithAnotherList: Story = {
  args: {
    ...AddAnotherList.args,
    more: [{ id: "list-3", title: "Nessa's Christmas List", ownListId: "list-3" }],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Nessa's Christmas List" })).toHaveAttribute(
      "href",
      "/dashboard/registry/list-3",
    );
    await chooseFromMenu(canvasElement, "Take off Nessa's Christmas List");
    await expect(args.saveAction).toHaveBeenCalledWith(expect.objectContaining({ removeRegistryId: "list-3" }));
  },
};

/**
 * A list from another store, saved before a wishlist here had to be a
 * Regibee list. It still shows. Change wishlist opens the choices again, with a way back.
 */
export const LinkedElsewhere: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    current: { url: "https://www.amazon.com/hz/wishlist/ls/3KQ9", title: null, ownListId: null },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "A list on amazon.com" })).toBeVisible();
    await chooseFromMenu(canvasElement, "Change wishlist");
    await expect(canvas.getByRole("heading", { name: "Change your wishlist" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Keep my wishlist as it is" })).toBeVisible();
  },
};

/** The host picked a color for the invitation, so it fills the step. Without one, it has no fill. */
export const WithHostColor: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { ...SignedInWithLists.args, themeColor: "#f9b8b9" },
};

export const SignedOutPhone: Story = {
  ...SignedOut,
  play: undefined,
  parameters: { ...SignedOut.parameters, chromatic: { modes: PHONE_MODES } },
  globals: { viewport: { value: "mobile1" } },
};

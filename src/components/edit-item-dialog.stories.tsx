import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { EditItemDialog } from "./edit-item-dialog";

const CATEGORIES = [
  { id: "cat-1", name: "Nursery & Sleep" },
  { id: "cat-2", name: "Feeding" },
];

// The dialog fades in over 300ms, and nothing in it counts as visible at the
// start of the fade. So the stories wait for an element to be visible instead
// of checking once: a single check right after a click sometimes ran before
// the fade had begun to show, and failed the Chromatic build.
const meta: Meta<typeof EditItemDialog> = {
  title: "Components/EditItemDialog",
  component: EditItemDialog,
  parameters: {
    layout: "centered",
  },
  args: {
    registryId: "demo",
    categories: CATEGORIES,
    open: true,
    onOpenChange: fn(),
    linkedRegistries: [{ store: "amazon", url: "https://www.amazon.com/baby-reg/your-registry" }],
    item: {
      id: "item-1",
      title: "Philips Avent Natural Baby Bottles, 4 pack",
      external_url: "https://www.amazon.com/dp/B0EXAMPLE1?colid=EXAMPLECOLID&coliid=IEXAMPLEITEM",
      image_url: null,
      price: 32.99,
      quantity_needed: 2,
      quantity_fulfilled: 0,
      is_essential: true,
      is_parent_purchased: false,
      is_open_to_used: false,
      minimum_condition: null,
      notes: "The 9 oz size, please. We already have the small ones.",
      category_id: "cat-2",
    },
  },
};
export default meta;
type Story = StoryObj<typeof EditItemDialog>;

// The details came from the link, so it sits on one line with Change link.
// It's a registry link, so the line says so.
export const RegistryLink: Story = {};

// No link yet, so the big box for pasting one leads.
export const NoLink: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    item: { ...meta.args!.item!, external_url: null },
  },
};

// Change link opens the big box with the link selected, so pasting replaces
// it, and Keep the current link puts it back.
export const ChangingTheLink: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "Change link" }));
    await expect(body.getByLabelText("Product link")).toHaveFocus();
    await waitFor(() => expect(body.getByRole("button", { name: "Keep the current link" })).toBeVisible());
  },
};

// A plain Amazon link when the owner has an Amazon registry: the warning stays
// under the one-line link.
export const PlainLinkWarning: Story = {
  args: {
    item: { ...meta.args!.item!, external_url: "https://www.amazon.com/dp/B0EXAMPLE1" },
  },
};

// The extension has checked this item's price before, and the owner turned
// the weekly checks off. The box under the price turns them back on.
export const PriceChecksOff: Story = {
  args: {
    item: { ...meta.args!.item!, priceChecks: "off" },
  },
  play: async () => {
    const body = within(document.body);
    const box = await body.findByRole("checkbox", { name: "Check the store's price weekly" });
    await expect(box).not.toBeChecked();
  },
};

// Open to hand-me-downs shows the minimum condition. The info button explains
// the three options: under the pointer, and in a box once it's clicked.
export const GuestOptions: Story = {
  args: {
    item: { ...meta.args!.item!, is_open_to_used: true, minimum_condition: "very-good" },
  },
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "What these mean" }));
    await waitFor(() => expect(body.getByText(/lets guests give a used one/)).toBeVisible());
  },
};

// With a photo, the ways to change it sit in a menu on the photo's corner.
export const ChangingThePhoto: Story = {
  args: {
    item: { ...meta.args!.item!, image_url: "/hero/bottle.svg" },
  },
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "Change photo" }));
    await waitFor(() => expect(body.getByRole("menuitem", { name: "Upload a photo" })).toBeVisible());
    await waitFor(() => expect(body.getByRole("menuitem", { name: "Look for photos on Amazon" })).toBeVisible());
  },
};

// A store's page often has several photos. The item shows one, so the row
// says to pick one, and the one in use has a check.
export const PickingAPhoto: Story = {
  args: {
    item: { ...meta.args!.item!, image_url: "/hero/bottle.svg" },
    photosToOffer: ["/hero/bottle.svg", "/hero/bib.svg", "/hero/socks.svg"],
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByRole("button", { name: "Photo 1" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(body.getByRole("button", { name: "Photo 2" }));
    await expect(body.getByRole("button", { name: "Photo 2" })).toHaveAttribute("aria-pressed", "true");
  },
};

const OWNER_LISTS = [
  { id: "list-2", title: "Remi's Christmas List" },
  { id: "list-3", title: "Remi's Birthday Wishlist" },
];

// The three dots at the bottom left open the actions owners rarely need:
// adding the item to another of their lists, moving it there, and removing it.
export const MoreActions: Story = {
  args: { ownerLists: OWNER_LISTS },
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "More actions" }));
    await waitFor(() => expect(body.getByRole("menuitem", { name: "Add to another list" })).toBeVisible());
    await expect(body.getByRole("menuitem", { name: "Move to another list" })).toBeVisible();
    await expect(body.getByRole("menuitem", { name: "Remove item" })).toBeVisible();
  },
};

// Add to another list opens the owner's lists the item isn't on yet.
export const PickingAList: Story = {
  args: { ownerLists: OWNER_LISTS, otherLists: ["Remi's Christmas List"], otherListIds: ["list-2"] },
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "More actions" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Add to another list" }));
    await waitFor(() => expect(body.getByRole("menuitem", { name: "Remi's Birthday Wishlist" })).toBeVisible());
    await expect(body.queryByRole("menuitem", { name: "Remi's Christmas List" })).toBeNull();
    // It's on another list, so removing it here keeps it there.
    await expect(body.getByRole("menuitem", { name: "Remove from list" })).toBeVisible();
  },
};

// Remove item asks first, in a second dialog on top of this one. The item is
// on no other list, so removing it deletes it.
export const ConfirmingRemove: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "More actions" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Remove item" }));
    const confirm = await body.findByRole("dialog", {
      name: 'Delete "Philips Avent Natural Baby Bottles, 4 pack"?',
    });
    await waitFor(() => expect(within(confirm).getByRole("button", { name: "Delete item" })).toBeVisible());
    await expect(confirm).toHaveTextContent("This cannot be undone.");
  },
};

// With no other list to put it on, as for a co-manager, only removing is left.
export const OnlyRemove: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "More actions" }));
    await waitFor(() => expect(body.getByRole("menuitem", { name: "Remove item" })).toBeVisible());
    await expect(body.queryByRole("menuitem", { name: "Add to another list" })).toBeNull();
  },
};

// On a phone the dialog is a sheet, and the photo sits above the fields.
export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
};

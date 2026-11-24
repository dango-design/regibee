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

// Open to hand-me-downs shows the minimum condition. The info button explains
// the three options: under the pointer, and in a box once it's clicked.
export const GuestOptions: Story = {
  args: {
    item: { ...meta.args!.item!, is_open_to_used: true, minimum_condition: "very-good" },
  },
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "What these mean" }));
    await waitFor(() => expect(body.getByText(/lets guests give one that's been used/)).toBeVisible());
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

// On a phone the dialog is a sheet, and the photo sits above the fields.
export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
};

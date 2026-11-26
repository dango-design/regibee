import type { Meta, StoryObj } from "@storybook/react";
import { screen } from "storybook/test";
import { AddCashFundDialog } from "./add-cash-fund-dialog";

const mockAction = async () => {
  await new Promise((r) => setTimeout(r, 800));
  return { success: true as const };
};

const meta: Meta<typeof AddCashFundDialog> = {
  title: "Components/AddCashFundDialog",
  component: AddCashFundDialog,
  parameters: { layout: "centered" },
  args: {
    registryId: "registry-1",
    action: mockAction,
  },
  // The dialog starts closed. Open it so the snapshot shows what's inside.
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /add fund/i }));
    await screen.findByRole("dialog");
  },
};
export default meta;
type Story = StoryObj<typeof AddCashFundDialog>;

// The list has payment methods: they show as text, with Edit to change them here.
export const WithPaymentMethods: Story = {
  args: {
    paymentMethods: { venmo: "@remi-and-max", zelle: "max@example.com" },
  },
};

// The list has none yet: the fields show, so the owner can add one without going to settings.
export const NoPaymentMethods: Story = {
  args: {
    paymentMethods: null,
  },
};

// Opened from the checklist's Diaper Fund entry: the name and description start filled in.
export const FromChecklist: Story = {
  args: {
    paymentMethods: null,
    defaults: { title: "Diaper Fund", description: "Cash contribution toward the never-ending diaper supply." },
  },
  parameters: { chromatic: { disableSnapshot: true } },
};

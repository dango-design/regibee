import type { Meta, StoryObj } from "@storybook/react";
import { screen } from "storybook/test";
import { StartGroupGiftDialog } from "./start-group-gift-dialog";
import { PHONE_MODES } from "@/stories/viewports";

// Server actions can't run in Storybook, so this pretends to start one.
const action: NonNullable<React.ComponentProps<typeof StartGroupGiftDialog>["action"]> = async () => {
  await new Promise((r) => setTimeout(r, 400));
  return { success: true, token: "story-group-gift-token-0000" };
};

const meta: Meta<typeof StartGroupGiftDialog> = {
  title: "Components/StartGroupGiftDialog",
  component: StartGroupGiftDialog,
  parameters: { layout: "centered" },
  args: {
    registryId: "registry-1",
    item: { id: "1", title: "UPPAbaby Vista V2 Stroller", price: 979.99 },
    recipientName: "Remi & Max",
    signedIn: true,
    returnTo: "/r/remi-and-max",
    action,
  },
  // The dialog starts closed. Open it so the snapshot shows what's inside.
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /group gift/i }));
    await screen.findByRole("dialog");
  },
};
export default meta;
type Story = StoryObj<typeof StartGroupGiftDialog>;

/** The total to collect starts at the price. */
export const SignedIn: Story = {};

/** From an event's invitation: its guests will see the group gift too. On a phone. */
export const FromAnEventOnAPhone: Story = {
  args: { eventTitle: "Remi & Max's baby shower" },
  parameters: { chromatic: { modes: PHONE_MODES } },
  globals: { viewport: { value: "mobile1" } },
};

/** An item with a photo shows it under the title. */
export const WithPhoto: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { item: { id: "2", title: "Glass Baby Bottles, 4 Pack", price: 34.99, image_url: "/hero/bottle.svg" } },
};

/** Starting one needs an account. People who chip in don't. */
export const SignedOut: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { signedIn: false },
};

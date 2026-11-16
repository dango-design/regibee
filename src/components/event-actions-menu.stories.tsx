import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, waitFor, within } from "storybook/test";
import { EventActionsMenu } from "./event-actions-menu";

const meta: Meta<typeof EventActionsMenu> = {
  title: "Components/EventActionsMenu",
  component: EventActionsMenu,
  parameters: { layout: "centered" },
  args: {
    eventId: "e1",
    isOwner: true,
    guestCount: 12,
    planAction: async () => ({ error: null, id: "e2" }),
    deleteAction: async () => ({ error: null }),
  },
};
export default meta;
type Story = StoryObj<typeof EventActionsMenu>;

// Opens the menu, picks an item, and waits for its dialog.
const choose =
  (item: string): Story["play"] =>
  async ({ canvasElement, userEvent }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "More actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: item }));
    // The menu's popover also has the dialog role while it fades out. Wait
    // until it's gone, so there's one dialog to find and the snapshot shows
    // only that.
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument(), { timeout: 3000 });
    const dialog = within(await screen.findByRole("dialog"));
    // In the document, not "visible": the dialog fades in, and Chromatic
    // snapshots the end of the fade.
    await expect(dialog.getByRole("heading")).toBeInTheDocument();
  };

/** "Plan it again" says what the copy keeps before making it. */
export const PlanAgain: Story = { play: choose("Plan it again") };

/** "Delete event" asks first, and says how many guests go with it. */
export const Delete: Story = { play: choose("Delete event") };

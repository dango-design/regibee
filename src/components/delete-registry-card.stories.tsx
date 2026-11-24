import type { Meta, StoryObj } from "@storybook/react";
import { screen, within } from "storybook/test";
import { DeleteRegistryCard } from "./delete-registry-card";
import type { RegistryDeletionSummary } from "@/lib/delete-confirmation";

// A registry people have used: items, a gift fund, guests' gifts, and two
// items that are also on another list.
const used: RegistryDeletionSummary = { deletedItems: 12, movedItems: 2, placedItems: 0, funds: 1, gifts: 3 };

const meta: Meta<typeof DeleteRegistryCard> = {
  title: "Components/DeleteRegistryCard",
  component: DeleteRegistryCard,
  args: {
    registryId: "r1",
    loadSummary: async () => ({ summary: used }),
    deleteAction: async () => {
      await new Promise((r) => setTimeout(r, 400));
    },
  },
};
export default meta;
type Story = StoryObj<typeof DeleteRegistryCard>;

// The card starts with only its button. Open the dialog so the snapshot shows
// what it says.
const open: Story["play"] = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: /delete registry/i }));
  await screen.findByRole("dialog");
  await screen.findByRole("list");
};

// What gets deleted, then the sentence to type. The button stays off until
// it's typed.
export const Confirm: Story = { play: open };

// A registry with nothing on it yet asks with the buttons alone.
export const NewRegistry: Story = {
  args: { loadSummary: async () => ({ summary: { deletedItems: 0, movedItems: 0, placedItems: 0, funds: 0, gifts: 0 } }) },
  play: open,
};

// The sentence is typed, so the button is on.
export const ReadyToDelete: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async (context) => {
    await open(context);
    await context.userEvent.type(
      screen.getByRole("textbox", { name: /to confirm/i }),
      "I want to delete this registry",
    );
  },
};

// The server said no. The dialog stays open with the reason.
export const Failed: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { deleteAction: async () => ({ error: "The registry wasn't deleted. Try again." }) },
  play: async (context) => {
    await open(context);
    await context.userEvent.type(
      screen.getByRole("textbox", { name: /to confirm/i }),
      "I want to delete this registry",
    );
    const dialog = within(screen.getByRole("dialog"));
    await context.userEvent.click(dialog.getByRole("button", { name: /delete registry/i }));
    await dialog.findByText(/wasn't deleted/i);
  },
};

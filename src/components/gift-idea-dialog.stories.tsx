import type { Meta, StoryObj } from "@storybook/react";
import { screen } from "storybook/test";
import { Button } from "@/components/ui/button";
import { GiftIdeaDialog } from "./gift-idea-dialog";

// Server actions can't run in Storybook, so these pretend to work.
const mockSave = async () => ({ success: true as const, id: "new-idea" });
const mockDelete = async (id: string) => ({ success: true as const, id });
const mockRead = async () => ({ error: "Storybook can't read links." });

const meta: Meta<typeof GiftIdeaDialog> = {
  title: "Components/GiftIdeaDialog",
  component: GiftIdeaDialog,
  parameters: { layout: "centered" },
  args: {
    trigger: <Button>Save a gift idea</Button>,
    recipients: ["Mom", "Sam", "Dad", "Aunt Jo"],
    saveAction: mockSave,
    deleteAction: mockDelete,
    readLink: mockRead,
  },
};
export default meta;
type Story = StoryObj<typeof GiftIdeaDialog>;

// The dialog starts closed. Open it so the snapshot shows the form.
const open: Story["play"] = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button"));
  await screen.findByRole("dialog");
};

/**
 * A new idea. The people ideas were saved for before are one tap away, so
 * after a link fills in the rest, picking the person is all that's left.
 */
export const New: Story = {
  play: open,
};

/** Changing an idea, with Delete. */
export const Edit: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    trigger: <Button variant="outline">Edit</Button>,
    idea: {
      id: "scarf",
      recipient: "Mom",
      title: "Wool scarf in forest green",
      externalUrl: "https://shop.example.com/wool-scarf",
      imageUrl: null,
      price: 48,
      notes: "She stopped to look at the green one at the market. Her coat is navy.",
      boughtAt: null,
      createdAt: "2026-11-09T12:00:00Z",
    },
  },
  play: open,
};

/** On a phone the dialog is a sheet, with Cancel and Save idea in a bar at the bottom. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
  play: open,
};

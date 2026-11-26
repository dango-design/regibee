import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/components/ui/sonner";
import { SortIntoCategoriesButton } from "./sort-into-categories-button";

const undo = { moved: [], added: [] };

const meta: Meta<typeof SortIntoCategoriesButton> = {
  title: "Components/SortIntoCategoriesButton",
  component: SortIntoCategoriesButton,
  parameters: { layout: "padded" },
  args: {
    registryId: "demo",
    count: 6,
    sortAction: async () => ({ sorted: 5, added: 2, undo }),
    undoAction: async () => ({}),
  },
  render: (args) => (
    <div className="max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">Other</h3>
        <SortIntoCategoriesButton {...args} />
      </div>
      <Toaster />
    </div>
  ),
};
export default meta;
type Story = StoryObj<typeof SortIntoCategoriesButton>;

// Next to the heading of the items with no category, on a list's page.
export const Default: Story = {};

// After a click: what it did, with Undo.
export const AfterSorting: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Sort into categories" }));
    const page = within(document.body);
    await waitFor(() => expect(page.getByText("Sorted 5 items into categories")).toBeInTheDocument());
    await expect(page.getByText("Added 2 new categories. 1 item didn't fit one.")).toBeInTheDocument();
    await expect(page.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  },
};

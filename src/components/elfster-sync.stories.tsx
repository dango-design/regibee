import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { ElfsterSync } from "./elfster-sync";

const meta: Meta<typeof ElfsterSync> = {
  title: "Components/ElfsterSync",
  component: ElfsterSync,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ElfsterSync>;

// The read never finishes, so the snapshot stays on it. With no extension,
// no access to Elfster, or nothing due, it shows nothing.
export const Syncing: Story = {
  args: {
    registryId: "demo",
    wishlistIds: ["aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"],
    startAfterMs: 0,
    canSync: async () => true,
    sync: () => new Promise(() => {}),
  },
  render: (args) => (
    <div className="max-w-2xl">
      <ElfsterSync {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Syncing with Elfster…")).toBeVisible();
  },
};

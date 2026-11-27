import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { PriceCheck } from "./price-check";

const meta: Meta<typeof PriceCheck> = {
  title: "Components/PriceCheck",
  component: PriceCheck,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof PriceCheck>;

const items = [
  { id: "a1", title: "Hatch Rest Sound Machine", external_url: "https://www.amazon.com/dp/B0EXAMPLE1" },
  { id: "a2", title: "Halo Sleepsack Swaddle", external_url: "https://www.amazon.com/dp/B0EXAMPLE2" },
  { id: "a3", title: "Dr Browns Bottle Brush", external_url: "https://www.amazon.com/dp/B0EXAMPLE3" },
];

// On the second item. The read never finishes, so the snapshot stays on this
// step. With no extension, or nothing to check, it shows nothing.
export const Checking: Story = {
  args: {
    registryId: "demo",
    items,
    startAfterMs: 0,
    detectExtension: async () => true,
    readProduct: (() => {
      let reads = 0;
      return (url: string) =>
        reads++ === 0
          ? Promise.resolve({ title: "Hatch Rest Baby Sound Machine", price: 59.99, images: [url], gtin: null })
          : new Promise(() => {});
    })(),
    saveAction: async () => ({ changes: [] }),
  },
  render: (args) => (
    <div className="max-w-2xl">
      <PriceCheck {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Checking prices at the store, 2 of 3…")).toBeVisible();
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { MissingDetailsNotice } from "./missing-details-notice";

const meta: Meta<typeof MissingDetailsNotice> = {
  title: "Components/MissingDetailsNotice",
  component: MissingDetailsNotice,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof MissingDetailsNotice>;

const items = [
  { id: "a1", title: "Hatch Rest Sound Machine", external_url: "https://www.amazon.com/dp/B0EXAMPLE1" },
  { id: "a2", title: "Halo Sleepsack Swaddle", external_url: "https://www.amazon.com/dp/B0EXAMPLE2" },
  { id: "a3", title: "Dr Browns Bottle Brush", external_url: "https://www.amazon.com/dp/B0EXAMPLE3" },
];

const saveAction = async () => ({ changes: [] });

// Both wordings in one story, to keep Chromatic snapshots down: on a computer
// with the extension, and without it (such as on an iPad).
export const WithAndWithoutExtension: Story = {
  render: () => (
    <div className="max-w-2xl space-y-6">
      <MissingDetailsNotice
        registryId="demo"
        items={items}
        detectExtension={async () => true}
        readProduct={async () => null}
        saveAction={saveAction}
      />
      <MissingDetailsNotice
        registryId="demo"
        items={items}
        detectExtension={async () => false}
        readProduct={async () => null}
        saveAction={saveAction}
      />
    </div>
  ),
};

// After clicking the button, on the second item. The read never finishes, so
// the snapshot stays on this step.
export const Reading: Story = {
  args: {
    registryId: "demo",
    items,
    detectExtension: async () => true,
    readProduct: (() => {
      let reads = 0;
      return (url: string) =>
        reads++ === 0
          ? Promise.resolve({ title: "Hatch Rest Baby Sound Machine", price: 59.99, images: [url], gtin: null })
          : new Promise(() => {});
    })(),
    saveAction,
  },
  render: (args) => (
    <div className="max-w-2xl">
      <MissingDetailsNotice {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Fill them in" }));
    await expect(await canvas.findByText("Reading 2 of 3 from the store…")).toBeVisible();
    // Let the progress bar finish moving before the snapshot.
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

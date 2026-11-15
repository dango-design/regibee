import type { Meta, StoryObj } from "@storybook/react";
import { SharePicker } from "./share-picker";

// /share on an Android phone, after an owner with two registries shared a
// product from Amazon's app to Regibee. It goes on a registry, or it's a gift
// idea for someone else.
const meta: Meta<typeof SharePicker> = {
  title: "Pages/Share",
  component: SharePicker,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SharePicker>;

export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
  args: {
    shared: {
      url: "https://a.co/d/0bXyZ12",
      title: "Graco 4Ever DLX 4 in 1 Car Seat, Fairmont",
    },
    registries: [
      {
        id: "baby",
        title: "Remi & Max's Baby Registry",
        registryType: "baby",
        eventType: null,
        photoUrl: null,
        names: "Remi & Max",
      },
      {
        id: "birthday",
        title: "Max's 30th",
        registryType: "personal",
        eventType: "birthday",
        photoUrl: null,
        names: null,
      },
    ],
  },
};

/**
 * Someone with no registry. They can still save it as a gift idea for
 * someone else.
 */
export const NoRegistries: Story = {
  name: "No registries",
  globals: { viewport: { value: "mobile1" } },
  args: {
    shared: { url: "https://www.example.com/products/wool-scarf", title: "Wool scarf in forest green" },
    registries: [],
  },
};

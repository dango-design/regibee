import type { Meta, StoryObj } from "@storybook/react";
import { GiftEmailsSetting } from "./gift-emails-setting";

const meta: Meta<typeof GiftEmailsSetting> = {
  title: "Components/GiftEmailsSetting",
  component: GiftEmailsSetting,
  decorators: [(Story) => <div className="mx-auto max-w-xl p-4"><Story /></div>],
  args: {
    action: async () => {
      await new Promise((r) => setTimeout(r, 300));
      return { success: true };
    },
  },
};
export default meta;
type Story = StoryObj<typeof GiftEmailsSetting>;

// Everyone starts with one email per gift.
export const EachGift: Story = { args: { initial: "instant" } };

// Saving failed, so the choice goes back and says why.
export const SaveFails: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    initial: "daily",
    action: async () => ({ error: "We couldn't save that. Try again in a moment." }),
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { ProfileListingField } from "./profile-listing-field";

const meta: Meta<typeof ProfileListingField> = {
  title: "Components/ProfileListingField",
  component: ProfileListingField,
  parameters: { layout: "centered" },
  args: {
    visibility: "public",
    isSelected: true,
    onChange: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof ProfileListingField>;

// Checked, with the longest hint: who can see it plus the shipping address warning.
export const ListedWithShippingAddress: Story = {
  args: { hasShippingAddress: true },
};

// A link-only list only shows to approved followers.
export const LinkOnly: Story = {
  args: { visibility: "link" },
};

// A private list can't be on a profile, so there's nothing to choose.
export const Private: Story = {
  args: { visibility: "private" },
};

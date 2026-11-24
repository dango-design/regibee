import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import type { ProfileAudience } from "@/lib/list-access";
import { ProfileListingField } from "./profile-listing-field";

const meta: Meta<typeof ProfileListingField> = {
  title: "Components/ProfileListingField",
  component: ProfileListingField,
  parameters: { layout: "centered" },
  args: {
    visibility: "public",
    audience: "everyone",
    onChange: () => {},
  },
  render: function Render(args) {
    const [audience, setAudience] = useState<ProfileAudience>(args.audience);
    return (
      <div className="w-80">
        <ProfileListingField {...args} audience={audience} onChange={setAudience} />
      </div>
    );
  },
};
export default meta;
type Story = StoryObj<typeof ProfileListingField>;

// A public list shown to everyone, with the longest hint: who can see it plus
// the shipping address warning.
export const EveryoneWithShippingAddress: Story = {
  args: { hasShippingAddress: true },
};

// Friends only. The hint says the link still opens the list for anyone.
export const Friends: Story = {
  args: { audience: "friends" },
};

// The open list of a public list's choices, "Everyone" included.
export const Choices: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Who sees it on your profile/ }));
    const list = within(document.body);
    await expect(await list.findByRole("option", { name: "Friends" })).toBeVisible();
    await expect(list.getByRole("option", { name: "Everyone" })).toBeVisible();
  },
};

// A link-only list can't show to everyone, so a saved "Everyone" shows as
// followers and the choice isn't offered.
export const LinkOnly: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { visibility: "link" },
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByRole("button", { name: /Who sees it on your profile/ });
    await expect(field).toHaveTextContent("Followers");
    await userEvent.click(field);
    const list = within(document.body);
    await expect(await list.findByRole("option", { name: "Friends" })).toBeVisible();
    await expect(list.queryByRole("option", { name: "Everyone" })).toBeNull();
  },
};

// Not on the profile.
export const Hidden: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { audience: "hidden" },
};

// A private list can't be on a profile, so there's nothing to choose.
export const Private: Story = {
  args: { visibility: "private" },
};

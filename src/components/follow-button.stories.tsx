import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { FollowButton, type FollowButtonState } from "./follow-button";

const mockAction = async () => {
  await new Promise((r) => setTimeout(r, 500));
  return { success: true };
};

const meta: Meta<typeof FollowButton> = {
  title: "Components/FollowButton",
  component: FollowButton,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof FollowButton>;

const states: FollowButtonState[] = [
  "none",
  "pending",
  "approved",
  "signed-out",
  "blocked",
];

// Every state on one page, so one snapshot catches a change to any of them.
export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-x-8 gap-y-10">
      {states.map((state) => (
        <div key={state} className="flex flex-col items-center gap-2">
          <span className="text-xs font-mono text-tertiary">{state}</span>
          <FollowButton
            publicId="k7m2p9qx4t"
            name="Remi & Max"
            state={state}
            returnTo="/u/remi-max-k7m2p9qx4t"
            requestAction={mockAction}
            cancelAction={mockAction}
          />
        </div>
      ))}
    </div>
  ),
};

// Unfollowing asks first. When it fails, the dialog stays open and shows why.
// It looks like the edit item dialog's confirm, which has the snapshot.
export const UnfollowFails: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => (
    <FollowButton
      publicId="k7m2p9qx4t"
      name="Remi & Max"
      state="approved"
      returnTo="/u/remi-max-k7m2p9qx4t"
      requestAction={mockAction}
      cancelAction={async () => ({ error: "Something went wrong. Try again." })}
    />
  ),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Following" }));
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", { name: "Unfollow Remi & Max?" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Unfollow" })).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Unfollow" }));
    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("Something went wrong. Try again.");
  },
};

// Someone who follows the viewer: "Follow back" instead of "Follow", and
// "You follow each other" once both follows are approved.
export const FollowsYou: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-x-8 gap-y-10">
      {(["none", "approved"] as const).map((state) => (
        <div key={state} className="flex flex-col items-center gap-2">
          <span className="text-xs font-mono text-tertiary">{state}</span>
          <FollowButton
            publicId="k7m2p9qx4t"
            name="Remi & Max"
            state={state}
            followsYou
            returnTo="/u/remi-max-k7m2p9qx4t"
            requestAction={mockAction}
            cancelAction={mockAction}
          />
        </div>
      ))}
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import type { FollowButtonState } from "./follow-button";
import { OwnerChip } from "./owner-chip";

const mockAction = async () => {
  await new Promise((r) => setTimeout(r, 500));
  return { success: true };
};

const meta: Meta<typeof OwnerChip> = {
  title: "Components/OwnerChip",
  component: OwnerChip,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof OwnerChip>;

const states: { label: string; state: FollowButtonState | null }[] = [
  { label: "not following", state: "none" },
  { label: "signed out", state: "signed-out" },
  { label: "requested", state: "pending" },
  { label: "following", state: "approved" },
  { label: "blocked", state: "blocked" },
  { label: "the owner", state: null },
];

// Every state on one page, so one snapshot catches a change to any of them.
// A button only shows while there's something to do.
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-brand-50 p-8">
      {states.map(({ label, state }) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <span className="font-mono text-xs text-tertiary">{label}</span>
          <OwnerChip
            name="Remi & Max"
            path="/u/remi-max-k7m2p9qx4t"
            publicId="k7m2p9qx4t"
            state={state}
            returnTo="/r/remi-max-wishlist-k7m2p9qx4t"
            requestAction={mockAction}
            cancelAction={mockAction}
          />
        </div>
      ))}
    </div>
  ),
};

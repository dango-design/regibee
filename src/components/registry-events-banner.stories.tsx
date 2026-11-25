import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { PlanEventButton, RegistryEventsBanner } from "./registry-events-banner";

const meta: Meta<typeof RegistryEventsBanner> = {
  title: "Components/RegistryEventsBanner",
  component: RegistryEventsBanner,
  decorators: [(Story) => <div className="mx-auto max-w-4xl p-4"><Story /></div>],
  args: { registryId: "reg-1", dismissAction: fn(async () => ({ error: null })) },
};
export default meta;
type Story = StoryObj<typeof RegistryEventsBanner>;

// Every state on one page, so one snapshot catches a change to any of them.
// With no events, it's a small prompt that can be dismissed. Dismissed, it
// shows nothing.
export const AllStates: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <RegistryEventsBanner {...args} events={[]} />
      <RegistryEventsBanner {...args} events={[]} promptDismissed />
      <RegistryEventsBanner
        {...args}
        events={[{ id: "e1", title: "Monday Night", event_date: "2026-11-16", event_type: "other" }]}
      />
      <RegistryEventsBanner
        {...args}
        events={[
          { id: "e2", title: "Dana's Baby Shower", event_date: "2026-12-05", event_type: "baby_shower" },
          { id: "e3", title: "Sip and See", event_date: null, event_type: "other" },
        ]}
      />
      {/* One event the owner hosts, one a coworker hosts that links this
          registry, and one where the owner added it as their wishlist as a
          guest. The owner can't manage the last two, so their links open the
          guest page. Only the coworker's has an Unlink button: the wishlist
          comes off on the guest's RSVP. */}
      <RegistryEventsBanner
        {...args}
        events={[
          { id: "e4", title: "Dana's Baby Shower", event_date: "2026-12-05", event_type: "baby_shower" },
          {
            id: "e5",
            slug: "office-baby-shower-x7c2",
            title: "Office Baby Shower",
            event_date: "2026-11-20",
            event_type: "baby_shower",
            canManage: false,
          },
          {
            id: "e6",
            slug: "family-gift-swap-k3m9",
            title: "Family Gift Swap",
            event_date: "2026-12-24",
            event_type: "holiday_party",
            canManage: false,
            guestList: true,
          },
        ]}
      />
    </div>
  ),
};

/** The registry page's header, shrunk to the part the prompt changes. */
function PageWithPrompt(args: Parameters<typeof RegistryEventsBanner>[0]) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Remi&apos;s Baby Registry</h1>
        {dismissed && <PlanEventButton registryId={args.registryId} />}
      </div>
      <RegistryEventsBanner
        {...args}
        promptDismissed={dismissed}
        dismissAction={async (registryId) => {
          const result = await args.dismissAction!(registryId);
          setDismissed(true);
          return result;
        }}
      />
    </div>
  );
}

// Dismissing the prompt hides it, and the header gets a smaller "Plan an
// event" button so planning one is still a click away.
export const Dismissed: Story = {
  args: { events: [] },
  render: (args) => <PageWithPrompt {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Planning a party?")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(args.dismissAction).toHaveBeenCalledWith("reg-1");
    await waitFor(() => expect(canvas.queryByText("Planning a party?")).toBeNull());
    await expect(canvas.getByRole("link", { name: "Plan an event" })).toHaveAttribute(
      "href",
      "/dashboard/events/new?registry=reg-1",
    );
  },
};

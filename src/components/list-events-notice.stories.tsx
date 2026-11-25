import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { ListEventsNotice } from "./list-events-notice";

const meta: Meta<typeof ListEventsNotice> = {
  title: "Components/ListEventsNotice",
  component: ListEventsNotice,
  decorators: [(Story) => <div className="mx-auto max-w-4xl p-4"><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof ListEventsNotice>;

/**
 * Someone else's list, on four events the visitor and the list's owner are
 * both invited to. Each says how the visitor is on it, and opens their own
 * invitation, or the event's page for the one they host.
 */
export const FourEvents: Story = {
  args: {
    events: [
      {
        id: "e1",
        title: "Dana's Baby Shower",
        eventType: "baby_shower",
        eventDate: "2026-12-05",
        time: "2:00 PM PT",
        href: "/e/danas-baby-shower-x7c2?g=guest-token",
        part: "yes",
      },
      {
        id: "e2",
        title: "Family Gift Swap",
        eventType: "gift_exchange",
        eventDate: "2026-12-24",
        time: null,
        href: "/dashboard/events/e2",
        part: "host",
      },
      {
        id: "e3",
        title: "Sip and See",
        eventType: "sip_and_see",
        eventDate: null,
        time: null,
        href: "/e/sip-and-see-k3m9?g=guest-token",
        part: "pending",
      },
      {
        id: "e4",
        title: "Neighborhood Potluck",
        eventType: "potluck",
        eventDate: "2027-01-09",
        time: null,
        href: "/e/potluck-p8q2?g=guest-token",
        part: "maybe",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Events with this list")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Family Gift Swap" })).toHaveAttribute("href", "/dashboard/events/e2");
    await expect(canvas.getByText(/You haven't replied/)).toBeInTheDocument();
  },
};

/** One event says "Event", not "Events". */
export const OneEvent: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    events: [
      {
        id: "e1",
        title: "Dana's Baby Shower",
        eventType: "baby_shower",
        eventDate: "2026-12-05",
        time: null,
        href: "/e/danas-baby-shower-x7c2?g=guest-token",
        part: "yes",
      },
    ],
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { GuestWishLists } from "./guest-wish-lists";
import { sampleExchangeEvent, sampleGuestWishLists } from "@/lib/event-sample-data";

// Everyone's wish lists on an everyone-gives-everyone invitation
// (src/components/event-invitation.tsx): the lists the host linked, then each
// guest's. Only the event's guests and hosts see the guests' lists.

const meta: Meta<typeof GuestWishLists> = {
  title: "Components/GuestWishLists",
  component: GuestWishLists,
  parameters: { layout: "padded" },
  args: {
    lists: sampleGuestWishLists,
    eventSlug: sampleExchangeEvent.slug,
    guestToken: "token-g1",
    waitingCount: 2,
    budget: "$25",
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof GuestWishLists>;

/**
 * Glinda, on her own invitation link. Her list is first, with no button:
 * nobody sees what's been reserved from their own list. Elphaba's and
 * Fiyero's open through the event, Boq hasn't added one yet, and two guests
 * haven't answered.
 */
export const AsAGuest: Story = {};

/**
 * The host linked their own list to the event, which shows first. A list
 * that's also a guest's wish list shows once, on the guest's row.
 */
export const WithTheHostsList: Story = {
  args: {
    giftNote: "Wrapped gifts go under the tree when you arrive.",
    registries: [
      {
        title: "Aunt Linda's Christmas List",
        slug: "aunt-lindas-list-5r2t",
        itemsLeft: 4,
        items: [{ id: "i1", title: "Panda Lovey", image_url: "/hero/panda.svg", price: 24 }],
      },
      { title: "Glinda's Christmas List", slug: "glindas-wishlist-8h3m", itemsLeft: 2, items: [] },
    ],
  },
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole("listitem");
    await expect(rows).toHaveLength(5);
    await expect(rows[0]).toHaveTextContent(/^Aunt Linda's Christmas List4 gifts still needed/);
    await expect(within(canvasElement).getAllByText("Glinda's Christmas List")).toHaveLength(1);
  },
};

/** Someone who isn't a guest or a host: only the host's list shows. */
export const NotAGuest: Story = {
  args: {
    ...WithTheHostsList.args,
    lists: null,
    guestToken: null,
  },
};

/** A guest who hasn't linked their own list yet. */
export const NoListOfYourOwn: Story = {
  args: {
    lists: sampleGuestWishLists.map((entry) =>
      entry.isYou ? { ...entry, url: null, registry: null } : entry,
    ),
  },
};

/** The host, looking at the invitation without being on the guest list. */
export const HostView: Story = {
  args: {
    lists: sampleGuestWishLists.map((entry) => ({ ...entry, isYou: false })),
    guestToken: null,
    hostView: true,
  },
};

/** Before anyone has RSVPed. */
export const NobodyYet: Story = {
  args: { lists: [], waitingCount: 6 },
};

/** On a phone, the buttons go under each name. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
};

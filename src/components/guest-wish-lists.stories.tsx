import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { GuestWishLists } from "./guest-wish-lists";
import { sampleExchangeEvent, sampleGuestWishLists } from "@/lib/event-sample-data";

// Everyone's wishlists on an everyone-gives-everyone invitation
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
 * Glinda, signed in on her own invitation link. Her list is first, and its
 * button opens her own page for it, where what's been reserved stays hidden
 * from her until the day after. Elphaba's and Fiyero's open through the event, Boq hasn't added
 * one yet, and two guests haven't answered.
 */
export const AsAGuest: Story = {
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole("listitem");
    await expect(rows[0]).toHaveTextContent(/Glinda\s*\(you\)/);
    await expect(within(rows[0]).getByRole("link", { name: "See your list" })).toHaveAttribute(
      "href",
      "/dashboard/registry/glindas-list",
    );
    await expect(within(rows[1]).getByRole("link", { name: "See Elphaba's list" })).toHaveAttribute(
      "href",
      `/e/${sampleExchangeEvent.slug}/gifts?g=token-g1&to=elphabas-list-2k9d`,
    );
  },
};

/**
 * Elphaba also added the list she keeps for her daughter. It has its own row
 * under hers, led by the name on the list, and opens through the event like
 * any guest's.
 */
export const AGuestWithTwoLists: Story = {
  args: {
    lists: sampleGuestWishLists.map((entry) =>
      entry.guestId === "g2"
        ? { ...entry, more: [{ title: "Nessa's Christmas List", slug: "nessas-list-8w3p", honoree: "Nessa" }] }
        : entry,
    ),
  },
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole("listitem");
    await expect(rows[2]).toHaveTextContent("Nessa's Christmas List · Added by Elphaba");
    await expect(within(rows[2]).getByRole("link", { name: "See Nessa's list" })).toHaveAttribute(
      "href",
      `/e/${sampleExchangeEvent.slug}/gifts?g=token-g1&to=nessas-list-8w3p`,
    );
  },
};

/**
 * Glinda's wishlist is a list her account doesn't own, or she's signed out.
 * It has no button: that list's page would show her what's been reserved.
 */
export const AListYouDontOwn: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    lists: sampleGuestWishLists.map((entry) => (entry.isYou ? { ...entry, ownListId: null } : entry)),
  },
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole("listitem");
    await expect(rows[0]).toHaveTextContent(/Glinda\s*\(you\)\s*Glinda's Christmas List/);
    await expect(within(rows[0]).queryByRole("link")).toBeNull();
  },
};

/**
 * The host linked their own list to the event. It shows first, and like a
 * guest's: whose it is, then its name. A list that's also a guest's
 * wishlist shows once, on the guest's row.
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
        ownerName: "Linda Park",
      },
      { title: "Glinda's Christmas List", slug: "glindas-wishlist-8h3m", itemsLeft: 2, items: [], ownerName: "Glinda" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole("listitem");
    await expect(rows).toHaveLength(5);
    await expect(rows[0]).toHaveTextContent(/Linda Park\s*Aunt Linda's Christmas List/);
    await expect(within(rows[0]).getByRole("link", { name: "See Linda's list" })).toBeVisible();
    await expect(canvas.getAllByText("Glinda's Christmas List")).toHaveLength(1);
  },
};

/**
 * The host, looking at their own list on the invitation. It says it's
 * theirs. Nobody shops their own list, so its button opens the host's own
 * page for it instead.
 */
export const YourOwnLinkedList: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    lists: sampleGuestWishLists.map((entry) => ({ ...entry, isYou: false, ownListId: null })),
    guestToken: null,
    registries: [
      {
        id: "lindas-list",
        title: "Aunt Linda's Christmas List",
        slug: "aunt-lindas-list-5r2t",
        itemsLeft: 4,
        items: [],
        ownerName: "Linda Park",
        isYours: true,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole("listitem");
    await expect(rows[0]).toHaveTextContent(/Linda Park\s*\(you\)/);
    await expect(within(rows[0]).getAllByRole("link")).toHaveLength(1);
    await expect(within(rows[0]).getByRole("link", { name: "See your list" })).toHaveAttribute(
      "href",
      "/dashboard/registry/lindas-list",
    );
    await expect(within(rows[0]).queryByRole("link", { name: "See Linda's list" })).toBeNull();
  },
};

/**
 * Someone who isn't a guest or a host: only the host's lists show. Glinda's
 * isn't on her profile here, so it leads with its own name.
 */
export const NotAGuest: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    ...WithTheHostsList.args,
    registries: WithTheHostsList.args!.registries!.map((list) =>
      list.slug === "glindas-wishlist-8h3m" ? { ...list, ownerName: null } : list,
    ),
    lists: null,
    guestToken: null,
  },
};

/** A guest who hasn't linked their own list yet. */
export const NoListOfYourOwn: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    lists: sampleGuestWishLists.map((entry) =>
      entry.isYou ? { ...entry, url: null, registry: null, ownListId: null } : entry,
    ),
  },
};

/** The host, looking at the invitation without being on the guest list. */
export const HostView: Story = {
  args: {
    lists: sampleGuestWishLists.map((entry) => ({ ...entry, isYou: false, ownListId: null })),
    guestToken: null,
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

/** The host picked a color for the invitation, so it fills the section. */
export const WithHostColor: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { themeColor: "#a0e4d4" },
};

/**
 * Signed in, a guest gets a Follow button beside each other guest who has a
 * Regibee account they may be shown. Boq has none, so his row has no button.
 */
export const FollowingOtherGuests: Story = {
  args: {
    followActions: { requestAction: fn(async () => ({ success: true })), cancelAction: fn(async () => ({ success: true })) },
    lists: sampleGuestWishLists.map((entry) =>
      entry.guestId === "g2"
        ? { ...entry, follow: { publicId: "abcdefghjk", state: "none" as const, followsYou: false } }
        : entry.guestId === "g4"
          ? { ...entry, follow: { publicId: "bcdefghjkm", state: "approved" as const, followsYou: true } }
          : entry,
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Follow Elphaba Thropp" }));
    await expect(args.followActions?.requestAction).toHaveBeenCalledWith("abcdefghjk");
    await expect(canvas.getByRole("button", { name: "Requested Elphaba Thropp" })).toBeVisible();
  },
};

/** On a phone, Follow sits beside the list's button, under the name. */
export const FollowingOtherGuestsOnAPhone: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: FollowingOtherGuests.args,
  globals: { viewport: { value: "mobile1" } },
};

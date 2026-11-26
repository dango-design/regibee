import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, screen, userEvent, within } from "storybook/test";
import { EventGuestManager } from "./event-guest-manager";
import { guestForHost } from "@/lib/events";
import {
  sampleEvent,
  sampleExchangeEvent,
  sampleExchangeGuests,
  sampleGuests,
  samplePotluckSheet,
} from "@/lib/event-sample-data";
import { claimsByGuest, describeClaim } from "@/lib/signups";
import { defaultQuestions } from "@/lib/rsvp-questions";

const ok = fn(async () => ({ error: null }));

// Sets a text field's value. userEvent.type doesn't reach React in these
// fields (see create-registry-form.stories.tsx). Real typing works.
const fill = (field: HTMLElement, value: string) => fireEvent.input(field, { target: { value } });

const meta: Meta<typeof EventGuestManager> = {
  title: "Components/EventGuestManager",
  component: EventGuestManager,
  parameters: { layout: "padded" },
  args: {
    eventId: sampleEvent.id,
    eventSlug: sampleEvent.slug,
    guests: sampleGuests,
    maxPartySize: 2,
    replyToEmail: "linda@example.com",
    origin: "https://regibee.com",
    actions: {
      addGuests: fn(async () => ({ error: null, added: 1, alreadyListed: 0 })),
      sendInvites: fn(async () => ({ error: null, sent: 1 })),
      sendReminders: fn(async () => ({ error: null, sent: 1 })),
      setRsvp: ok,
      updateGuest: ok,
      removeGuest: ok,
      copyGuests: fn(async () => ({ error: null, added: 3, alreadyListed: 1 })),
      inviteGroup: fn(async () => ({ error: null, added: 4, alreadyListed: 2 })),
      inviteFollowed: fn(async () => ({ error: null, added: 2, alreadyListed: 0 })),
      saveAsGroup: fn(async () => ({ error: null, groupId: "group-1" })),
    },
    eventTitle: sampleEvent.title,
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof EventGuestManager>;

export const WithGuests: Story = {};

/** Before anyone's added. */
export const NoGuests: Story = { args: { guests: [] } };

/** Clicking Send invitations asks first, and says where replies go. */
export const ConfirmingSend: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Send invitations" }));
    await expect(canvas.getByText("Email the invitation to 1 guest now?")).toBeVisible();
    await expect(canvas.getByText(/Replies go to linda@example.com/)).toBeVisible();
  },
};

/** A guest's Edit button: their details, their RSVP, and their own link. */
export const EditingGuest: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit Glinda Upland" }));
    const dialog = within(await screen.findByRole("dialog"));
    // In the document, not "visible": the dialog fades in, and Chromatic
    // snapshots the end of the fade.
    await expect(dialog.getByText(/token-g1/)).toBeInTheDocument();
  },
};

/**
 * The holiday party: it asks how many kids are coming and has a gift
 * exchange, so the list shows kids and who's in the exchange. The host can
 * also copy guests from their other events.
 */
export const KidsAndGiftExchange: Story = {
  args: {
    eventId: sampleExchangeEvent.id,
    eventSlug: sampleExchangeEvent.slug,
    // As the host's page gets them: wishlists hidden, who drew whom left out.
    guests: sampleExchangeGuests.map(guestForHost),
    maxPartySize: sampleExchangeEvent.max_party_size,
    askKids: true,
    hasExchange: true,
    copySources: [
      { id: sampleEvent.id, title: sampleEvent.title, guestCount: sampleGuests.length },
      { id: "00000000-0000-4000-8000-000000000005", title: "Max Turns 30", guestCount: 1 },
    ],
    groups: [
      { id: "group-1", name: "The Chens", memberCount: 6 },
      { id: "group-2", name: "Book club", memberCount: 1 },
    ],
  },
};

/** "Save as a group" names a group made of everyone on the list. */
export const SavingAsGroup: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save as a group" }));
    const dialog = within(await screen.findByRole("dialog"));
    // In the document, not "visible": the dialog fades in, and Chromatic
    // snapshots the end of the fade.
    await expect(dialog.getByRole("textbox", { name: "Group name" })).toHaveValue(sampleEvent.title);
  },
};

/** A potluck: each guest's row says what they signed up to bring. */
export const WithSignups: Story = {
  args: {
    signups: Object.fromEntries(
      [...claimsByGuest(samplePotluckSheet)].map(([id, claims]) => [id, claims.map(describeClaim)]),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Side (Mac and cheese)")).toBeVisible();
  },
};

/** A wedding's questions: meal counts for everyone going, and each guest's answers. */
export const WithAnswers: Story = {
  args: {
    maxPartySize: 2,
    questions: defaultQuestions(["plus_ones", "meal", "diet"]),
    guests: sampleGuests.map((g) =>
      g.id === "g1"
        ? { ...g, answers: { meal: ["Chicken", "Vegetarian"], plus_ones: ["Galinda"], diet: "No shellfish" } }
        : g.id === "g5"
          ? { ...g, answers: { meal: ["Fish"] } }
          : g,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Chicken: 1 · Fish: 1 · Vegetarian: 1")).toBeVisible();
  },
};

/** People the host follows, as the event page gets them (loadEventPage). */
const followedPeople = [
  { publicId: "dorothy1a2b", name: "Dorothy Gale", mutual: true, onList: false },
  { publicId: "glinda3c4d5", name: "Glinda Upland", mutual: true, onList: true },
  { publicId: "oz6e7f8g9h2", name: "Oz Diggs", mutual: false, onList: false },
];

/**
 * "Invite people you follow" picks people without typing their emails. Each
 * row says whether the host will see the email: only when they follow each
 * other.
 */
export const InvitingPeopleYouFollow: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { followedPeople },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Invite people you follow" }));
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText("Their email stays private")).toBeInTheDocument();
    await expect(dialog.getByText("Already on the guest list")).toBeInTheDocument();
    await userEvent.click(dialog.getByText("Oz Diggs", { exact: true }));
    await expect(dialog.getByRole("button", { name: "Add 1 guest" })).toBeEnabled();
  },
};

/**
 * Guests invited from a follow. Oz doesn't follow the host back, so his email
 * shows as private, and invitations still reach it. Dorothy does, so hers
 * shows. Neither email can be changed from here.
 */
export const PrivateEmail: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    followedPeople,
    guests: [
      ...sampleGuests,
      {
        ...sampleGuests[0],
        id: "guest-oz",
        name: "Oz Diggs",
        email: null,
        email_hidden: true,
        from_account: true,
        token: "token-oz",
        rsvp_status: "pending",
        invited_at: null,
        responded_at: null,
        rsvp_note: null,
      },
      {
        ...sampleGuests[0],
        id: "guest-dorothy",
        name: "Dorothy Gale",
        email: "dorothy@example.com",
        from_account: true,
        token: "token-dorothy",
        rsvp_status: "pending",
        invited_at: null,
        responded_at: null,
        rsvp_note: null,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Email private/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Edit Oz Diggs" }));
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText(/Invitations still reach it/)).toBeInTheDocument();
    await expect(dialog.getByRole("button", { name: "Send invitation" })).toBeInTheDocument();
  },
};

/**
 * "Add another guest" adds a row and puts the cursor in it, so a host can add
 * several guests at once without pasting a list. Rows left blank are skipped,
 * and the form goes back to one row once they're added.
 */
export const AddingSeveralGuests: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    fill(canvas.getByRole("textbox", { name: "Name" }), "Fiyero Tigelaar");
    await userEvent.click(canvas.getByRole("button", { name: "Add another guest" }));
    await expect(canvas.getByRole("textbox", { name: "Guest 2 name" })).toHaveFocus();
    fill(canvas.getByRole("textbox", { name: "Guest 2 name" }), "Boq Woodsman");
    fill(canvas.getByRole("textbox", { name: "Guest 2 email" }), "Boq@Example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Add another guest" }));
    await userEvent.click(canvas.getByRole("button", { name: "Add 2 guests" }));
    await expect(args.actions?.addGuests).toHaveBeenCalledWith(sampleEvent.id, [
      { name: "Fiyero Tigelaar", email: null },
      { name: "Boq Woodsman", email: "boq@example.com" },
    ]);
    await expect(canvas.queryByRole("textbox", { name: "Guest 2 name" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("textbox", { name: "Name" })).toHaveValue("");
  },
};

/** A row with an email but no name: nothing is added, and that row's name is marked. */
export const FixingAGuestRow: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { actions: { addGuests: fn(async () => ({ error: null, added: 2, alreadyListed: 0 })) } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    fill(canvas.getByRole("textbox", { name: "Name" }), "Fiyero Tigelaar");
    fill(canvas.getByRole("textbox", { name: "Email (optional)" }), "fiyero@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Add another guest" }));
    fill(canvas.getByRole("textbox", { name: "Guest 2 email" }), "boq@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Add 2 guests" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("Add a name for each guest.");
    await expect(canvas.getByRole("textbox", { name: "Guest 2 name" })).toHaveAttribute("aria-invalid", "true");
    await expect(args.actions?.addGuests).not.toHaveBeenCalled();
  },
};

/**
 * A guest with a Regibee account the host may be shown gets a Follow button
 * on their row: Follow, Follow back for someone who follows the host,
 * Requested while they haven't approved, then Following or Friends. Guests
 * with no account, like the last ones here, get none.
 */
export const FollowingGuests: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    followActions: { requestAction: fn(async () => ({ success: true })), cancelAction: fn(async () => ({ success: true })) },
    guests: sampleGuests.map((guest, index) => ({
      ...guest,
      follow: (
        [
          { publicId: "abcdefghjk", state: "none", followsYou: false },
          { publicId: "bcdefghjkm", state: "none", followsYou: true },
          { publicId: "cdefghjkmn", state: "pending", followsYou: false },
          { publicId: "defghjkmnp", state: "approved", followsYou: false },
          { publicId: "efghjkmnpq", state: "approved", followsYou: true },
        ] as const
      )[index],
    })),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const follow = canvas.getAllByRole("button", { name: /^Follow / })[0];
    await userEvent.click(follow);
    await expect(args.followActions?.requestAction).toHaveBeenCalledWith("abcdefghjk");
    await expect(canvas.getAllByRole("button", { name: /^Requested / })).toHaveLength(2);
  },
};

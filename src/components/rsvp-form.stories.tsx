import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { RsvpForm } from "./rsvp-form";
import {
  SAMPLE_TODAY,
  sampleExchangeEvent,
  sampleMealTrainSheet,
  samplePotluckSheet,
} from "@/lib/event-sample-data";
import { signupRowsForGuest } from "@/lib/signups";
import { defaultQuestions } from "@/lib/rsvp-questions";

// The RSVP box on its own, for the questions that only some events ask. The
// Event Invitation stories show it inside the whole page.

const meta: Meta<typeof RsvpForm> = {
  title: "Components/RsvpForm",
  component: RsvpForm,
  parameters: { layout: "padded" },
  args: {
    slug: sampleExchangeEvent.slug,
    // Fiyero, from his invitation link, before he answers.
    guest: { name: "Fiyero", status: "pending", partySize: 1, note: null },
    token: "token-g4",
    openRsvp: true,
    maxPartySize: 4,
    passed: false,
    submitAction: fn(async () => ({ error: null })),
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
type Story = StoryObj<typeof RsvpForm>;

/**
 * A party with a gift exchange. Choosing Going shows the exchange box, with
 * Join already checked and the wishlist and gift ideas fields open.
 */
export const PartyWithExchange: Story = {
  args: { exchange: { mailed: false, drawn: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Going" }));
    await expect(canvas.getByRole("checkbox", { name: /Join the gift exchange/ })).toBeChecked();
    await expect(canvas.getByLabelText(/Your wishlist/)).toBeVisible();
  },
};

/**
 * Everyone gives everyone, for a guest signed in with lists of their own.
 * The RSVP asks only whether they're coming. Once they send it, the next step
 * asks for their wishlist, with their lists to pick from.
 */
export const EveryoneGivesEveryone: Story = {
  args: {
    exchange: { kind: "everyone", mailed: false, drawn: false },
    wishlist: {
      current: null,
      giftIdeas: null,
      account: {
        lists: [
          { id: "list-1", title: "Fiyero's Christmas List" },
          { id: "list-2", title: "Fiyero's Birthday Wishlist" },
        ],
      },
      saveAction: fn(async () => ({ error: null })),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Going" }));
    await expect(canvas.getByText(/You.ll add your wishlist after you RSVP/)).toBeVisible();
    await expect(canvas.queryByRole("checkbox", { name: /Join the gift exchange/ })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Send RSVP" }));
    await expect(canvas.getByRole("heading", { name: "Now add your wishlist" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Use Fiyero's Christmas List" })).toBeVisible();
  },
};

/**
 * Everyone gives everyone, for a guest who isn't signed in. After they send
 * their RSVP, they can make a free account and a list, log in to use one they
 * have, or paste a link from another store.
 */
export const EveryoneGivesEveryoneSignedOut: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    exchange: { kind: "everyone", mailed: false, drawn: false },
    wishlist: { current: null, giftIdeas: null, account: null, saveAction: fn(async () => ({ error: null })) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Maybe" }));
    await userEvent.click(canvas.getByRole("button", { name: "Send RSVP" }));
    await expect(canvas.getByRole("link", { name: "Make a free wishlist" })).toHaveAttribute(
      "href",
      `/signup?redirect=${encodeURIComponent(`/e/${sampleExchangeEvent.slug}?g=token-g4#wishlist`)}`,
    );
    await expect(canvas.getByRole("link", { name: "Log in" })).toBeVisible();
  },
};

/**
 * An exchange with no get-together: gifts are mailed. Guests answer "I'm in"
 * or "Not this year", and joining asks for a shipping address.
 */
export const MailedExchange: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { exchange: { mailed: true, drawn: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "I'm in" }));
    await expect(canvas.getByLabelText(/Shipping address/)).toBeVisible();
  },
};

/** The host asked how many kids are coming, so Going shows a second count. */
export const AskingKids: Story = {
  args: { askKids: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Going" }));
    await expect(canvas.getByLabelText(/How many are kids/)).toBeVisible();
  },
};

/**
 * A potluck. Going shows "I'll bring…" with each row's spots left and what
 * others are bringing. Dessert is full. Ticking a row opens a box for what
 * you're bringing.
 */
export const BringingSomething: Story = {
  args: {
    signup: { title: samplePotluckSheet.sheet.title, rows: signupRowsForGuest(samplePotluckSheet, "g4", SAMPLE_TODAY) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Going" }));
    await expect(canvas.getByRole("checkbox", { name: /Dessert/ })).toBeDisabled();
    await userEvent.click(canvas.getByText("Side"));
    await expect(canvas.getByRole("checkbox", { name: /Side/ })).toBeChecked();
    await expect(canvas.getByRole("textbox", { name: "What you're bringing for Side" })).toBeVisible();
  },
};

/**
 * A meal train: no party, so guests answer "I can help" or "Not this time"
 * and pick a day. Monday is taken.
 */
export const MealTrain: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    mealTrain: true,
    maxPartySize: 1,
    signup: { title: sampleMealTrainSheet.sheet.title, rows: signupRowsForGuest(sampleMealTrainSheet, "g4", SAMPLE_TODAY) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Hi Fiyero, can you help?" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "I can help" }));
    await expect(canvas.getByText("Pick a day")).toBeVisible();
    await expect(canvas.getByRole("checkbox", { name: /Mon, Mar 2/ })).toBeDisabled();
  },
};

/** A guest who signed up sees what they're bringing, and can change it. */
export const SignedUp: Story = {
  args: {
    guest: { name: "Glinda", status: "yes", partySize: 2, note: null },
    signup: { title: samplePotluckSheet.sheet.title, rows: signupRowsForGuest(samplePotluckSheet, "g1", SAMPLE_TODAY) },
  },
};

/**
 * A wedding's questions. Coming with someone asks their name, then a meal for
 * each of you. Dietary needs are optional.
 */
export const WeddingQuestions: Story = {
  args: { maxPartySize: 2, questions: defaultQuestions(["plus_ones", "meal", "diet"]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Going" }));
    await userEvent.click(canvas.getByRole("button", { name: /How many people, including you/ }));
    // The list opens at the end of the page, outside the story's canvas.
    const page = within(document.body);
    await userEvent.click(await page.findByRole("option", { name: "2" }));
    // As it closes, the list puts focus back on its button. Wait, or that
    // takes focus from the name field mid-typing.
    await waitFor(() => expect(page.queryByRole("listbox")).not.toBeInTheDocument(), { timeout: 5000 });
    await userEvent.type(canvas.getByRole("textbox", { name: "Name of guest 2" }), "Elphaba");
    await expect(canvas.getByRole("button", { name: /For Elphaba$/ })).toBeVisible();
  },
};

/** A guest who answered sees their answers, with each person's meal. */
export const WeddingAnswered: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    guest: {
      name: "Fiyero",
      status: "yes",
      partySize: 2,
      note: null,
      answers: { meal: ["Fish", "Vegetarian"], plus_ones: ["Elphaba"], diet: "Elphaba is allergic to water" },
    },
    questions: defaultQuestions(["plus_ones", "meal", "diet"]),
  },
};

/**
 * Everyone gives everyone, after a Maybe with a note and a wishlist linked.
 * The answer and Change RSVP come first. The wishlist is one row under them,
 * with changing it or adding another list in its "…" menu.
 */
export const AnsweredWithWishlist: Story = {
  args: {
    exchange: { kind: "everyone", mailed: false, drawn: false },
    guest: { name: "Fiyero", status: "maybe", partySize: 1, note: "Yay! 🎄" },
    wishlist: {
      current: { url: "https://regibee.com/r/fiyeros-list-5j2c", title: "Fiyero's Christmas List", ownListId: "list-1" },
      giftIdeas: null,
      account: {
        lists: [
          { id: "list-1", title: "Fiyero's Christmas List" },
          { id: "list-3", title: "Nessa's Christmas List" },
        ],
      },
      saveAction: fn(async () => ({ error: null })),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "You're maybe attending" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Fiyero's Christmas List" })).toHaveAttribute(
      "href",
      "/dashboard/registry/list-1",
    );
    // The rare changes aren't buttons on the card.
    await expect(canvas.queryByRole("button", { name: "Add another list" })).toBeNull();
    await expect(canvas.getByRole("button", { name: "Wishlist options" })).toBeVisible();
  },
};

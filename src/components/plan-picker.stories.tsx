import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { PlanPicker } from "./plan-picker";

const meta: Meta<typeof PlanPicker> = {
  title: "Components/PlanPicker",
  component: PlanPicker,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-3xl"><Story /></div>],
  args: {
    myName: "Maya",
    startAction: fn(async () => ({ error: null, href: "/dashboard/events/event-1" })),
  },
};
export default meta;
type Story = StoryObj<typeof PlanPicker>;

/**
 * The first step: a gift list on its own, or an event. The lists open the
 * registry form with no event questions.
 */
export const ListsAndEvents: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: /Baby registry/ })).toHaveAttribute(
      "href",
      "/dashboard/registry/new?type=baby",
    );
    // The event steps only show once an event is being planned.
    await expect(canvas.queryByRole("list", { name: "Steps" })).toBeNull();
  },
};

/** A baby shower: it's usually for someone else, so the name field asks for theirs. */
export const WhoItsFor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Baby shower" }));
    await expect(canvas.getByRole("heading", { name: "Who's the baby shower for?" })).toBeVisible();
    await expect(canvas.getByRole("list", { name: "Steps" })).toBeVisible();
    await userEvent.type(canvas.getByRole("textbox", { name: "Their name" }), "Remi");
  },
};

/** A Christmas party for no one in particular: link a wishlist, or draw names so everyone brings one. */
export const GiftsForAParty: Story = {
  args: {
    initial: { step: "gifts", occasion: "christmas", audience: "no_one" },
  },
};

/**
 * A holiday party, like a family Christmas, starts with everyone giving
 * everyone already picked: each guest links their own wishlist when they
 * RSVP. The host can pick Draw names instead, or unpick it and skip.
 */
export const HolidayParty: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Holiday party" }));
    await expect(canvas.getByRole("heading", { name: "Who's the holiday party for?" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Everyone taking part" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(canvas.getByRole("button", { name: /Everyone gives everyone/ })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: "Next" })).toBeVisible();
  },
};

/**
 * Gifts are optional. With nothing picked the button says Skip, and clicking
 * a picked card again unpicks it. Skipping makes the event with nothing
 * about gifts.
 */
export const SkipGifts: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    initial: { step: "gifts", occasion: "wedding", audience: "us", name: "Alex & Sam" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const registry = canvas.getByRole("button", { name: /Make your wedding registry/ });
    await userEvent.click(registry);
    await expect(canvas.getByRole("button", { name: "Next" })).toBeVisible();
    await userEvent.click(registry);
    await expect(registry).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(canvas.getByRole("button", { name: "Skip" }));
    await expect(canvas.getByRole("heading", { name: "Name your event" })).toBeVisible();
    await expect(canvas.getByText("Nothing about gifts yet")).toBeVisible();
  },
};

/** Your own birthday, when you already have lists: pick one instead of pasting its link. */
export const UseAListYouHave: Story = {
  args: {
    myLists: [
      { id: "list-1", title: "Maya's Birthday Wishlist" },
      { id: "list-2", title: "Maya's Christmas List" },
    ],
    initial: { step: "gifts", occasion: "birthday", audience: "me", name: "Maya", gifts: "link", registryId: "list-1" },
  },
};

/** Someone else's shower: link their list, or ask them to make one. */
export const GiftsForSomeoneElse: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    initial: { step: "gifts", occasion: "baby_shower", audience: "someone", name: "Remi", gifts: "ask", askEmail: "remi@example.com" },
  },
};

/** A child's birthday: make their wishlist and an invitation together. */
export const GiftsForMyChild: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    initial: { step: "gifts", occasion: "kids_birthday", audience: "child", name: "Jordan", gifts: "new_list", invitation: true },
  },
};

/** The last step says everything it will make. */
export const NameIt: Story = {
  args: {
    initial: {
      step: "name",
      occasion: "kids_birthday",
      audience: "child",
      name: "Jordan",
      gifts: "new_list",
      invitation: true,
      title: "Jordan's Birthday Party",
      date: "2027-03-14",
    },
  },
};

/** A Secret Santa skips straight to its name: everyone draws names. */
export const SecretSanta: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Gift exchange" }));
    await expect(
      canvas.getByText("A Secret Santa draw. Set the budget and draw date next."),
    ).toBeVisible();
  },
};

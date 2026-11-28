import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";
import { EventForm } from "./event-form";
import { SAMPLE_REGISTRY_ID, sampleEvent, sampleLinkedRegistries } from "@/lib/event-sample-data";
import { defaultQuestions } from "@/lib/rsvp-questions";

const registries = [
  { id: SAMPLE_REGISTRY_ID, title: "Remi & Max's Baby Registry" },
  { id: "00000000-0000-4000-8000-000000000003", title: "Max's Birthday Wishlist" },
];

/**
 * The edit page around the form, under a stand-in top bar: as wide as the
 * Account page, with the section navigation on the left from lg.
 */
function EditPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="sticky top-0 z-50 h-16 border-b border-secondary bg-primary" />
      <div className="container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl">
        <h1 className="text-3xl font-bold">Edit event</h1>
        <div className="mt-6">{children}</div>
      </div>
    </>
  );
}

/** Puts a section's #fragment in the URL, as a link from the event's page does. */
const withSectionInUrl = (section: string) => () => {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${section}`);
};

const meta: Meta<typeof EventForm> = {
  title: "Components/EventForm",
  component: EventForm,
  parameters: { layout: "padded" },
  // The edit page's navigation goes to the section in the URL's #fragment.
  // Storybook keeps the URL between stories, so each starts without one.
  beforeEach: () => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  },
  args: {
    registries,
    createAction: fn(async () => ({ error: "This is a story, so nothing was saved." })),
    updateAction: fn(async () => ({ error: "This is a story, so nothing was saved." })),
    setImageAction: fn(async () => ({ error: null })),
    uploadImage: fn(async () => ({ url: "/samples/invitation.svg" })),
    lookupAction: fn(async () => ({ error: "This is a story, so no link was looked up." })),
  },
  decorators: [
    (Story, { args }) =>
      args.eventId ? (
        <EditPage>
          <Story />
        </EditPage>
      ) : (
        <div className="max-w-2xl">
          <Story />
        </div>
      ),
  ],
};
export default meta;
type Story = StoryObj<typeof EventForm>;

// A new event is a stack of steps, like a new registry. A fixed time zone, so
// the snapshot doesn't depend on where it's taken.
const newEvent = { initial: { time_zone: "America/Los_Angeles" } };

// Steps open and close with a 200ms transition. Wait for it to end so the
// snapshot shows the finished layout.
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

// Sets a text field's value. The form focuses fields in code when a step
// opens, and after that React doesn't always see what userEvent types.
// fireEvent.input sets the value the way React expects.
const fill = (field: HTMLElement, value: string) => fireEvent.input(field, { target: { value } });

const isOpen = (canvasElement: HTMLElement, name: RegExp) =>
  expect(within(canvasElement).getByRole("button", { name, expanded: true })).toBeInTheDocument();

/** Opens a step from its header. */
const openStep = async (canvasElement: HTMLElement, name: RegExp) => {
  await userEvent.click(within(canvasElement).getByRole("button", { name }));
  await waitFor(() => isOpen(canvasElement, name));
  await settle();
};

/** The first step: what the event is. Picking an occasion moves on to its name. */
export const NewEvent: Story = {
  args: newEvent,
};

/** Picking an occasion closes its step and puts the cursor in the name. */
export const NewEventName: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: newEvent,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Kid's birthday" }));
    await waitFor(() => expect(canvas.getByLabelText(/Event name/)).toHaveFocus());
    await isOpen(canvasElement, /Name and date/);
    await settle();
  },
};

export const NewEventTimeAndPlace: Story = {
  args: newEvent,
  play: async ({ canvasElement }) => openStep(canvasElement, /Time and place/),
};

/** "Plan an event" on a registry's page starts with that registry linked. */
export const NewEventGifts: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { ...newEvent, startRegistryId: SAMPLE_REGISTRY_ID },
  play: async ({ canvasElement }) => {
    await openStep(canvasElement, /^\d?\s*Gifts(?! among)/);
    await expect(within(canvasElement).getByText("Remi & Max's Baby Registry")).toBeVisible();
  },
};

/**
 * A gift exchange turns on gifts among the guests, with names drawn. Occasions
 * whose guests don't give each other gifts, like a baby shower, skip the step.
 */
export const NewEventGiftExchange: Story = {
  args: newEvent,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: /Gifts among the guests/ })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Gift exchange" }));
    await waitFor(() => isOpen(canvasElement, /Name and date/));
    fill(canvas.getByLabelText(/Event name/), "Chen Family Secret Santa");
    await openStep(canvasElement, /Gifts among the guests/);
    await expect(canvas.getByRole("checkbox", { name: "Guests give gifts to each other" })).toBeChecked();
    await expect(canvas.getByRole("button", { name: /Draw names/ })).toHaveAttribute("aria-pressed", "true");
  },
};

export const NewEventInvitation: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: newEvent,
  play: async ({ canvasElement }) => openStep(canvasElement, /Invitation/),
};

/** The RSVP settings start with each occasion's own, so the host can skip them. */
export const NewEventRsvps: Story = {
  args: newEvent,
  play: async ({ canvasElement }) => openStep(canvasElement, /RSVPs/),
};

/** Pressing Create with no name opens the name step and says what's missing. */
export const NewEventMissingName: Story = {
  args: newEvent,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Create event" }));
    await waitFor(() => expect(canvas.getByLabelText(/Event name/)).toHaveFocus());
    await expect(canvas.getByText("Give your event a name.")).toBeVisible();
    await settle();
  },
};

/**
 * The whole flow: keep the baby shower, name it, add a start time and a
 * place, skip the invitation and gifts, and keep the RSVP settings. Every
 * step ends up closed with a summary, and the cursor is on Create.
 */
export const NewEventAllStepsDone: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: newEvent,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const step = (name: RegExp) => within(canvas.getByRole("region", { name }));

    await userEvent.click(canvas.getByRole("button", { name: "Baby shower" }));
    const title = canvas.getByLabelText(/Event name/);
    await waitFor(() => expect(title).toHaveFocus());
    fill(title, "Remi's Baby Shower");
    fill(canvas.getByLabelText(/^Date/), "2027-03-14");

    await waitFor(() => isOpen(canvasElement, /Time and place/));
    fill(canvas.getByLabelText(/^Starts/), "14:00");
    fill(canvas.getByLabelText(/^Ends/), "16:00");
    fill(canvas.getByLabelText(/^Place/), "Grandma's house");
    await userEvent.click(step(/Time and place/).getByRole("button", { name: "Continue" }));

    await waitFor(() => isOpen(canvasElement, /Invitation/));
    await userEvent.click(step(/Invitation/).getByRole("button", { name: "Skip" }));
    await waitFor(() => isOpen(canvasElement, /^\d?\s*Gifts(?! among)/));
    await userEvent.click(step(/^\d?\s*Gifts(?! among)/).getByRole("button", { name: "Skip" }));
    await waitFor(() => isOpen(canvasElement, /RSVPs/));
    await userEvent.click(step(/RSVPs/).getByRole("button", { name: "Done" }));

    await waitFor(() => expect(canvas.getByRole("button", { name: "Create event" })).toHaveFocus());
    await settle();
  },
};

/**
 * A get-together usually has no gifts, so its Gifts step comes last, after
 * the RSVPs, and it doesn't ask about gifts among the guests.
 */
export const NewGetTogether: Story = {
  args: newEvent,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Get-together" }));
    await waitFor(() => isOpen(canvasElement, /Name and date/));
    fill(canvas.getByLabelText(/Event name/), "Game Night");
    const headers = canvas
      .getAllByRole("button", { expanded: false })
      .map((button) => button.textContent ?? "")
      .filter((text) => /Time and place|Invitation|RSVPs|Gifts/.test(text));
    await expect(headers.map((text) => text.match(/Time and place|Invitation|RSVPs|Gifts/)?.[0])).toEqual([
      "Time and place",
      "Invitation",
      "RSVPs",
      "Gifts",
    ]);
    await expect(canvas.queryByRole("button", { name: /Gifts among the guests/ })).toBeNull();
    await settle();
  },
};

// The edit page always passes the event's linked registries.
const linkedRegistries = [{ id: registries[0].id, title: registries[0].title }];

// The edit page fills the screen, under the top bar.
const editPage = { layout: "fullscreen" };

/** Editing shows every section at once, with a navigation to them on the left. */
export const EditingWithPicture: Story = {
  parameters: editPage,
  globals: { viewport: { value: "desktop" } },
  args: { eventId: sampleEvent.id, initial: sampleEvent, linkedRegistries },
};

/**
 * "Add your invitation" on the event's page links to #invitation. The page
 * opens there: Invitation is current in the navigation, and focus is on its
 * title, so Tab goes on to the upload button.
 */
export const EditingFromAddYourInvitation: Story = {
  parameters: { ...editPage, chromatic: { disableSnapshot: true } },
  globals: { viewport: { value: "desktop" } },
  args: { eventId: sampleEvent.id, initial: { ...sampleEvent, image_url: null }, linkedRegistries },
  beforeEach: withSectionInUrl("invitation"),
  play: async ({ canvas }) => {
    const nav = within(canvas.getByRole("navigation", { name: "Event sections" }));
    await waitFor(() => expect(canvas.getByRole("heading", { name: "Invitation" })).toHaveFocus());
    await expect(nav.getByRole("link", { name: "Invitation" })).toHaveAttribute("aria-current", "location");
    await expect(nav.getByRole("link", { name: "Occasion and name" })).not.toHaveAttribute("aria-current");
    // The section starts just under the top bar, not hidden behind it.
    const top = canvas.getByRole("region", { name: "Invitation" }).getBoundingClientRect().top;
    await expect(top).toBeGreaterThanOrEqual(64);
    await expect(top).toBeLessThan(160);
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: /Upload your invitation/ })).toHaveFocus();
  },
};

/**
 * On a phone the sections are a row of links that sticks under the top bar
 * and scrolls sideways by itself. Following one goes to its section.
 */
export const EditingOnPhone: Story = {
  parameters: editPage,
  globals: { viewport: { value: "mobile1" } },
  args: { eventId: sampleEvent.id, initial: sampleEvent, linkedRegistries },
  play: async ({ canvas }) => {
    const nav = within(canvas.getByRole("navigation", { name: "Event sections" }));
    await userEvent.click(nav.getByRole("link", { name: "RSVPs" }));
    await waitFor(() => expect(nav.getByRole("link", { name: "RSVPs" })).toHaveAttribute("aria-current", "location"));
    await expect(canvas.getByRole("heading", { name: "RSVPs" })).toHaveFocus();
    // The row scrolls; the page doesn't.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

/**
 * The Gifts and Gift exchange sections filled in. The event links the host's
 * own registry and one they added by pasting its link, which shows whose it
 * is. Guests also say how many kids are coming.
 */
export const EditingWithGiftsAndExchange: Story = {
  parameters: editPage,
  args: {
    eventId: sampleEvent.id,
    initial: {
      ...sampleEvent,
      image_url: null,
      ask_kids: true,
      gift_note: "Gifts are optional. If you'd like to bring something, here's what Remi & Max still need.",
    },
    linkedRegistries: [
      { id: registries[0].id, title: registries[0].title },
      {
        id: sampleLinkedRegistries[1].id,
        title: sampleLinkedRegistries[1].title,
        honoree: sampleLinkedRegistries[1].honoree,
        link: `https://regibee.com/r/${sampleLinkedRegistries[1].slug}`,
      },
    ],
    exchange: { budget: "$15", draw_by: "2026-03-07", mailed: false, drawn_at: null },
  },
};

/** A wedding asks each person's meal, the names of plus-ones, and any dietary needs. */
export const EditingWeddingQuestions: Story = {
  parameters: { ...editPage, chromatic: { disableSnapshot: true } },
  args: {
    eventId: sampleEvent.id,
    initial: {
      ...sampleEvent,
      event_type: "wedding",
      title: "Alex & Sam's Wedding",
      image_url: null,
      rsvp_questions: defaultQuestions(["plus_ones", "meal", "diet"]),
    },
    linkedRegistries,
  },
};

/** Changing the place of an event offers to email guests about it. */
export const ChangingThePlace: Story = {
  parameters: { ...editPage, chromatic: { disableSnapshot: true } },
  args: { eventId: sampleEvent.id, initial: { ...sampleEvent, image_url: null }, linkedRegistries },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Set the whole value at once. Typing into this big form doesn't always
    // reach React in the play function, though it does for a person.
    fireEvent.change(canvas.getByRole("textbox", { name: /^Place/ }), {
      target: { value: "Grandma Jo's garden, in the back" },
    });
    await expect(await canvas.findByRole("checkbox", { name: /Email guests about the new place/ })).toBeChecked();
  },
};

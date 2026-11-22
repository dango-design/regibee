import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { EventInvitation, type InvitationRegistry } from "./event-invitation";
import { RsvpForm } from "./rsvp-form";
import {
  SAMPLE_TODAY,
  sampleEvent,
  sampleEveryoneExchange,
  sampleExchange,
  sampleExchangeEvent,
  sampleGuestWishLists,
  sampleLinkedRegistries,
  sampleMealTrainEvent,
  sampleMealTrainSheet,
  samplePotluckEvent,
  samplePotluckSheet,
  sampleRegistry,
} from "@/lib/event-sample-data";
import { signupRowsForGuest, withAddressFor } from "@/lib/signups";
import { changeNotice, type InvitationUpdate } from "@/lib/event-updates";
import { formatEventDate, formatEventTime } from "@/lib/events";

// The public event page (src/app/e/[slug]/page.tsx) without its header and
// footer. The page reads the event on the server, which Storybook can't render.

const submitAction = fn(async () => ({ error: "This is a story, so nothing was saved." }));

const calendar = { google: "https://calendar.google.com/calendar/render", ics: "#" };

const meta: Meta<typeof EventInvitation> = {
  title: "Pages/Event Invitation (Guest View)",
  component: EventInvitation,
  parameters: { layout: "padded" },
  args: { event: sampleEvent, registry: sampleRegistry, calendar },
};
export default meta;
type Story = StoryObj<typeof EventInvitation>;

/** Someone on the plain event link: they add their name and email to RSVP. */
export const WithPicture: Story = {
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={sampleEvent.slug}
            guest={null}
            token={null}
            openRsvp
            maxPartySize={2}
            passed={false}
            submitAction={submitAction}
          />
      }
    />
  ),
};

/** No picture uploaded: a tinted header stands in. This guest already replied. */
export const NoPictureAlreadyReplied: Story = {
  args: { event: { ...sampleEvent, image_url: null, event_type: "birthday", title: "Max Turns 30", hosted_by: null } },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={sampleEvent.slug}
            guest={{ name: "Glinda", status: "yes", partySize: 2, note: "Wouldn't miss it!" }}
            token="token-g1"
            openRsvp
            maxPartySize={2}
            passed={false}
            submitAction={submitAction}
          />
      }
    />
  ),
};

/** A guest from their invitation link picks Going, so the party size shows. */
export const ChoosingGoing: Story = {
  args: { event: { ...sampleEvent, image_url: null }, registry: null, calendar: null },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={sampleEvent.slug}
            guest={{ name: "Fiyero", status: "pending", partySize: 1, note: null }}
            token="token-g4"
            openRsvp
            maxPartySize={4}
            passed={false}
            submitAction={submitAction}
          />
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Going" }));
    // A pattern, because labels hold a hidden "*" for required fields.
    await expect(canvas.getByLabelText(/How many people, including you/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Send RSVP" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("This is a story");
  },
};

/** The host turned off open RSVPs, and this visitor has no personal link. */
export const InviteOnly: Story = {
  args: { event: { ...sampleEvent, image_url: null }, registry: null },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={sampleEvent.slug}
            guest={null}
            token={null}
            openRsvp={false}
            maxPartySize={2}
            passed={false}
            submitAction={submitAction}
          />
      }
    />
  ),
};

const hostUpdates: InvitationUpdate[] = [
  {
    id: "u2",
    kind: "message",
    subject: "Parking for Saturday",
    body: "Sunnyside fills up fast, so park on Rose Street and come in through the side gate.\nSee you there!",
    created_at: "2026-03-12T02:30:00Z",
  },
  {
    id: "u1",
    kind: "change",
    subject: `New time: ${sampleEvent.title}`,
    body: changeNotice(["time"], `${formatEventDate(sampleEvent.event_date!)}, ${formatEventTime(sampleEvent)}`),
    created_at: "2026-03-05T19:00:00Z",
  },
];

/**
 * A guest the host texted the link to. They get no email, so the host's
 * message and the new time show on the invitation, newest first.
 */
export const WithHostUpdates: Story = {
  args: { event: { ...sampleEvent, image_url: null }, updates: hostUpdates },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={sampleEvent.slug}
            guest={{ name: "Glinda", status: "yes", partySize: 2, note: null }}
            token="token-g1"
            openRsvp
            maxPartySize={2}
            passed={false}
            submitAction={submitAction}
          />
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const updates = within(canvasElement).getByRole("region", { name: "Updates from the host" });
    await expect(within(updates).getAllByRole("listitem")).toHaveLength(2);
    await expect(within(updates).getByText(/^New time\. It's now Saturday, March 14, 2026, 2/)).toBeInTheDocument();
  },
};

// The pictures are the landing page's drawings, so the story needs no network.
const [mainRegistry, bookRegistry] = sampleLinkedRegistries;
const linkedRegistries: InvitationRegistry[] = [
  {
    ...mainRegistry,
    itemsLeft: 23,
    items: [
      { id: "i1", title: "Glass Baby Bottles, 4 Pack", image_url: "/hero/bottle.svg", price: 34.99 },
      { id: "i2", title: "Organic Cotton Bibs", image_url: "/hero/bib.svg", price: 18 },
      { id: "i3", title: "Newborn Sock Set", image_url: "/hero/socks.svg", price: 12.5 },
      { id: "i4", title: "Panda Lovey", image_url: "/hero/panda.svg", price: 24 },
    ],
  },
  {
    ...bookRegistry,
    itemsLeft: 1,
    // No picture, so a gift icon stands in. And no price.
    items: [{ id: "i5", title: "Goodnight Moon (Board Book)", image_url: null, price: null }],
  },
];

/**
 * The shower links two registries and shows a few gifts each still needs.
 * The host added a gift note. This guest already replied.
 */
export const WithRegistriesAndGiftNote: Story = {
  args: {
    event: {
      ...sampleEvent,
      image_url: null,
      gift_note: "Gifts are optional. If you'd like to bring something, here's what Remi & Max still need.",
    },
    registry: null,
    registries: linkedRegistries,
    eventSlug: sampleEvent.slug,
    guestToken: "token-g1",
  },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={sampleEvent.slug}
            guest={{ name: "Glinda", status: "yes", partySize: 2, note: null }}
            token="token-g1"
            openRsvp
            maxPartySize={2}
            passed={false}
            submitAction={submitAction}
          />
      }
    />
  ),
};

/**
 * The same gifts on a phone. Each list is one short row: one picture,
 * its name and how many gifts are left. The whole row opens the list.
 */
export const WithRegistriesPhone: Story = {
  ...WithRegistriesAndGiftNote,
  globals: { viewport: { value: "mobile1" } },
  play: async ({ canvasElement }) => {
    const gifts = within(canvasElement).getByRole("region", { name: "Gifts" });
    const lists = within(gifts).getAllByRole("link");
    await expect(lists).toHaveLength(2);
    await expect(lists[0]).toHaveAccessibleName(/23 gifts still needed$/);
    await expect(lists[0]).toHaveAttribute("href", expect.stringContaining(`/e/${sampleEvent.slug}/gifts?g=token-g1`));
    await expect(lists[1]).toHaveAccessibleName(/1 gift still needed$/);
  },
};

/**
 * A holiday party with a gift exchange, before names are drawn. This guest
 * replied, said how many kids are coming and joined the exchange.
 */
export const WithGiftExchange: Story = {
  args: {
    event: sampleExchangeEvent,
    registry: null,
    exchange: sampleExchange,
    eventSlug: sampleExchangeEvent.slug,
    guestToken: "token-g1",
  },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={sampleExchangeEvent.slug}
            guest={{
              name: "Glinda",
              status: "yes",
              partySize: 3,
              kidsCount: 2,
              note: "We'll bring dumplings!",
              inExchange: true,
              wishlistUrl: "https://regibee.com/r/glindas-wishlist-8h3m",
              giftIdeas: "Anything pink and sparkly",
            }}
            token="token-g1"
            openRsvp
            maxPartySize={sampleExchangeEvent.max_party_size}
            askKids
            exchange={{ mailed: false, drawn: false }}
            passed={false}
            submitAction={submitAction}
          />
      }
    />
  ),
};

const potluckRows = signupRowsForGuest(samplePotluckSheet, "g1", SAMPLE_TODAY);

/**
 * A potluck with a sign-up sheet. Glinda signed up to bring a side. The sheet
 * shows what everyone's bringing, but not who.
 */
export const PotluckWithSignupSheet: Story = {
  args: {
    event: samplePotluckEvent,
    registry: null,
    signup: { title: samplePotluckSheet.sheet.title, note: samplePotluckSheet.sheet.note, rows: potluckRows },
  },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={samplePotluckEvent.slug}
            guest={{ name: "Glinda", status: "yes", partySize: 2, note: null }}
            token="token-g1"
            openRsvp
            maxPartySize={2}
            passed={false}
            signup={{ title: samplePotluckSheet.sheet.title, rows: potluckRows }}
            submitAction={submitAction}
          />
      }
    />
  ),
};

const mealTrainRows = signupRowsForGuest(sampleMealTrainSheet, "g4", SAMPLE_TODAY);

/**
 * A meal train, for a guest who hasn't signed up yet. The drop-off address
 * stays hidden until they pick a day.
 */
export const MealTrainBeforeSigningUp: Story = {
  args: {
    event: withAddressFor(sampleMealTrainEvent, false),
    registry: null,
    calendar: null,
    addressHidden: true,
    signup: {
      title: sampleMealTrainSheet.sheet.title,
      note: sampleMealTrainSheet.sheet.note,
      rows: mealTrainRows,
      mealTrain: true,
    },
  },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={sampleMealTrainEvent.slug}
            guest={{ name: "Fiyero", status: "pending", partySize: 1, note: null }}
            token="token-g4"
            openRsvp
            maxPartySize={1}
            passed={false}
            mealTrain
            signup={{ title: sampleMealTrainSheet.sheet.title, rows: mealTrainRows }}
            submitAction={submitAction}
          />
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("The drop-off address shows here once you sign up for a day.")).toBeVisible();
    await expect(canvas.queryByText(/Sunnyside/)).toBeNull();
  },
};

/** The host's own wish list, linked to the family Christmas. It shows on her profile, so guests see her name. */
const hostsList: InvitationRegistry = {
  title: "Aunt Linda's Christmas List",
  slug: "aunt-lindas-list-5r2t",
  itemsLeft: 4,
  items: [{ id: "i6", title: "Panda Lovey", image_url: "/hero/panda.svg", price: 24 }],
  ownerName: "Linda Park",
};

/**
 * A family Christmas where everyone gives everyone. Glinda replied with her
 * wish list. Her RSVP comes first, then one section with everyone's lists:
 * the one Aunt Linda linked first, then each guest's.
 */
export const EveryoneGivesEveryone: Story = {
  args: {
    event: {
      ...sampleExchangeEvent,
      title: "Christmas at Aunt Linda's",
      gift_note: "Wrapped gifts go under the tree when you arrive.",
    },
    registry: null,
    registries: [hostsList],
    exchange: sampleEveryoneExchange,
    wishLists: { lists: sampleGuestWishLists, waitingCount: 2 },
    eventSlug: sampleExchangeEvent.slug,
    guestToken: "token-g1",
  },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
          <RsvpForm
            slug={sampleExchangeEvent.slug}
            guest={{
              name: "Glinda",
              status: "yes",
              partySize: 3,
              kidsCount: 2,
              note: "We'll bring dumplings!",
              inExchange: true,
              wishlistUrl: "https://regibee.com/r/glindas-wishlist-8h3m",
              giftIdeas: null,
            }}
            token="token-g1"
            openRsvp
            maxPartySize={sampleExchangeEvent.max_party_size}
            askKids
            exchange={{ kind: "everyone", mailed: false, drawn: false }}
            wishlist={{
              current: {
                url: "https://regibee.com/r/glindas-wishlist-8h3m",
                title: "Glinda's Christmas List",
                ownListId: "glindas-list",
              },
              giftIdeas: null,
              account: { lists: [{ id: "glindas-list", title: "Glinda's Christmas List" }] },
              saveAction: async () => ({ error: null }),
            }}
            passed={false}
            submitAction={submitAction}
          />
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // One section for every list: no separate Gifts or exchange boxes.
    await expect(canvas.queryByRole("region", { name: "Gifts" })).toBeNull();
    await expect(canvas.queryByRole("region", { name: "Everyone gives everyone" })).toBeNull();
    const lists = canvas.getByRole("region", { name: "Everyone's wish lists" });
    await expect(within(lists).getByText(/about \$25 a gift/)).toBeVisible();
    const links = within(lists).getAllByRole("link");
    // The host's list looks like a guest's: whose it is, then its name.
    await expect(links.map((link) => link.textContent)).toEqual([
      "See Linda's list",
      "See Elphaba's list",
      "See Fiyero's list",
    ]);
    await expect(links[0]).toHaveAttribute(
      "href",
      `/e/${sampleExchangeEvent.slug}/gifts?g=token-g1&to=${hostsList.slug}`,
    );
  },
};

export const EveryoneGivesEveryonePhone: Story = {
  ...EveryoneGivesEveryone,
  play: undefined,
  globals: { viewport: { value: "mobile1" } },
};

/**
 * Someone on the plain event link who isn't a guest yet. They see how the
 * exchange works and the host's list, but not the guests' lists.
 */
export const EveryoneGivesEveryoneVisitor: Story = {
  args: {
    ...EveryoneGivesEveryone.args,
    wishLists: null,
    guestToken: null,
  },
  render: (args) => (
    <EventInvitation
      {...args}
      reply={
        <RsvpForm
          slug={sampleExchangeEvent.slug}
          guest={null}
          token={null}
          openRsvp
          maxPartySize={sampleExchangeEvent.max_party_size}
          exchange={{ kind: "everyone", mailed: false, drawn: false }}
          passed={false}
          submitAction={submitAction}
        />
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const lists = within(canvasElement).getByRole("region", { name: "Everyone's wish lists" });
    await expect(within(lists).getAllByRole("link")).toHaveLength(1);
    await expect(within(lists).getByText("Aunt Linda's Christmas List")).toBeVisible();
    await expect(within(lists).queryByText("Elphaba Thropp")).toBeNull();
  },
};

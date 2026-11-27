import type { Meta, StoryObj } from "@storybook/react";
import { EmailPreview } from "./email-preview";
import {
  itemReservedBuyerHtml,
  itemReservationReminderBuyerHtml,
  itemReservationEndedBuyerHtml,
  itemGivenBuyerHtml,
  itemCoveredBuyerHtml,
  cashFundContributionBuyerHtml,
  itemGivenOwnerHtml,
  itemCoveredOwnerHtml,
  cashFundContributionOwnerHtml,
  newSuggestionOwnerHtml,
  giftsRevealedOwnerHtml,
  completionDiscountOwnerHtml,
  managerInviteHtml,
  followRequestHtml,
  followInviteHtml,
  birthdayReminderHtml,
  birthdayReminderSubject,
  eventInvitationHtml,
  rsvpGuestConfirmationHtml,
  rsvpHostNotificationHtml,
  guestMessageHtml,
  eventChangedHtml,
  dayBeforeReminderHtml,
  eventCancelledHtml,
  giftRemovedBuyerHtml,
  welcomeHtml,
  followApprovedHtml,
  giftDigestHtml,
  thanksReminderHtml,
} from "@/lib/email-templates";
import { AUTH_EMAILS, AUTH_NOTIFICATIONS } from "@/lib/auth-email-templates";
import { coHostInviteHtml, exchangeAssignmentHtml, listRequestHtml, registryLinkedHtml } from "@/lib/event-email-templates";
import { sampleLinkedRegistries } from "@/lib/event-sample-data";

const meta: Meta<typeof EmailPreview> = {
  title: "Email Templates",
  component: EmailPreview,
  parameters: { layout: "centered" },
  args: {
    from: "Regibee <notifications@regibee.com>",
    to: "glinda@example.com",
  },
};
export default meta;
type Story = StoryObj<typeof EmailPreview>;

// One story per template. Add a second story for a template only when an
// option changes its layout, not just its wording.

const sampleAddress = "123 Main St\nApt 4B\nSan Francisco, CA 94102";

// ── Buyer Confirmations ──────────────────────────────────────

const sampleGiftLink = "https://regibee.com/r/remi-and-max/gift/6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f";

// Sent when a guest reserves an item, which holds it for them for 2 days.
export const BuyerItemReserved: Story = {
  args: {
    subject: 'You reserved "Glass Baby Bottles, 4 Pack". It\'s held for 2 days',
    html: itemReservedBuyerHtml({
      buyerName: "Glinda",
      itemTitle: "Glass Baby Bottles, 4 Pack",
      itemImageUrl: "/hero/bottle.svg",
      itemPrice: 34.99,
      quantity: 1,
      parentName: "Remi & Max",
      registryTitle: "Remi & Max's Baby Registry",
      holdDays: 2,
      shippingAddress: sampleAddress,
      shopUrl: "https://amazon.com/dp/B07WFXGNGB",
      storeName: "Amazon",
      confirmUrl: `${sampleGiftLink}?step=confirm`,
      releaseUrl: `${sampleGiftLink}?step=release`,
    }),
  },
};

// For an item on the owners' own store registry: no address, because the
// store has it.
export const BuyerItemReservedOnStoreRegistry: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: 'You reserved "Solly Baby Wrap". It\'s held for 2 days',
    html: itemReservedBuyerHtml({
      buyerName: "Glinda",
      itemTitle: "Solly Baby Wrap",
      quantity: 1,
      parentName: "Remi & Max",
      registryTitle: "Remi & Max's Baby Registry",
      holdDays: 2,
      registryStoreName: "Amazon",
      shopUrl: "https://www.amazon.com/dp/B0EXAMPLE?colid=EXAMPLE&coliid=EXAMPLE&psc=1",
      storeName: "Amazon",
      confirmUrl: `${sampleGiftLink}?step=confirm`,
      releaseUrl: `${sampleGiftLink}?step=release`,
    }),
  },
};

// Sent once, about a day before a reservation the guest hasn't confirmed ends.
export const BuyerItemReservationReminder: Story = {
  args: {
    subject: 'Your reservation of "Glass Baby Bottles, 4 Pack" ends soon',
    html: itemReservationReminderBuyerHtml({
      buyerName: "Glinda",
      itemTitle: "Glass Baby Bottles, 4 Pack",
      itemImageUrl: "/hero/bottle.svg",
      itemPrice: 34.99,
      parentName: "Remi & Max",
      registryTitle: "Remi & Max's Baby Registry",
      hoursLeft: 30,
      shippingAddress: sampleAddress,
      shopUrl: "https://amazon.com/dp/B07WFXGNGB",
      storeName: "Amazon",
      confirmUrl: `${sampleGiftLink}?step=confirm`,
      releaseUrl: `${sampleGiftLink}?step=release`,
    }),
  },
};

// Sent when a reservation runs out and the item goes back on the list.
export const BuyerItemReservationEnded: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: 'Your reservation of "Glass Baby Bottles, 4 Pack" ended',
    html: itemReservationEndedBuyerHtml({
      buyerName: "Glinda",
      itemTitle: "Glass Baby Bottles, 4 Pack",
      registryTitle: "Remi & Max's Baby Registry",
      registryUrl: "https://regibee.com/r/remi-and-max",
    }),
  },
};

// Sent when the guest says they bought it.
export const BuyerItemGiven: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: 'Your gift is confirmed — "Glass Baby Bottles, 4 Pack"',
    html: itemGivenBuyerHtml({
      buyerName: "Glinda",
      itemTitle: "Glass Baby Bottles, 4 Pack",
      itemImageUrl: "/hero/bottle.svg",
      quantity: 1,
      parentName: "Remi & Max",
      registryTitle: "Remi & Max's Baby Registry",
      registryUrl: "https://regibee.com/r/remi-and-max?email=glinda%40example.com&sig=a1b2c3d4e5f6a7b8",
      undoUrl: `${sampleGiftLink}?step=release`,
    }),
  },
};

// Sent when a guest says they sent the money for an item the owners bought.
// The gift counts at once, so the email has a way to undo it.
export const BuyerItemCovered: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: 'Your gift is confirmed — "UPPAbaby Vista V2 Stroller"',
    html: itemCoveredBuyerHtml({
      buyerName: "Glinda",
      itemTitle: "UPPAbaby Vista V2 Stroller",
      quantity: 1,
      amount: 979.99,
      parentName: "Remi & Max",
      registryTitle: "Remi & Max's Baby Registry",
      registryUrl: "https://regibee.com/r/remi-and-max?email=glinda%40example.com&sig=a1b2c3d4e5f6a7b8",
      undoUrl: `${sampleGiftLink}?step=release`,
    }),
  },
};

export const BuyerCashFundContribution: Story = {
  args: {
    subject: 'Your contribution is confirmed — "Nursery Furniture Fund"',
    html: cashFundContributionBuyerHtml({
      buyerName: "Glinda",
      fundTitle: "Nursery Furniture Fund",
      amount: 50,
      parentName: "Remi & Max",
      registryTitle: "Remi & Max's Baby Registry",
      paymentMethods: { venmo: "@remi-and-max", zelle: "max@example.com" },
      registryUrl: "https://regibee.com/r/remi-and-max?email=glinda%40example.com&sig=a1b2c3d4e5f6a7b8",
    }),
  },
};

// ── Owner Notifications ──────────────────────────────────────

// Sent when a guest says they bought an item, not when they reserve it.
export const OwnerItemGiven: Story = {
  args: {
    subject: '🎁 Auntie Glinda bought "Glass Baby Bottles, 4 Pack"',
    to: "max@example.com",
    html: itemGivenOwnerHtml({
      ownerName: "Max",
      registryTitle: "Remi & Max's Baby Registry",
      buyerName: "Auntie Glinda",
      itemTitle: "Glass Baby Bottles, 4 Pack",
      itemImageUrl: "/hero/bottle.svg",
      itemPrice: 34.99,
      quantity: 2,
      message: "Can't wait to meet the little one!",
      dashboardLink: "https://regibee.com/dashboard/registry/abc?highlight=123",
    }),
  },
};

// The first gift from a store registry adds a note about its welcome box.
export const OwnerItemGivenWelcomeBox: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: '🎁 Auntie Glinda bought "Solly Baby Wrap"',
    to: "max@example.com",
    html: itemGivenOwnerHtml({
      ownerName: "Max",
      registryTitle: "Remi & Max's Baby Registry",
      buyerName: "Auntie Glinda",
      itemTitle: "Solly Baby Wrap",
      quantity: 1,
      dashboardLink: "https://regibee.com/dashboard/registry/abc?highlight=123",
      welcomeBox: {
        storeName: "Amazon",
        boxName: "welcome box",
        perksLink: "https://regibee.com/dashboard/registry/abc?tab=perks",
      },
    }),
  },
};

export const OwnerItemCovered: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: '🎉 Auntie Glinda sent you $25.98 for "Organic Cotton Bibs"',
    to: "max@example.com",
    html: itemCoveredOwnerHtml({
      ownerName: "Max",
      registryTitle: "Remi & Max's Baby Registry",
      buyerName: "Auntie Glinda",
      itemTitle: "Organic Cotton Bibs",
      itemImageUrl: "/hero/bib.svg",
      quantity: 2,
      amount: 25.98,
      message: "Happy to help with the big stuff!",
      dashboardLink: "https://regibee.com/dashboard/registry/abc?highlight=456",
    }),
  },
};

export const OwnerCashFundContribution: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: 'Auntie Glinda contributed $50.00 to "Nursery Furniture Fund"',
    to: "max@example.com",
    html: cashFundContributionOwnerHtml({
      ownerName: "Max",
      registryTitle: "Remi & Max's Baby Registry",
      buyerName: "Auntie Glinda",
      fundTitle: "Nursery Furniture Fund",
      amount: 50,
      message: "For a cozy nursery!",
      dashboardLink: "https://regibee.com/dashboard/registry/abc?highlight=789",
    }),
  },
};

export const OwnerNewSuggestion: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: 'Uncle Oz suggested "Baby Monitor Pro"',
    to: "max@example.com",
    html: newSuggestionOwnerHtml({
      ownerName: "Max",
      registryTitle: "Remi & Max's Baby Registry",
      suggestedByName: "Uncle Oz",
      title: "Baby Monitor Pro",
      price: 129.99,
      notes: "This is the one we used and it's amazing!",
    }),
  },
};

/** The day after a family Christmas, to the owner of a list that hid what was reserved. */
export const OwnerGiftsRevealed: Story = {
  args: {
    subject: "🎁 Your gifts from Christmas at Aunt Linda's are revealed",
    to: "elphaba@example.com",
    html: giftsRevealedOwnerHtml({
      ownerName: "Elphaba",
      registryTitle: "Elphaba's Christmas List",
      eventTitle: "Christmas at Aunt Linda's",
      giftCount: 5,
      listUrl: "https://regibee.com/dashboard/registry/abc?tab=purchases",
    }),
  },
};

// ── Store perks ──────────────────────────────────────────────

export const OwnerCompletionDiscount: Story = {
  args: {
    subject: "Your store completion discounts may be open",
    to: "max@example.com",
    html: completionDiscountOwnerHtml({
      ownerName: "Max",
      registryTitle: "Remi & Max's Baby Registry",
      stores: [
        { name: "Amazon", amount: "10% off, or 15% with Prime" },
        { name: "Babylist", amount: "15% off Babylist Shop items" },
      ],
      perksLink: "https://regibee.com/dashboard/registry/abc?tab=perks",
    }),
  },
};

// ── Invitations ──────────────────────────────────────────────

export const ManagerInvite: Story = {
  args: {
    subject: `Remi & Max invited you to manage "Remi & Max's Baby Registry"`,
    to: "dorothy@example.com",
    html: managerInviteHtml({
      inviterName: "Remi & Max",
      registryTitle: "Remi & Max's Baby Registry",
      inviteUrl: "https://regibee.com/invite/abc123token",
    }),
  },
};

// ── Events ───────────────────────────────────────────────────

const sampleEventEmail = {
  title: "Remi's Baby Shower",
  hostedBy: "Aunt Linda & Grandma Jo",
  date: "Saturday, March 14, 2026",
  time: "2 – 5 PM PDT",
  locationName: "Grandma Jo's garden",
  locationAddress: "1450 Sunnyside Ave\nBerkeley, CA 94703",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=1450%20Sunnyside%20Ave",
  // Storybook serves public/, so the sample picture loads in the preview.
  imageUrl: "/samples/invitation.svg",
  rsvpBy: "Saturday, March 7, 2026",
  registry: { title: "Remi & Max's Baby Registry", url: "https://regibee.com/r/remi-and-max-baby" },
};

// The same shower, linking two registries, with a gift note and a gift
// exchange. The invitation and the guest's confirmation use it, so they show
// every gift line.
const sampleEventEmailWithGifts = {
  ...sampleEventEmail,
  registry: null,
  registries: sampleLinkedRegistries.map((r) => ({ title: r.title, url: `https://regibee.com/r/${r.slug}` })),
  giftNote: "Gifts are optional. If you'd like to bring something, here's what Remi & Max still need.",
  exchange: { budget: "$15", drawBy: "Saturday, March 7, 2026", mailed: false },
};

export const EventInvitation: Story = {
  args: {
    subject: "You're invited: Remi's Baby Shower",
    from: '"Aunt Linda & Grandma Jo via Regibee" <notifications@regibee.com>',
    html: eventInvitationHtml({
      guestName: "Glinda",
      hostName: "Aunt Linda & Grandma Jo",
      event: sampleEventEmailWithGifts,
      message:
        "Join us for tea, cake and games as we celebrate Remi and the baby on the way! Bring a favorite children's book instead of a card.",
      rsvpUrl: "https://regibee.com/e/remis-baby-shower-k3m9q2xa?g=Qm9vayBmb3IgYSBiYWJ5",
    }),
  },
};

// The reminder to guests who haven't replied.
export const EventInvitationReminder: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "Reminder: will you be at Remi's Baby Shower?",
    from: '"Aunt Linda & Grandma Jo via Regibee" <notifications@regibee.com>',
    html: eventInvitationHtml({
      guestName: "Glinda",
      hostName: "Aunt Linda & Grandma Jo",
      event: sampleEventEmailWithGifts,
      rsvpUrl: "https://regibee.com/e/remis-baby-shower-k3m9q2xa?g=Qm9vayBmb3IgYSBiYWJ5",
      reminder: true,
    }),
  },
};

export const RsvpGuestConfirmation: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "You're going to Remi's Baby Shower",
    html: rsvpGuestConfirmationHtml({
      guestName: "Glinda",
      status: "yes",
      partySize: 2,
      event: sampleEventEmailWithGifts,
      rsvpUrl: "https://regibee.com/e/remis-baby-shower-k3m9q2xa?g=Qm9vayBmb3IgYSBiYWJ5",
      calendarUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE",
      inExchange: true,
    }),
  },
};

// A family Christmas where everyone gives everyone. The host linked their own
// list, but the email leaves it out: everyone's lists are on the invitation.
const sampleChristmasEmail = {
  title: "Christmas at Aunt Linda's",
  hostedBy: "Aunt Linda",
  date: "Friday, December 25, 2026",
  time: "2 – 8 PM PST",
  locationName: "Aunt Linda's",
  locationAddress: "88 Evergreen Ln\nPortland, OR 97201",
  registries: [{ title: "Linda's Christmas List", url: "https://regibee.com/r/lindas-christmas-list-q2w8" }],
  exchange: { kind: "everyone" as const, budget: "$30", mailed: false },
};

export const ChristmasInvitation: Story = {
  args: {
    subject: "You're invited: Christmas at Aunt Linda's",
    from: '"Aunt Linda via Regibee" <notifications@regibee.com>',
    html: eventInvitationHtml({
      guestName: "Glinda",
      hostName: "Aunt Linda",
      event: sampleChristmasEmail,
      rsvpUrl: "https://regibee.com/e/christmas-at-aunt-lindas-k3m9q2xa?g=Q2hyaXN0bWFzIGxpbms",
    }),
  },
};

// A guest who said yes without a wishlist yet is asked to add one.
export const ChristmasRsvpWithoutWishlist: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "You're going to Christmas at Aunt Linda's",
    html: rsvpGuestConfirmationHtml({
      guestName: "Glinda",
      status: "yes",
      partySize: 2,
      event: sampleChristmasEmail,
      rsvpUrl: "https://regibee.com/e/christmas-at-aunt-lindas-k3m9q2xa?g=Q2hyaXN0bWFzIGxpbms",
      calendarUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE",
      inExchange: true,
      hasWishlist: false,
    }),
  },
};

export const RsvpHostNotification: Story = {
  args: {
    subject: "Glinda Upland is going to Remi's Baby Shower",
    to: "linda@example.com",
    html: rsvpHostNotificationHtml({
      hostName: "Linda",
      guestName: "Glinda Upland",
      status: "yes",
      partySize: 2,
      note: "Wouldn't miss it! Bringing Goodnight Moon.",
      eventTitle: "Remi's Baby Shower",
      attending: 14,
      pending: 6,
      manageUrl: "https://regibee.com/dashboard/events/abc",
    }),
  },
};

// A guest who can't come leaves out the event's details.
export const RsvpGuestDeclined: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "You can't make it to Remi's Baby Shower",
    html: rsvpGuestConfirmationHtml({
      guestName: "Glinda",
      status: "no",
      partySize: 1,
      event: sampleEventEmailWithGifts,
      rsvpUrl: "https://regibee.com/e/remis-baby-shower-k3m9q2xa?g=Qm9vayBmb3IgYSBiYWJ5",
    }),
  },
};

// A guest who wasn't on the list added themselves from the event link.
export const RsvpHostNotificationNewGuest: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "Boq might come to Remi's Baby Shower",
    to: "linda@example.com",
    html: rsvpHostNotificationHtml({
      hostName: "Linda",
      guestName: "Boq",
      status: "maybe",
      partySize: 1,
      eventTitle: "Remi's Baby Shower",
      attending: 14,
      pending: 6,
      manageUrl: "https://regibee.com/dashboard/events/abc",
      newGuest: true,
    }),
  },
};

// Sent to a registry's owners when someone who doesn't manage it links it to
// their event.
// ── Sign-up sheets and RSVP questions ────────────────────────

const samplePotluckEmail = {
  title: "Friendsgiving Potluck",
  hostedBy: "Glinda & Elphaba",
  date: "Saturday, November 21, 2026",
  time: "4 – 9 PM PST",
  locationName: "The Emerald Apartment",
  locationAddress: "12 Yellow Brick Rd, Apt 3\nSan Francisco, CA 94110",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=12%20Yellow%20Brick%20Rd",
  signup: { title: "Bring a dish", mealTrain: false },
};

// A potluck: what the guest signed up to bring, and their answers to the host's questions.
export const RsvpGuestConfirmationWithSignups: Story = {
  args: {
    subject: "You're going to Friendsgiving Potluck",
    html: rsvpGuestConfirmationHtml({
      guestName: "Fiyero",
      status: "yes",
      partySize: 2,
      event: samplePotluckEmail,
      rsvpUrl: "https://regibee.com/e/friendsgiving-potluck-r7t2m9wq?g=Rml5ZXJvcyBsaW5r",
      calendarUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE",
      signups: ["Side (Mac and cheese)", "Drinks (Sparkling cider)"],
      answers: [{ label: "Allergies or dietary needs", value: "Galinda is vegetarian" }],
    }),
  },
};

// A meal train's invitation leaves the address out: guests get it once they sign up.
export const MealTrainInvitation: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "You're invited: Meals for Remi & Max",
    from: '"Aunt Linda via Regibee" <notifications@regibee.com>',
    html: eventInvitationHtml({
      guestName: "Glinda",
      hostName: "Aunt Linda",
      event: { title: "Meals for Remi & Max", hostedBy: "Aunt Linda", signup: { title: "Meals", mealTrain: true } },
      message: "Remi and Max are home with the baby! Drop off between 5 and 6. They're vegetarian.",
      rsvpUrl: "https://regibee.com/e/meals-for-remi-and-max-c5h8k2pz?g=R2xpbmRhcyBsaW5r",
    }),
  },
};

// "Message everyone going", written by the host.
export const GuestMessage: Story = {
  args: {
    subject: "About Remi's Baby Shower",
    from: '"Aunt Linda & Grandma Jo via Regibee" <notifications@regibee.com>',
    html: guestMessageHtml({
      guestName: "Glinda",
      hostName: "Aunt Linda & Grandma Jo",
      eventTitle: "Remi's Baby Shower",
      body: "Parking on Sunnyside fills up fast. There's more on Ward St, a block over.\n\nSee you Saturday!",
      rsvpUrl: "https://regibee.com/e/remis-baby-shower-k3m9q2xa?g=Qm9vayBmb3IgYSBiYWJ5",
    }),
  },
};

// Sent when the host changes the date, time or place.
export const EventChanged: Story = {
  args: {
    subject: "New time and place: Remi's Baby Shower",
    from: '"Aunt Linda & Grandma Jo via Regibee" <notifications@regibee.com>',
    html: eventChangedHtml({
      guestName: "Glinda",
      hostName: "Aunt Linda & Grandma Jo",
      event: { ...sampleEventEmail, time: "3 – 6 PM PDT", locationName: "Linda's house", locationAddress: "88 Hillcrest Rd\nOakland, CA 94618" },
      changes: [
        { label: "Time", before: "2 – 5 PM PDT", after: "3 – 6 PM PDT" },
        { label: "Place", before: "Grandma Jo's garden, 1450 Sunnyside Ave, Berkeley, CA 94703", after: "Linda's house, 88 Hillcrest Rd\nOakland, CA 94618" },
      ],
      rsvpUrl: "https://regibee.com/e/remis-baby-shower-k3m9q2xa?g=Qm9vayBmb3IgYSBiYWJ5",
      calendarUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE",
    }),
  },
};

// The day before, to everyone going, with what they signed up to bring.
export const DayBeforeReminder: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "Tomorrow: Friendsgiving Potluck",
    from: '"Glinda & Elphaba via Regibee" <notifications@regibee.com>',
    html: dayBeforeReminderHtml({
      guestName: "Fiyero",
      hostName: "Glinda & Elphaba",
      event: samplePotluckEmail,
      rsvpUrl: "https://regibee.com/e/friendsgiving-potluck-r7t2m9wq?g=Rml5ZXJvcyBsaW5r",
      calendarUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE",
      signups: ["Side (Mac and cheese)"],
    }),
  },
};

export const RegistryLinked: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "Linda Upland linked your registry to Remi's Baby Shower",
    to: "max@example.com",
    html: registryLinkedHtml({
      ownerName: "Max",
      linkedByName: "Linda Upland",
      registryTitle: "Baby Remi's Bookshelf",
      eventTitle: "Remi's Baby Shower",
      eventDate: "Saturday, March 14, 2026",
      eventUrl: "https://regibee.com/e/remis-baby-shower-k3m9q2xa",
      registryDashboardUrl: "https://regibee.com/dashboard/registry/abc",
    }),
  },
};

export const CoHostInvite: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "Linda Upland asked you to co-host Remi's Baby Shower",
    to: "jo@example.com",
    html: coHostInviteHtml({
      inviterName: "Linda Upland",
      eventTitle: "Remi's Baby Shower",
      inviteUrl: "https://regibee.com/host-invite/abc123token",
    }),
  },
};

// Sent to the person a shower is for when the host chose "Ask them to make
// one" in the "What are you planning?" picker.
export const ListRequest: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "Linda Upland asked you to make a baby registry for Remi's Baby Shower",
    from: '"Linda Upland via Regibee" <notifications@regibee.com>',
    to: "remi@example.com",
    html: listRequestHtml({
      honoreeName: "Remi",
      hostName: "Linda Upland",
      eventTitle: "Remi's Baby Shower",
      eventDate: "Saturday, December 5, 2026",
      listNoun: "baby registry",
      requestUrl: "https://regibee.com/list-request/abc123token",
    }),
  },
};

// Sent to each person in a gift exchange when the host draws names. This one
// has a Regibee wishlist and gift ideas. A mailed exchange adds the address.
export const ExchangeAssignment: Story = {
  args: {
    subject: "Your Secret Santa name for Holiday Gift Swap",
    from: '"Aunt Linda via Regibee" <notifications@regibee.com>',
    to: "boq@example.com",
    html: exchangeAssignmentHtml({
      giverName: "Boq",
      gifteeName: "Elphaba",
      eventTitle: "Holiday Gift Swap",
      hostName: "Aunt Linda",
      budget: "$25",
      eventDate: "Saturday, December 19, 2026",
      mailed: false,
      wishlist: { url: "https://regibee.com/r/elphabas-wishlist-3k9d", title: "Elphaba's Wishlist" },
      giftIdeas: "Books about animals, green tea, a sturdy umbrella",
      pageUrl: "https://regibee.com/e/holiday-gift-swap-p4w8n2rt?g=token-g5",
    }),
  },
};

// Names drawn a second time: this replaces the first email.
export const ExchangeAssignmentRedraw: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "New Secret Santa name for Holiday Gift Swap",
    from: '"Aunt Linda via Regibee" <notifications@regibee.com>',
    to: "boq@example.com",
    html: exchangeAssignmentHtml({
      giverName: "Boq",
      gifteeName: "Nessa",
      eventTitle: "Holiday Gift Swap",
      hostName: "Aunt Linda",
      budget: "$25",
      eventDate: "Saturday, December 19, 2026",
      mailed: true,
      shippingAddress: "12 Munchkin Lane\nEmerald City, OZ 10001",
      pageUrl: "https://regibee.com/e/holiday-gift-swap-p4w8n2rt?g=token-g5",
      redraw: true,
    }),
  },
};

// ── Account emails ───────────────────────────────────────────

// Supabase sends these itself, from the files `npm run auth-emails` writes.
// The link is a sample of the one Supabase puts in.
const sampleAuthLink =
  "https://example.supabase.co/auth/v1/verify?token=pkce_0a1b2c3d4e5f&type=signup&redirect_to=https://regibee.com/auth/callback";

export const AuthConfirmSignup: Story = {
  args: {
    subject: AUTH_EMAILS.confirmation.subject,
    to: "max@example.com",
    html: AUTH_EMAILS.confirmation.html(sampleAuthLink),
  },
};

export const AuthResetPassword: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: AUTH_EMAILS.recovery.subject,
    to: "max@example.com",
    html: AUTH_EMAILS.recovery.html(sampleAuthLink.replace("type=signup", "type=recovery")),
  },
};

// ── Follows ──────────────────────────────────────────────────

export const FollowRequest: Story = {
  args: {
    subject: "Grandma Dorothy wants to follow you on Regibee",
    to: "max@example.com",
    html: followRequestHtml({
      followerName: "Grandma Dorothy",
      profileUrl: "https://regibee.com/u/grandma-dorothy-r4d8w2nb6h",
      reviewUrl: "https://regibee.com/dashboard/account#follow-requests",
      settingsUrl: "https://regibee.com/dashboard/account#profile",
    }),
  },
};

export const FollowInvite: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "Grandma Dorothy wants to follow you on Regibee",
    html: followInviteHtml({
      inviterName: "Grandma Dorothy",
      inviteUrl: "https://regibee.com/follow-invite/abc123",
    }),
  },
};

// ── Birthdays ────────────────────────────────────────────────

const sampleBirthdays = [
  {
    name: "Glinda Upland",
    date: "2026-03-03",
    linkUrl: "https://regibee.com/r/glindas-wishlist-7k2m",
    linkTo: "list" as const,
  },
  {
    name: "Toto",
    date: "2026-03-03",
    parentName: "Dorothy Gale",
    linkUrl: "https://regibee.com/r/totos-wishlist-4n8p",
    linkTo: "list" as const,
  },
];

// Ten days before a followed person's birthday.
export const BirthdayReminder: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: birthdayReminderSubject(sampleBirthdays.slice(0, 1), 10),
    to: "max@example.com",
    html: birthdayReminderHtml({
      toName: "Max",
      days: 10,
      birthdays: sampleBirthdays.slice(0, 1),
      settingsUrl: "https://regibee.com/dashboard/account#birthday-emails",
    }),
  },
};

// Two birthdays on the same day go in one email, as a list.
export const BirthdayReminderSeveral: Story = {
  args: {
    subject: birthdayReminderSubject(sampleBirthdays, 10),
    to: "max@example.com",
    html: birthdayReminderHtml({
      toName: "Max",
      days: 10,
      birthdays: sampleBirthdays,
      settingsUrl: "https://regibee.com/dashboard/account#birthday-emails",
    }),
  },
};

// ── Added after the email audit ──────────────────────────────

// To invited guests who haven't said no, when the host deletes the event.
export const EventCancelled: Story = {
  args: {
    subject: "Cancelled: Remi's Baby Shower",
    from: '"Aunt Linda & Grandma Jo via Regibee" <notifications@regibee.com>',
    html: eventCancelledHtml({
      guestName: "Glinda",
      hostName: "Aunt Linda & Grandma Jo",
      eventTitle: "Remi's Baby Shower",
      date: "Saturday, March 14, 2026",
    }),
  },
};

// To a guest who said they bought an item the owners then deleted.
export const BuyerGiftRemoved: Story = {
  args: {
    subject: '"Glass Baby Bottles, 4 Pack" was taken off Remi & Max\'s Baby Registry',
    html: giftRemovedBuyerHtml({
      buyerName: "Glinda",
      itemTitle: "Glass Baby Bottles, 4 Pack",
      parentName: "Remi & Max",
      registryTitle: "Remi & Max's Baby Registry",
      bought: true,
      listUrl: "https://regibee.com/r/remi-and-max-baby",
    }),
  },
};

// The same, for a guest who had only reserved it.
export const BuyerReservationRemoved: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: '"Glass Baby Bottles, 4 Pack" was taken off Remi & Max\'s Baby Registry',
    html: giftRemovedBuyerHtml({
      buyerName: "Glinda",
      itemTitle: "Glass Baby Bottles, 4 Pack",
      parentName: "Remi & Max",
      registryTitle: "Remi & Max's Baby Registry",
      bought: false,
      listUrl: "https://regibee.com/r/remi-and-max-baby",
    }),
  },
};

// Once, right after a new account confirms its address.
export const Welcome: Story = {
  args: {
    subject: "Welcome to Regibee",
    html: welcomeHtml({
      name: "Glinda",
      newListUrl: "https://regibee.com/dashboard/new",
      eventsUrl: "https://regibee.com/dashboard/events",
    }),
  },
};

// To the person who asked to follow, once it's approved.
export const FollowApproved: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "Glinda Upland approved your follow request",
    to: "dorothy@example.com",
    html: followApprovedHtml({ followeeName: "Glinda Upland", profileUrl: "https://regibee.com/u/glinda" }),
  },
};

const digestGifts = [
  {
    shownName: "Auntie Glinda",
    title: "Glass Baby Bottles, 4 Pack",
    kind: "given" as const,
    quantity: 2,
    amount: null,
    message: "Can't wait to meet the little one!",
    imageUrl: "/hero/bottle.svg",
  },
  {
    shownName: "Uncle Oz",
    title: "Organic Cotton Bibs",
    kind: "given" as const,
    quantity: 1,
    amount: null,
    message: null,
    imageUrl: "/hero/bib.svg",
  },
  {
    shownName: "Secret Santa",
    title: "Nursery Furniture Fund",
    kind: "fund" as const,
    quantity: 1,
    amount: 50,
    message: null,
    imageUrl: null,
  },
];

// Once a day, to a manager who chose one summary instead of an email per gift.
export const OwnerGiftDigest: Story = {
  args: {
    subject: "3 new gifts on Remi & Max's Baby Registry",
    html: giftDigestHtml({
      lists: [
        {
          title: "Remi & Max's Baby Registry",
          url: "https://regibee.com/dashboard/registry/abc?tab=purchases",
          gifts: digestGifts,
        },
      ],
      settingsUrl: "https://regibee.com/dashboard/account#gift-emails",
    }),
  },
};

// A few days after a list's date: who gave what, to thank them.
export const OwnerThanksReminder: Story = {
  args: {
    subject: "Say thanks for your gifts from Remi & Max's Baby Registry",
    html: thanksReminderHtml({
      registryTitle: "Remi & Max's Baby Registry",
      gifts: digestGifts,
      listUrl: "https://regibee.com/dashboard/registry/abc?tab=purchases",
      settingsUrl: "https://regibee.com/dashboard/account#gift-emails",
    }),
  },
};

// A Secret Santa's reminder before the event, with their person's wishlist.
export const ExchangeReminder: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: "Reminder: your Secret Santa gift for Holiday Gift Swap",
    from: '"Aunt Linda via Regibee" <notifications@regibee.com>',
    to: "boq@example.com",
    html: exchangeAssignmentHtml({
      giverName: "Boq",
      gifteeName: "Elphaba",
      eventTitle: "Holiday Gift Swap",
      hostName: "Aunt Linda",
      budget: "$25",
      eventDate: "Saturday, December 19, 2026",
      mailed: false,
      wishlist: { url: "https://regibee.com/r/elphabas-wishlist-3k9d", title: "Elphaba's Wishlist" },
      pageUrl: "https://regibee.com/e/holiday-gift-swap-p4w8n2rt?g=token-g5",
      reason: "reminder",
      daysLeft: 3,
    }),
  },
};

// A Secret Santa's person added their first wishlist after the draw.
export const ExchangeWishlistAdded: Story = {
  args: {
    subject: "Elphaba added a wishlist for Holiday Gift Swap",
    from: '"Aunt Linda via Regibee" <notifications@regibee.com>',
    to: "boq@example.com",
    html: exchangeAssignmentHtml({
      giverName: "Boq",
      gifteeName: "Elphaba",
      eventTitle: "Holiday Gift Swap",
      hostName: "Aunt Linda",
      budget: "$25",
      eventDate: "Saturday, December 19, 2026",
      mailed: false,
      wishlist: { url: "https://regibee.com/r/elphabas-wishlist-3k9d", title: "Elphaba's Wishlist" },
      pageUrl: "https://regibee.com/e/holiday-gift-swap-p4w8n2rt?g=token-g5",
      reason: "wishlist",
    }),
  },
};

// Supabase sends this after a password changes.
export const AuthPasswordChanged: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    subject: AUTH_NOTIFICATIONS.password_changed.subject,
    html: AUTH_NOTIFICATIONS.password_changed.html(),
  },
};

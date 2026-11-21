// Every occasion Regibee knows, in one list: its name, its color, what a new
// event of that kind starts with, and the kind of gift list that goes with it.
// Events (src/lib/events.ts), registry copy (src/lib/registry-copy.ts), colors
// (src/lib/occasion-theme.ts) and the "What are you planning?" picker
// (src/components/plan-picker.tsx) all read it, so a new occasion is added here
// once.
//
// The database still stores two fields. events.event_type takes an occasion's
// id. A registry keeps registry_type ("baby" or "personal") plus one of six
// event_type values; `list` below says which pair an occasion's list gets.
//
// This file has no imports, so the browser, the server, tests and the mobile
// app can all use it.

/** The colors on the brand palette that occasions use (see occasion-theme.ts). */
export type OccasionTint = "blush" | "sunshine" | "mint" | "teal";

/** The six occasions a registry can store, besides "baby". */
export const LIST_OCCASIONS = ["birthday", "christmas", "wedding", "housewarming", "graduation", "other"] as const;
export type ListOccasion = (typeof LIST_OCCASIONS)[number];

/** Who an occasion is for, as the picker asks it. */
export type Audience = "me" | "us" | "child" | "someone" | "everyone" | "no_one";

export const AUDIENCE_LABELS: Record<Audience, string> = {
  me: "Me",
  us: "Us",
  child: "My child",
  someone: "Someone else",
  everyone: "Everyone taking part",
  no_one: "No one in particular",
};

export interface Occasion {
  /** The value stored in events.event_type. */
  id: string;
  label: string;
  tint: OccasionTint;
  /** The event form's title placeholder. */
  titlePlaceholder: string;
  /** A title for a person or people, like "Remi's Baby Shower". */
  titleFor: (name: string) => string;
  /** The kind of gift list that goes with it. */
  list: { registryType: "baby" | "personal"; eventType: ListOccasion | null; noun: string };
  /** Who it's usually for, first one first. The picker offers these. */
  audiences: Audience[];
  /**
   * What a new event of this kind starts with. The host can change all of it.
   * `exchange` starts the guests giving each other gifts: "draw" draws names
   * (a Secret Santa), and "everyone" has each guest link their own wish list
   * when they RSVP (src/lib/events.ts, ExchangeKind).
   * `signup` starts a sign-up sheet from that preset (src/lib/signups.ts).
   * `questions` are what the RSVP asks besides how many are coming
   * (src/lib/rsvp-questions.ts).
   */
  defaults?: {
    giftNote?: string;
    askKids?: boolean;
    exchange?: "draw" | "everyone";
    signup?: "potluck" | "meal_train";
    questions?: ("meal" | "diet" | "plus_ones")[];
  };
}

function possessive(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

/** "Remi's Baby Shower", or "Baby Shower" with no name. */
function named(name: string, what: string): string {
  const owner = possessive(name);
  return owner ? `${owner} ${what}` : what;
}

const BABY_LIST = { registryType: "baby", eventType: null, noun: "baby registry" } as const;
const WEDDING_LIST = { registryType: "personal", eventType: "wedding", noun: "wedding registry" } as const;
const BIRTHDAY_LIST = { registryType: "personal", eventType: "birthday", noun: "birthday wishlist" } as const;
const CHRISTMAS_LIST = { registryType: "personal", eventType: "christmas", noun: "Christmas list" } as const;
const WISHLIST = { registryType: "personal", eventType: "other", noun: "wishlist" } as const;

// The order is the order on the event form and the picker: the most common
// first, then the rest roughly by family.
export const OCCASIONS = [
  {
    id: "baby_shower",
    label: "Baby shower",
    tint: "blush",
    titlePlaceholder: "Remi's Baby Shower",
    titleFor: (name) => named(name, "Baby Shower"),
    list: BABY_LIST,
    audiences: ["someone", "us", "me"],
  },
  {
    id: "birthday",
    label: "Birthday",
    tint: "sunshine",
    titlePlaceholder: "Max Turns 30",
    titleFor: (name) => named(name, "Birthday"),
    list: BIRTHDAY_LIST,
    audiences: ["me", "someone", "us"],
  },
  {
    id: "kids_birthday",
    label: "Kid's birthday",
    tint: "sunshine",
    titlePlaceholder: "Jordan's 6th Birthday",
    titleFor: (name) => named(name, "Birthday Party"),
    list: BIRTHDAY_LIST,
    audiences: ["child", "someone"],
    defaults: { askKids: true, questions: ["diet"] },
  },
  {
    id: "gift_exchange",
    label: "Gift exchange",
    tint: "mint",
    titlePlaceholder: "Chen Family Secret Santa",
    titleFor: (name) => (name.trim() ? `${name.trim()} Secret Santa` : "Secret Santa"),
    list: CHRISTMAS_LIST,
    audiences: ["everyone"],
    defaults: { exchange: "draw" },
  },
  {
    id: "christmas",
    label: "Christmas",
    tint: "mint",
    titlePlaceholder: "The Chens' Christmas Party",
    titleFor: (name) => named(name, "Christmas"),
    list: CHRISTMAS_LIST,
    // A family Christmas where everyone gives everyone comes first: it's
    // the event most families plan on Regibee once a year. Each guest links
    // their own wish list.
    audiences: ["everyone", "no_one", "me", "us", "child"],
    defaults: { exchange: "everyone" },
  },
  {
    // A party for the winter holidays, whatever each family celebrates. Like a
    // family Christmas, everyone gives everyone from their own wish lists. A
    // party for no one in particular, like a work one, can draw names instead.
    id: "holiday_party",
    label: "Holiday party",
    tint: "mint",
    titlePlaceholder: "The Chens' Holiday Party",
    titleFor: (name) => named(name, "Holiday Party"),
    list: WISHLIST,
    audiences: ["everyone", "no_one"],
    defaults: { exchange: "everyone" },
  },
  {
    id: "bridal_shower",
    label: "Bridal shower",
    tint: "blush",
    titlePlaceholder: "Sam's Bridal Shower",
    titleFor: (name) => named(name, "Bridal Shower"),
    list: WEDDING_LIST,
    audiences: ["someone", "me"],
  },
  {
    id: "wedding",
    label: "Wedding",
    tint: "teal",
    titlePlaceholder: "Alex & Sam's Wedding",
    titleFor: (name) => named(name, "Wedding"),
    list: WEDDING_LIST,
    audiences: ["us", "someone"],
    defaults: { questions: ["plus_ones", "meal", "diet"] },
  },
  {
    id: "engagement",
    label: "Engagement party",
    tint: "teal",
    titlePlaceholder: "Alex & Sam Are Engaged!",
    titleFor: (name) => (name.trim() ? `${name.trim()} Are Engaged!` : "Engagement Party"),
    list: WEDDING_LIST,
    audiences: ["us", "someone"],
  },
  {
    id: "bachelor",
    label: "Bachelor or bachelorette",
    tint: "teal",
    titlePlaceholder: "Sam's Last Weekend Out",
    titleFor: (name) => named(name, "Last Weekend Out"),
    list: WISHLIST,
    audiences: ["someone", "me"],
  },
  {
    id: "sip_and_see",
    label: "Sip and see",
    tint: "blush",
    titlePlaceholder: "Come Meet Baby Remi",
    titleFor: (name) => (name.trim() ? `Come Meet ${name.trim()}` : "Sip and See"),
    list: BABY_LIST,
    audiences: ["us", "me", "someone"],
  },
  {
    id: "housewarming",
    label: "Housewarming",
    tint: "teal",
    titlePlaceholder: "Come See Our New Place",
    titleFor: (name) => named(name, "Housewarming"),
    list: { registryType: "personal", eventType: "housewarming", noun: "housewarming registry" },
    audiences: ["us", "me", "someone"],
  },
  {
    id: "graduation",
    label: "Graduation",
    tint: "teal",
    titlePlaceholder: "Jordan's Graduation Party",
    titleFor: (name) => named(name, "Graduation Party"),
    list: { registryType: "personal", eventType: "graduation", noun: "graduation registry" },
    audiences: ["someone", "child", "me"],
  },
  {
    id: "retirement",
    label: "Retirement",
    tint: "teal",
    titlePlaceholder: "Linda's Retirement Lunch",
    titleFor: (name) => named(name, "Retirement Lunch"),
    list: WISHLIST,
    audiences: ["someone", "me"],
  },
  {
    id: "holiday",
    label: "Other holiday",
    tint: "mint",
    titlePlaceholder: "Lunar New Year Dinner",
    titleFor: (name) => named(name, "Holiday Dinner"),
    list: WISHLIST,
    audiences: ["no_one", "me", "us", "child"],
  },
  {
    id: "potluck",
    label: "Potluck",
    tint: "sunshine",
    titlePlaceholder: "Friendsgiving Potluck",
    titleFor: (name) => named(name, "Potluck"),
    list: WISHLIST,
    audiences: ["no_one"],
    defaults: { signup: "potluck", questions: ["diet"] },
  },
  {
    id: "meal_train",
    label: "Meal train",
    tint: "teal",
    titlePlaceholder: "Meals for the Parks",
    titleFor: (name) => (name.trim() ? `Meals for ${name.trim()}` : "Meal Train"),
    list: WISHLIST,
    audiences: ["someone", "us", "me"],
    defaults: { signup: "meal_train" },
  },
  {
    id: "gathering",
    label: "Get-together",
    tint: "teal",
    titlePlaceholder: "Game Night",
    titleFor: () => "Get-Together",
    list: WISHLIST,
    audiences: ["no_one"],
    defaults: { questions: ["diet"] },
  },
  {
    id: "other",
    label: "Something else",
    tint: "teal",
    titlePlaceholder: "Summer Get-Together",
    titleFor: (name) => named(name, "Celebration"),
    list: WISHLIST,
    audiences: ["someone", "me", "us", "child", "no_one"],
  },
] as const satisfies readonly Occasion[];

export type OccasionId = (typeof OCCASIONS)[number]["id"];

/** Every occasion id, in order. events.event_type takes one of these. */
export const OCCASION_IDS = OCCASIONS.map((o) => o.id) as OccasionId[];

export function isOccasionId(value: unknown): value is OccasionId {
  return typeof value === "string" && OCCASIONS.some((o) => o.id === value);
}

export function occasionFor(id: OccasionId): Occasion {
  return (OCCASIONS as readonly Occasion[]).find((o) => o.id === id) ?? OCCASIONS[OCCASIONS.length - 1];
}

// ── Registries ───────────────────────────────────────────────

const LIST_LABELS: Record<ListOccasion, string> = {
  birthday: "Birthday",
  christmas: "Christmas",
  wedding: "Wedding",
  housewarming: "Housewarming",
  graduation: "Graduation",
  other: "Other",
};

/** The choices on the registry form's occasion menu. */
export const LIST_OCCASION_OPTIONS = LIST_OCCASIONS.map((value) => ({ value, label: LIST_LABELS[value] }));

/** The color of a registry, from its type and occasion. */
export function listTint(registryType: "baby" | "personal", eventType: ListOccasion | null): OccasionTint {
  if (registryType === "baby") return "blush";
  if (eventType === "birthday") return "sunshine";
  if (eventType === "christmas") return "mint";
  return "teal";
}

/** A gift list's title for a person or people, like "Remi's Baby Registry". */
export function listTitleFor(occasion: Occasion, name: string): string {
  const noun = occasion.list.noun.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return named(name, noun);
}

// ── The picker ───────────────────────────────────────────────

/**
 * How gifts work, as the picker asks it.
 * - new_list: make a gift list now, owned by whoever is making the plan.
 * - link: link a list that already exists, by its share link.
 * - ask: email the honoree an invitation to make a list, linked once it exists.
 * - everyone: everyone gives everyone. Each guest links a wish list when they RSVP.
 * - exchange: draw names (a Secret Santa).
 * - signup: a sign-up sheet, for things to bring or days to help (src/lib/signups.ts).
 * - no_gifts: a "No gifts, please" note.
 * - later: nothing about gifts yet. The picker's Skip button sends this, so
 *   every occasion allows it.
 */
export type GiftPlan = "new_list" | "link" | "ask" | "everyone" | "exchange" | "signup" | "no_gifts" | "later";

export const GIFT_PLAN_LABELS: Record<GiftPlan, { label: string; hint: string }> = {
  new_list: { label: "Make a gift list", hint: "Add things from any store, and guests reserve them." },
  link: { label: "Link a list", hint: "Paste the share link of a Regibee registry or wishlist." },
  ask: { label: "Ask them to make one", hint: "We email them an invitation, and their list is linked as soon as it exists." },
  everyone: {
    label: "Everyone gives everyone",
    hint: "Each person links a wish list when they RSVP, and everyone shops from everyone's lists.",
  },
  exchange: { label: "Draw names", hint: "Everyone adds a wishlist when they join, then gives one gift to the person they draw." },
  signup: { label: "A sign-up sheet", hint: "Guests pick what they'll bring, or a day to help." },
  no_gifts: { label: "No gifts", hint: "The invitation says \"No gifts, please.\"" },
  later: { label: "Decide later", hint: "Add a list or a gift note any time from the event." },
};

/**
 * What the picker calls a plan, for who it's for. `hasLists` is whether the
 * person making the plan already has lists of their own to pick from.
 */
export function giftPlanLabel(
  plan: GiftPlan,
  audience: Audience,
  occasion: Pick<Occasion, "list">,
  hasLists = false,
): { label: string; hint: string } {
  if (plan === "new_list") {
    return { label: `Make ${audience === "child" ? "their" : "your"} ${occasion.list.noun}`, hint: GIFT_PLAN_LABELS.new_list.hint };
  }
  if (plan === "link") {
    if (audience === "someone") {
      return { label: "Link their list", hint: "Paste the share link of their Regibee registry or wishlist." };
    }
    if (audience === "no_one") {
      return {
        label: "Link a wishlist",
        hint: hasLists
          ? "Yours, your kids', or anyone's by its link. Add more from the event later."
          : "Paste the share link of any Regibee registry or wishlist. Add more from the event later.",
      };
    }
    if (hasLists) return { label: "Use a list you already have", hint: "One of your lists, or any Regibee list by its link." };
  }
  return GIFT_PLAN_LABELS[plan];
}

/** The plans where guests shop from a gift list, or add their own wishlist. */
const LIST_PLANS: readonly GiftPlan[] = ["new_list", "link", "ask", "everyone", "exchange"];

/**
 * The gift plans that make sense for who it's for, the usual one first. Every
 * occasion that has gifts offers a gift list. An occasion that starts with a
 * sign-up sheet (a potluck, a meal train) puts that first. A party for no one
 * in particular can have one too.
 */
export function giftPlansFor(audience: Audience, occasion?: Pick<Occasion, "defaults"> | null): GiftPlan[] {
  const plans = ((): GiftPlan[] => {
    switch (audience) {
      case "me":
      case "us":
      case "child":
        return ["new_list", "link", "no_gifts", "later"];
      case "someone":
        return ["link", "ask", "no_gifts", "later"];
      case "everyone":
        return ["everyone", "exchange", "later"];
      case "no_one":
        return ["link", "exchange", "signup", "no_gifts", "later"];
    }
  })();
  if (occasion?.defaults?.signup) return ["signup", ...plans.filter((p) => p !== "signup")];
  return plans;
}

/**
 * The picker's two rows of gift plans. `main` holds the gift lists (and the
 * sign-up sheet, for an occasion that starts with one), shown large and
 * first. `other` holds the rest, shown smaller after them. "later" isn't on
 * either row: the step's Skip button picks it.
 */
export function giftPlanRows(
  audience: Audience,
  occasion?: Pick<Occasion, "defaults"> | null,
): { main: GiftPlan[]; other: GiftPlan[] } {
  const plans = giftPlansFor(audience, occasion).filter((plan) => plan !== "later");
  const isMain = (plan: GiftPlan) => LIST_PLANS.includes(plan) || (plan === "signup" && Boolean(occasion?.defaults?.signup));
  return { main: plans.filter(isMain), other: plans.filter((plan) => !isMain(plan)) };
}

/**
 * Whether a plan needs an event. A gift list for yourself can stand alone;
 * everything else hangs on an invitation.
 */
export function planNeedsEvent(gifts: GiftPlan): boolean {
  return gifts !== "new_list";
}

/**
 * The gift plan the picker starts with, already picked, for who it's for.
 * Christmas and a holiday party for everyone taking part start with everyone
 * giving everyone, so each guest links their own wish list. Null when nothing
 * starts picked. The host can pick another plan, or none.
 */
export function startingGiftPlan(audience: Audience, occasion?: Pick<Occasion, "defaults"> | null): GiftPlan | null {
  const exchange = occasion?.defaults?.exchange;
  const plan: GiftPlan | null = exchange === "everyone" ? "everyone" : exchange === "draw" ? "exchange" : null;
  return plan && giftPlansFor(audience, occasion).includes(plan) ? plan : null;
}

/**
 * Whether the event form's "Gifts among the guests" starts on for a new event
 * of this occasion, and which kind it starts on: Christmas and a holiday party
 * start with everyone giving everyone, a gift exchange with drawing names.
 * The kind is what the form shows once the host turns it on, so it's
 * "everyone" for occasions that start off.
 */
export function startingExchange(id: string): { on: boolean; kind: "draw" | "everyone" } {
  const exchange = isOccasionId(id) ? occasionFor(id).defaults?.exchange : undefined;
  return { on: Boolean(exchange), kind: exchange ?? "everyone" };
}

/** The note a "No gifts" plan puts on the invitation. */
export const NO_GIFTS_NOTE = "No gifts, please. Your company is the best present.";

/** What the name field asks, by who it's for. Null when it's not asked. */
export function nameLabelFor(audience: Audience): string | null {
  switch (audience) {
    case "me":
      return "Your name";
    case "us":
      return "Your names";
    case "child":
      return "Your child's name";
    case "someone":
      return "Their name";
    default:
      return null;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from `today` to `eventDate`: 0 on the day, negative once it's
 * passed. Both are YYYY-MM-DD strings, like `event_date`, so the result
 * doesn't depend on the time of day.
 */
export function daysUntil(eventDate: string, today: string): number {
  return Math.round((Date.parse(eventDate) - Date.parse(today)) / DAY_MS);
}

// "12 days to go", "Tomorrow" or "Today". Baby registries count down to the
// due date instead ("Due in 12 days"). Once the date has gone by, it shows
// the date itself with its year, like "Nov 3, 2026": wording like "Due date
// passed" read as harsh.
export function countdownLabel(eventDate: string, today: string, registryType: "baby" | "personal"): string {
  const days = daysUntil(eventDate, today);
  const baby = registryType === "baby";
  if (days < 0) {
    // Built as a local date and formatted without a time zone, so it shows
    // the same calendar day everywhere, the phone app included.
    const [y, m, d] = eventDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  if (days === 0) return baby ? "Due today" : "Today";
  if (days === 1) return baby ? "Due tomorrow" : "Tomorrow";
  return baby ? `Due in ${days} days` : `${days} days to go`;
}

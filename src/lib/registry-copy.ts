// What each kind of registry calls things. The mobile app uses this file too,
// through its @shared/* path, so it imports only src/lib/occasions.ts, which
// has no imports.
import { LIST_OCCASION_OPTIONS, type ListOccasion } from "./occasions";

type RegistryType = "baby" | "personal";
type PersonalEventType = ListOccasion;
interface Registry {
  registry_type: RegistryType | null;
  event_type: PersonalEventType | null;
  honoree_names: string | null;
  parent_names: string | null;
}

export interface RegistryCopy {
  registryNoun: string;
  registryNounPlural: string;
  eventDateLabel: string;
  honoreeLabel: string;
  honoreePlaceholder: string;
  titlePlaceholder: string;
  selfPurchasedLabel: string;
  selfPurchaseButton: string;
  coverItemFlavor: (honoree: string) => string;
  emailFooterLine: string;
  checklistAvailable: boolean;
}

const BABY: RegistryCopy = {
  registryNoun: "baby registry",
  registryNounPlural: "baby registries",
  eventDateLabel: "Due date",
  honoreeLabel: "Parent Names",
  honoreePlaceholder: 'e.g., "Denise & Brian"',
  titlePlaceholder: "The Smith Family Baby Registry",
  selfPurchasedLabel: "Purchased by parent",
  selfPurchaseButton: "Mark as bought by parent",
  coverItemFlavor: (honoree) =>
    `${honoree} found a deal for this one and now it's on its way to baby.`,
  emailFooterLine:
    "You're receiving this because someone interacted with your baby registry.",
  checklistAvailable: true,
};

const PERSONAL_DEFAULTS: RegistryCopy = {
  registryNoun: "registry",
  registryNounPlural: "registries",
  eventDateLabel: "Event date",
  honoreeLabel: "Honoree",
  honoreePlaceholder: 'e.g., "Alex & Sam"',
  titlePlaceholder: "Alex's Wishlist",
  selfPurchasedLabel: "Already bought",
  selfPurchaseButton: "Mark as already bought",
  coverItemFlavor: (honoree) =>
    `${honoree} found a deal for this one and now it's on its way.`,
  emailFooterLine:
    "You're receiving this because someone interacted with your registry.",
  checklistAvailable: false,
};

const PERSONAL_OVERRIDES: Record<PersonalEventType, Partial<RegistryCopy>> = {
  birthday: {
    eventDateLabel: "Birthday",
    honoreeLabel: "Birthday Person",
    honoreePlaceholder: 'e.g., "Alex"',
    titlePlaceholder: "Alex's 30th Birthday",
  },
  christmas: {
    eventDateLabel: "Celebration date",
    honoreeLabel: "Household",
    honoreePlaceholder: 'e.g., "The Chen Family"',
    titlePlaceholder: "The Chen Family Christmas",
  },
  wedding: {
    eventDateLabel: "Wedding date",
    honoreeLabel: "Couple",
    honoreePlaceholder: 'e.g., "Alex & Sam"',
    titlePlaceholder: "Alex & Sam's Wedding Registry",
    registryNoun: "wedding registry",
  },
  housewarming: {
    eventDateLabel: "Housewarming date",
    honoreeLabel: "Household",
    honoreePlaceholder: 'e.g., "Alex & Sam"',
    titlePlaceholder: "Our New Home",
  },
  graduation: {
    eventDateLabel: "Graduation date",
    honoreeLabel: "Graduate",
    honoreePlaceholder: 'e.g., "Alex"',
    titlePlaceholder: "Alex's Graduation",
  },
  other: {},
};

export function copyFor(input: {
  registryType: RegistryType | null | undefined;
  eventType?: PersonalEventType | null;
}): RegistryCopy {
  const type = input.registryType ?? "baby";
  if (type === "baby") return BABY;
  const base = PERSONAL_DEFAULTS;
  const override = input.eventType ? PERSONAL_OVERRIDES[input.eventType] : null;
  return override ? { ...base, ...override } : base;
}

export function copyForRegistry(
  registry: Pick<Registry, "registry_type" | "event_type"> | null | undefined,
): RegistryCopy {
  return copyFor({
    registryType: registry?.registry_type ?? "baby",
    eventType: registry?.event_type ?? null,
  });
}

export function honoreeDisplayName(
  registry:
    | Pick<Registry, "honoree_names" | "parent_names">
    | null
    | undefined,
  fallback = "The Registry Owner",
): string {
  return (
    registry?.honoree_names?.trim() ||
    registry?.parent_names?.trim() ||
    fallback
  );
}

export function occasionLabel(
  registryType: RegistryType,
  eventType: PersonalEventType | null,
): string {
  if (registryType === "baby") return "Baby registry";
  if (!eventType || eventType === "other") return "Wishlist";
  return (
    PERSONAL_EVENT_TYPE_OPTIONS.find((option) => option.value === eventType)
      ?.label ?? "Wishlist"
  );
}

/** The registry form's occasion menu, from src/lib/occasions.ts. */
export const PERSONAL_EVENT_TYPE_OPTIONS: Array<{
  value: PersonalEventType;
  label: string;
}> = LIST_OCCASION_OPTIONS;

/**
 * The occasions a new registry offers, in order, on the website's form and
 * the app's new registry screen: the six occasions, then none, which is the
 * default.
 */
export const REGISTRY_OCCASION_CHOICES: Array<{
  value: PersonalEventType | null;
  label: string;
}> = [...PERSONAL_EVENT_TYPE_OPTIONS, { value: null, label: "No specific occasion" }];

// Filling in an item's details later, from its store link.
//
// Some stores, Amazon above all, block Regibee's server. An item added without
// the browser extension, such as from an iPad, keeps its link and a name
// guessed from it, with no photo or price. On a computer with the extension,
// the list's page reads those links again (MissingDetailsNotice) and the
// server saves what it found (src/lib/actions/item-details.ts).
//
// What a read changes:
// - The name, when the store's is different. The old one may be a guess from
//   the link.
// - The price, when the store's is different. Not on an item the owner marked
//   as bought: its price is what they paid.
// - The photo, only when there is none. A photo already there was picked or
//   uploaded by the owner.
//
// The server keeps each change with the value before it (item_detail_reads),
// so the list's managers can review the changes and put an old value back.
//
// Checking prices: the same read also keeps prices current. When a manager
// opens the list's page on a computer with the extension, the page reads a few
// items whose price hasn't been checked for a week (PriceCheck). A price check
// changes only the price, never the name or photo, and the review shows it
// like any other change. If the owner switches back to their own price, a
// later check that finds the same store price leaves it alone, and one that
// finds another price offers that. "Don't check this price again" on the
// review stops the checks until the item's link changes.
//
// No imports, so the unit tests (item-details.test.ts) and later the phone app
// can use it.

export type DetailField = "title" | "price" | "image_url";

export interface DetailChange {
  field: DetailField;
  /** The value before the read. Null when the field was empty. */
  before: string | number | null;
  after: string | number;
}

/** The fields of an item a read looks at, as saved. */
export interface ItemDetails {
  title: string;
  price: number | null;
  image_url: string | null;
  is_parent_purchased: boolean;
}

/** What the extension read from the item's link (ReadProduct in src/lib/extension.ts). */
export interface ReadDetails {
  title: string;
  price: number | null;
  /** Best first. */
  images: string[];
}

/** Which value an item shows now: the read's, the one before it, or neither once someone edited it. */
export type ShownSide = "before" | "after";

/** What each field is called on the review. */
export const DETAIL_FIELD_NAMES: Record<DetailField, string> = {
  title: "Name",
  price: "Price",
  image_url: "Photo",
};

const FIELDS: DetailField[] = ["title", "price", "image_url"];

/** No photo, or no price on an item the owner hasn't bought. */
export function isMissingDetails(item: ItemDetails): boolean {
  return !item.image_url || (item.price == null && !item.is_parent_purchased);
}

function titleKey(title: string): string {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

function cents(price: number): number {
  return Math.round(price * 100);
}

/** The changes a read makes to an item, in the order the review shows them. */
export function detailChanges(item: ItemDetails, read: ReadDetails): DetailChange[] {
  const changes: DetailChange[] = [];
  const title = read.title.replace(/\s+/g, " ").trim();
  if (title && titleKey(title) !== titleKey(item.title)) {
    changes.push({ field: "title", before: item.title.trim() ? item.title : null, after: title });
  }
  if (read.price != null && read.price > 0 && !item.is_parent_purchased) {
    if (item.price == null || cents(item.price) !== cents(read.price)) {
      changes.push({ field: "price", before: item.price, after: cents(read.price) / 100 });
    }
  }
  const photo = read.images[0];
  if (photo && !item.image_url) {
    changes.push({ field: "image_url", before: null, after: photo });
  }
  return changes;
}

/**
 * The review's heading. A review of price checks alone says so, since only
 * prices changed. The website's DetailReview and the phone app's share it.
 */
export function detailReviewHeading(reviews: { changes: Pick<DetailChange, "field" | "before">[] }[]): string {
  const total = reviews.length;
  const onlyPrices = reviews.every((r) => r.changes.every((c) => c.field === "price" && c.before !== null));
  if (onlyPrices) return total === 1 ? "New price for 1 item" : `New prices for ${total} items`;
  return total === 1 ? "Filled in details for 1 item" : `Filled in details for ${total} items`;
}

/** The changes a price check makes: the price only, on the same rules as a read. */
export function priceChanges(item: ItemDetails, read: ReadDetails): DetailChange[] {
  return detailChanges(item, read).filter((change) => change.field === "price");
}

/** How many days an item's price counts as checked. */
export const PRICE_CHECK_DAYS = 7;

/** How many prices one visit to a list's page checks. Each opens a store page for a few seconds. */
export const PRICE_CHECKS_PER_VISIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The fields of an item that decide when its price is checked. */
export interface PriceCheckItem extends ItemDetails {
  external_url: string;
  created_at: string;
  quantity_needed: number;
  quantity_fulfilled: number;
}

/** The item's last read, as item_detail_reads keeps it. */
export interface LastRead {
  read_url: string;
  read_at: string;
  changes: unknown;
  reviewed_at: string | null;
  /** The item's link when a manager turned off its price checks. Null or missing while they're on. */
  price_checks_off_url?: string | null;
}

/** Whether a manager turned off this item's price checks, for the link it has now. */
export function priceChecksOff(item: Pick<PriceCheckItem, "external_url">, read: LastRead | undefined): boolean {
  return Boolean(read?.price_checks_off_url) && read?.price_checks_off_url === item.external_url;
}

/**
 * When the item's price was last checked: its last read of this link, or when
 * it was added, since adding an item reads its price too.
 */
export function lastPriceCheck(item: Pick<PriceCheckItem, "external_url" | "created_at">, read: LastRead | undefined): string {
  return read && read.read_url === item.external_url ? read.read_at : item.created_at;
}

/**
 * Whether a list's page should check this item's price now. Call it only for
 * items the extension can read and that aren't missing details: the
 * MissingDetailsNotice handles those.
 */
export function priceCheckDue(item: PriceCheckItem, read: LastRead | undefined, now: Date): boolean {
  // Its price is what the owner paid.
  if (item.is_parent_purchased) return false;
  // Every one wanted has been given, so guests aren't looking at its price.
  if (item.quantity_fulfilled >= item.quantity_needed) return false;
  if (priceChecksOff(item, read)) return false;
  // The last read is still waiting for review. Another would replace it.
  if (read && read.read_url === item.external_url && !read.reviewed_at && parseDetailChanges(read.changes).length > 0) {
    return false;
  }
  const checked = Date.parse(lastPriceCheck(item, read));
  if (Number.isNaN(checked)) return true;
  return now.getTime() - checked >= PRICE_CHECK_DAYS * DAY_MS;
}

/**
 * The price check setting the item's edit dialog shows, or null to leave it
 * out. It shows once the extension has read the item's link, which says the
 * owner uses the extension, and while checks are off, so they can be turned
 * back on. Call it only for items the extension can read.
 */
export function priceCheckSetting(
  item: Pick<PriceCheckItem, "external_url" | "is_parent_purchased">,
  read: LastRead | undefined,
): "on" | "off" | null {
  if (item.is_parent_purchased || !read) return null;
  if (priceChecksOff(item, read)) return "off";
  return read.read_url === item.external_url ? "on" : null;
}

/**
 * True when a price check found the same new price the owner already turned
 * down: their last read of this link changed the price, and they switched back
 * to their own. The check then changes nothing and keeps that read for next time.
 */
export function turnedDownBefore(
  item: Pick<PriceCheckItem, DetailField | "external_url">,
  read: Pick<LastRead, "read_url" | "changes"> | undefined,
  changes: DetailChange[],
): boolean {
  const next = changes.find((change) => change.field === "price");
  if (!next || !read || read.read_url !== item.external_url) return false;
  const last = parseDetailChanges(read.changes).find((change) => change.field === "price");
  if (!last || last.before === null || shownSide(last, item) !== "before") return false;
  return sameValue("price", last.after, next.after);
}

function isEmpty(value: string | number | null): boolean {
  return value == null || value === "";
}

function sameValue(field: DetailField, value: string | number | null, saved: string | number | null): boolean {
  if (isEmpty(value) || isEmpty(saved)) return isEmpty(value) && isEmpty(saved);
  if (field === "price") return cents(Number(value)) === cents(Number(saved));
  return String(value) === String(saved);
}

/** The value of a field as saved on the item. */
export function savedValue(item: Pick<ItemDetails, DetailField>, field: DetailField): string | number | null {
  return item[field];
}

/**
 * Which value of a change the item shows now. Null when it shows neither,
 * because someone edited the item since: the review then leaves that change out.
 */
export function shownSide(change: DetailChange, item: Pick<ItemDetails, DetailField>): ShownSide | null {
  const saved = savedValue(item, change.field);
  if (sameValue(change.field, change.after, saved)) return "after";
  if (sameValue(change.field, change.before, saved)) return "before";
  return null;
}

/** True when the change replaced something, not filled an empty field. */
export function replacedValue(change: DetailChange): boolean {
  return change.before !== null;
}

/** Reads the changes saved in item_detail_reads.changes. Leaves out anything that isn't one. */
export function parseDetailChanges(raw: unknown): DetailChange[] {
  if (!Array.isArray(raw)) return [];
  const changes: DetailChange[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { field, before, after } = entry as Record<string, unknown>;
    if (!FIELDS.includes(field as DetailField)) continue;
    const valid = (value: unknown) =>
      field === "price" ? typeof value === "number" && Number.isFinite(value) : typeof value === "string" && value !== "";
    if (!valid(after) || (before !== null && !valid(before))) continue;
    changes.push({ field: field as DetailField, before: before as string | number | null, after: after as string | number });
  }
  return changes;
}

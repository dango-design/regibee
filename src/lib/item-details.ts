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

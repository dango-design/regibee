// Gift ideas: things someone might give another person, saved where only they
// can see them. Someone sees a good gift for their mom and saves it for her
// next birthday, and Mom never finds out. An idea isn't on any list and has no
// link. The access rules in supabase/migrations/20261115094644_gift_ideas.sql
// let only the account that saved it read it.
//
// This file has no imports, so the website, the browser extension and the
// unit tests (gift-ideas.test.ts) can all use it.

export const RECIPIENT_MAX = 80;
export const TITLE_MAX = 300;
export const NOTES_MAX = 1000;
const URL_MAX = 2048;
/** The column is numeric(12, 2). */
const PRICE_MAX = 9_999_999_999.99;

export interface GiftIdea {
  id: string;
  /** Who it's for, as the owner typed it: "Mom". Empty when they didn't say. */
  recipient: string;
  title: string;
  externalUrl: string | null;
  imageUrl: string | null;
  price: number | null;
  notes: string | null;
  /** When the owner marked it as bought, or null while it's still an idea. */
  boughtAt: string | null;
  createdAt: string;
}

export interface GiftIdeaRow {
  id: string;
  recipient: string;
  title: string;
  external_url: string | null;
  image_url: string | null;
  price: number | string | null;
  notes: string | null;
  bought_at: string | null;
  created_at: string;
}

export const GIFT_IDEA_COLUMNS = "id, recipient, title, external_url, image_url, price, notes, bought_at, created_at";

export function toGiftIdea(row: GiftIdeaRow): GiftIdea {
  // Supabase returns numeric columns as numbers, but a string is possible.
  const price = row.price === null ? null : Number(row.price);
  return {
    id: row.id,
    recipient: row.recipient,
    title: row.title,
    externalUrl: row.external_url,
    imageUrl: row.image_url,
    price: price !== null && Number.isFinite(price) ? price : null,
    notes: row.notes,
    boughtAt: row.bought_at,
    createdAt: row.created_at,
  };
}

/** What the website's form, the extension and the app send to save an idea. */
export interface GiftIdeaInput {
  /** Who it's for. Optional: leave it empty to decide later. */
  recipient?: string | null;
  title: string;
  url?: string | null;
  imageUrl?: string | null;
  /** A number, or what was typed in the price field, like "$1,299.99". */
  price?: number | string | null;
  notes?: string | null;
  /**
   * The product's barcode number, read from `url`. The server action checks
   * it (src/lib/gtin.ts); parseGiftIdea leaves it alone.
   */
  gtin?: string | null;
}

/** The columns to write, checked and cleaned up. */
export interface GiftIdeaFields {
  /** Empty when the owner didn't say who it's for. */
  recipient: string;
  title: string;
  external_url: string | null;
  image_url: string | null;
  price: number | null;
  notes: string | null;
}

/** Text on one line, with runs of spaces made single. */
function oneLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * A web link, or null when there's none. A link typed without "https://" gets
 * it. Returns false when there's something that isn't a web link.
 */
function webLink(value: unknown): string | null | false {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname.includes(".")) return false;
    const href = url.toString();
    return href.length <= URL_MAX ? href : false;
  } catch {
    return false;
  }
}

/** A price, null when there's none, or false when it isn't a usable number. */
function parsePrice(value: unknown): number | null | false {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > PRICE_MAX) return false;
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== "string") return false;
  const text = value.replace(/[$,\s]/g, "");
  if (!text) return null;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(text)) return false;
  return parsePrice(Number(text));
}

/**
 * Checks what was sent to save an idea. Only its name is required. Who it's
 * for can be left empty, to decide later. A bad picture link is dropped, since
 * the owner can't fix it from the form. A bad product link or price is an
 * error, since they can.
 */
export function parseGiftIdea(input: unknown): { fields: GiftIdeaFields; error?: undefined } | { error: string; fields?: undefined } {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const recipient = oneLine(value.recipient);
  if (recipient.length > RECIPIENT_MAX) return { error: `Keep who it's for under ${RECIPIENT_MAX} characters.` };

  const title = oneLine(value.title);
  if (!title) return { error: "Give the idea a name." };
  if (title.length > TITLE_MAX) return { error: `Keep the name under ${TITLE_MAX} characters.` };

  const externalUrl = webLink(value.url);
  if (externalUrl === false) return { error: "That link doesn't look right. Check it, or leave it out." };

  const price = parsePrice(value.price);
  if (price === false) return { error: "Enter the price as a number, like 24.99." };

  const notes = typeof value.notes === "string" ? value.notes.trim() : "";
  if (notes.length > NOTES_MAX) return { error: `Keep the note under ${NOTES_MAX} characters.` };

  const imageUrl = webLink(value.imageUrl);

  return {
    fields: {
      recipient,
      title,
      external_url: externalUrl,
      image_url: imageUrl || null,
      price,
      notes: notes || null,
    },
  };
}

/**
 * What ideas are grouped by: the name without case or extra spaces, so "mom"
 * and "Mom" are one person. Ideas saved without a name all have the key "".
 */
export function recipientKey(name: string): string {
  return oneLine(name).toLowerCase();
}

/** What the page calls the group of ideas saved without saying who they're for. */
export const NO_RECIPIENT_LABEL = "Not sure who yet";

export interface RecipientGroup {
  /** "" for the ideas saved without saying who they're for. */
  key: string;
  /** The name as it was typed on the newest idea. "" for the ideas saved without one. */
  name: string;
  ideas: GiftIdea[];
  /** Ideas not bought yet. */
  openCount: number;
}

function newestFirst(a: { createdAt: string }, b: { createdAt: string }) {
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * Ideas grouped by who they're for, the person with the newest idea first.
 * Ideas saved without saying who they're for come last, in one group with the
 * key "". In each group, ideas not bought yet come first, newest first, then
 * the bought ones, most recently bought first.
 */
export function groupByRecipient(ideas: GiftIdea[]): RecipientGroup[] {
  const groups = new Map<string, RecipientGroup>();
  for (const idea of [...ideas].sort(newestFirst)) {
    const key = recipientKey(idea.recipient);
    let group = groups.get(key);
    if (!group) {
      group = { key, name: oneLine(idea.recipient), ideas: [], openCount: 0 };
      groups.set(key, group);
    }
    group.ideas.push(idea);
    if (!idea.boughtAt) group.openCount++;
  }
  for (const group of groups.values()) {
    group.ideas.sort((a, b) => {
      if (!a.boughtAt !== !b.boughtAt) return a.boughtAt ? 1 : -1;
      if (a.boughtAt && b.boughtAt) return b.boughtAt.localeCompare(a.boughtAt);
      return newestFirst(a, b);
    });
  }
  const unnamed = groups.get("");
  groups.delete("");
  return unnamed ? [...groups.values(), unnamed] : [...groups.values()];
}

/** A group's heading: "For Mom", or "Not sure who yet". */
export function groupHeading(group: Pick<RecipientGroup, "key" | "name">): string {
  return group.key ? `For ${group.name}` : NO_RECIPIENT_LABEL;
}

/** A group's name on its own, as in the buttons that pick whose ideas to show: "Mom", or "Not sure who yet". */
export function groupName(group: Pick<RecipientGroup, "key" | "name">): string {
  return group.key ? group.name : NO_RECIPIENT_LABEL;
}

/** The people ideas were saved for, one name each, most recently used first. For suggestions in the form. */
export function recentRecipients(ideas: Pick<GiftIdea, "recipient" | "createdAt">[], limit = 8): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const idea of [...ideas].sort(newestFirst)) {
    const key = recipientKey(idea.recipient);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(oneLine(idea.recipient));
    if (names.length === limit) break;
  }
  return names;
}

/** "1 idea", "3 ideas". */
export function ideaCount(count: number): string {
  return `${count} ${count === 1 ? "idea" : "ideas"}`;
}

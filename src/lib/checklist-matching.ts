import { DEFAULT_CHECKLIST, type ChecklistCategory, type ChecklistItem } from "./checklist-data.ts";

// Which baby checklist entry (src/lib/checklist-data.ts) each item and gift
// fund on a list counts for. The website's checklist page, its list page's
// progress, the item dialog and the phone app all use this, so they agree. It
// has only a relative import, so the app shares it.
//
// Each item counts for at most one entry:
// - the one saved on it (checklist_entry), when the owner or the checklist
//   chose it;
// - none, when checklist_entry is "none";
// - otherwise the one its title matches best. An item matches an entry when
//   its title has every word of the entry's name, or of one of the entry's
//   aliases, as whole words. "Crib Mattress" therefore matches Crib Mattress,
//   and Crib too, so the entry with more words wins: Crib Mattress.

/** Saved on an item that counts for no entry. */
export const CHECKLIST_NONE = "none";

export type ChecklistKind = "item" | "fund";

/** An item or gift fund on the list, as the checklist sees it. */
export interface ChecklistCandidate {
  id: string;
  kind: ChecklistKind;
  title: string;
  checklist_entry?: string | null;
}

export interface ChecklistEntryInfo {
  entry: ChecklistItem;
  category: ChecklistCategory;
}

const ENTRIES = new Map<string, ChecklistEntryInfo>(
  DEFAULT_CHECKLIST.flatMap((category) => category.items.map((entry) => [entry.key, { entry, category }] as const)),
);

/** The checklist entry with this key, if there is one. */
export function checklistEntry(key: string | null | undefined): ChecklistEntryInfo | undefined {
  return key ? ENTRIES.get(key) : undefined;
}

/** The entry with this key, name or former name, in any case. */
export function checklistEntryNamed(value: string): ChecklistEntryInfo | undefined {
  const wanted = value.trim().toLowerCase();
  for (const info of ENTRIES.values()) {
    const names = [info.entry.key, info.entry.name, ...(info.entry.formerNames ?? [])];
    if (names.some((name) => name.toLowerCase() === wanted)) return info;
  }
  return undefined;
}

/**
 * A checklist_entry value sent by a form or the app, checked: a key the
 * checklist has for this kind, "none", or null for "work it out from the
 * title" (sent as "" or "auto"). Undefined when nothing usable was sent, so
 * the saved value stays as it is.
 */
export function parseChecklistEntry(value: unknown, kind: ChecklistKind): string | null | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "" || value === "auto") return null;
  if (value === CHECKLIST_NONE) return CHECKLIST_NONE;
  const info = checklistEntry(value);
  return info && entryTakes(info.entry, kind) ? info.entry.key : undefined;
}

/** Whether an entry takes this kind: gift fund entries take funds, the others take items. */
export function entryTakes(entry: ChecklistItem, kind: ChecklistKind): boolean {
  return Boolean(entry.fund) === (kind === "fund");
}

// Words that say nothing about which entry it is.
const STOPWORDS = new Set(["a", "an", "and", "the", "of", "for", "with", "n", "baby", "babies"]);

/** One word's singular form, near enough that the singular and plural meet. */
function stem(word: string): string {
  if (/^\d/.test(word)) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ie")) return `${word.slice(0, -2)}y`;
  if (/(sh|ch|x|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

/**
 * The words of a name or title, singular and lowercase. A clothing size such
 * as "0-3m", "(0-3 Months)" or "0 - 3 mo" becomes one word, so sizes match
 * whatever way a store writes them.
 */
export function checklistWords(text: string): string[] {
  const sized = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/(\d+)\s*-\s*(\d+)\s*(?:m|mo|mos|month|months)\b/g, " size$1to$2m ");
  return sized
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !STOPWORDS.has(word))
    .map(stem);
}

/** The word lists an entry can be matched by: each part of its name, and each alias. */
function entryPhrases(entry: ChecklistItem): string[][] {
  // "Glider / Rocker" and "Baby Carrier / Wrap" name two things. Either counts.
  // A size at the end, as in "Sleepers / Footies (3-6m)", goes with each part.
  const size = entry.name.match(/\(([^)]*)\)\s*$/)?.[0] ?? "";
  const parts = entry.name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .split(/\s+\/\s+/)
    .map((part) => `${part} ${size}`);
  return [...parts, ...(entry.aliases ?? [])]
    .map((phrase) => checklistWords(phrase))
    .filter((words) => words.length > 0);
}

const PHRASES = new Map(DEFAULT_CHECKLIST.flatMap((c) => c.items.map((e) => [e.key, entryPhrases(e)] as const)));

/**
 * The entry a title matches best, or null. The entry whose matching words are
 * the most wins, so a crib mattress counts as a Crib Mattress, not a Crib. On a
 * tie, the one that comes first in the checklist wins.
 */
export function guessChecklistEntry(title: string, kind: ChecklistKind): string | null {
  const words = new Set(checklistWords(title));
  if (words.size === 0) return null;
  let best: { key: string; score: number } | null = null;
  for (const category of DEFAULT_CHECKLIST) {
    for (const entry of category.items) {
      if (!entryTakes(entry, kind)) continue;
      for (const phrase of PHRASES.get(entry.key) ?? []) {
        if (!phrase.every((word) => words.has(word))) continue;
        if (!best || phrase.length > best.score) best = { key: entry.key, score: phrase.length };
      }
    }
  }
  return best?.key ?? null;
}

/**
 * The entry this item or fund counts for, and whether someone chose it. A
 * saved key that isn't in the checklist any more, or doesn't take this kind,
 * counts as no choice.
 */
export function countedEntry(candidate: ChecklistCandidate): { key: string | null; chosen: boolean } {
  const saved = candidate.checklist_entry;
  if (saved === CHECKLIST_NONE) return { key: null, chosen: true };
  const info = checklistEntry(saved);
  if (info && entryTakes(info.entry, candidate.kind)) return { key: info.entry.key, chosen: true };
  return { key: guessChecklistEntry(candidate.title, candidate.kind), chosen: false };
}

/**
 * The keys of the entries marked as registered somewhere else. Older lists
 * saved the entry's name, lowercased, so a name or a former name counts too.
 */
export function dismissedEntryKeys(saved: unknown): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(saved)) return keys;
  const wanted = new Set(saved.filter((value): value is string => typeof value === "string").map((v) => v.toLowerCase()));
  for (const category of DEFAULT_CHECKLIST) {
    for (const entry of category.items) {
      const names = [entry.key, entry.name, ...(entry.formerNames ?? [])].map((n) => n.toLowerCase());
      if (names.some((name) => wanted.has(name))) keys.add(entry.key);
    }
  }
  return keys;
}

export interface ChecklistCounted {
  id: string;
  kind: ChecklistKind;
  title: string;
  /** True when someone chose the entry, false when the title matched it. */
  chosen: boolean;
}

export interface ChecklistStatus {
  /** For each entry with something counting for it, what counts. */
  byEntry: Record<string, ChecklistCounted[]>;
  /** Items and funds on the list that count for no entry. */
  uncounted: ChecklistCounted[];
  /** Entries marked as registered somewhere else. */
  dismissed: string[];
  /** Entries done: something counts for them, or they're marked as registered. */
  done: number;
  total: number;
  essentialsDone: number;
  essentialsTotal: number;
}

/** What counts for each checklist entry on a list, and how far along it is. */
export function checklistStatus(candidates: ChecklistCandidate[], savedDismissed?: unknown): ChecklistStatus {
  const byEntry: Record<string, ChecklistCounted[]> = {};
  const uncounted: ChecklistCounted[] = [];
  for (const candidate of candidates) {
    const { key, chosen } = countedEntry(candidate);
    const counted = { id: candidate.id, kind: candidate.kind, title: candidate.title, chosen };
    if (key) (byEntry[key] ??= []).push(counted);
    else uncounted.push(counted);
  }
  const dismissed = dismissedEntryKeys(savedDismissed);
  let done = 0;
  let total = 0;
  let essentialsDone = 0;
  let essentialsTotal = 0;
  for (const category of DEFAULT_CHECKLIST) {
    for (const entry of category.items) {
      const isDone = Boolean(byEntry[entry.key]?.length) || dismissed.has(entry.key);
      total++;
      if (isDone) done++;
      if (entry.isEssential) {
        essentialsTotal++;
        if (isDone) essentialsDone++;
      }
    }
  }
  return { byEntry, uncounted, dismissed: [...dismissed], done, total, essentialsDone, essentialsTotal };
}

/** The list page's progress ring and the app's checklist row. */
export function getChecklistProgress(
  candidates: ChecklistCandidate[],
  savedDismissed?: unknown,
): { matched: number; total: number } {
  const { done, total } = checklistStatus(candidates, savedDismissed);
  return { matched: done, total };
}

/**
 * How the checklist asks whether the owner has a particular one in mind:
 * "Have a specific crib in mind?", "Have specific swaddles in mind?". It uses
 * the first thing an entry names, without sizes or notes in brackets.
 */
export function specificQuestion(entry: Pick<ChecklistItem, "name" | "suggestedQuantity">): string {
  const thing = entry.name
    .split(/\s+\/\s+/)[0]
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+[—–-]\s+.*$/, "")
    .trim();
  const lower = thing.replace(/\b([A-Z][a-z]+)\b/g, (word) => word.toLowerCase());
  const plural = /s$/i.test(thing) && !/ss$/i.test(thing);
  return plural ? `Have specific ${lower} in mind?` : `Have a specific ${lower} in mind?`;
}

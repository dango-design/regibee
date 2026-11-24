// Deleting a registry, an event, a group or an account that already holds
// something asks the person to type a sentence first. A brand-new one, with
// nothing in it, only asks with two buttons.
//
// This file holds the sentences, the check on what was typed, and what counts
// as holding something. The website's dialog
// (src/components/confirm-delete-dialog.tsx) and the app's
// (mobile/src/components/confirm-delete.tsx) both use it.
//
// The app imports this file through @shared/*, so it may only import other
// shared files, with relative paths.

import type { AccountDeletionSummary } from "./account-deletion-summary";

export type DeleteTarget = "registry" | "event" | "group" | "account";

const PHRASES: Record<DeleteTarget, string> = {
  registry: "I want to delete this registry",
  event: "I want to delete this event",
  group: "I want to delete this group",
  account: "I want to delete my account",
};

/** The sentence to type before deleting one of these. */
export function deletePhrase(target: DeleteTarget): string {
  return PHRASES[target];
}

// Capital letters, extra spaces and a full stop at the end don't matter. The
// point is that the person reads and types the sentence, not that they match
// it key for key.
function normalize(text: string): string {
  return text.trim().replace(/[.!]+$/, "").replace(/\s+/g, " ").toLowerCase();
}

/** Whether what the person typed is the sentence. */
export function matchesDeletePhrase(typed: string, phrase: string): boolean {
  return normalize(typed) === normalize(phrase);
}

/** What deleting one registry does. The server counts these (src/lib/registry-deletion-server.ts). */
export interface RegistryDeletionSummary {
  /** Items only on this registry. They're deleted. */
  deletedItems: number;
  /** Items saved to this registry that are also on another list. They stay on the other list. */
  movedItems: number;
  /** Items saved to another list and also shown on this one. They only come off this registry. */
  placedItems: number;
  /** Gift funds. They're deleted. */
  funds: number;
  /** Gifts guests reserved or gave on the deleted items and funds, cancelled ones left out. */
  gifts: number;
}

/** A registry holds something once it has an item or a gift fund. */
export function registryHasData(summary: RegistryDeletionSummary): boolean {
  return summary.deletedItems + summary.movedItems + summary.placedItems + summary.funds > 0;
}

function count(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/** One sentence per thing that happens when the registry is deleted. */
export function registryDeletionLines(summary: RegistryDeletionSummary): string[] {
  const lines: string[] = [];
  const { deletedItems, movedItems, placedItems, funds, gifts } = summary;

  const deleted = [
    deletedItems > 0 ? count(deletedItems, "item", "items") : "",
    funds > 0 ? count(funds, "gift fund", "gift funds") : "",
  ].filter(Boolean);
  if (deleted.length > 0) {
    lines.push(`${deleted.join(" and ")} ${deletedItems + funds === 1 ? "is" : "are"} deleted.`);
  }

  if (gifts > 0) {
    lines.push(
      gifts === 1
        ? "The gift a guest reserved or gave is deleted, with their name and message."
        : `The ${gifts} gifts guests reserved or gave are deleted, with their names and messages.`,
    );
  }

  const kept = movedItems + placedItems;
  if (kept > 0) {
    lines.push(
      kept === 1
        ? "1 item that's also on another list stays on that list."
        : `${kept} items that are also on another list stay on those lists.`,
    );
  }

  lines.push("The registry's link stops working.");
  return lines;
}

/** An account holds something once it has a registry or an event, its own or one it helps manage. */
export function accountHasData(summary: AccountDeletionSummary): boolean {
  return (
    summary.deleted.length > 0 || summary.handedOver.length > 0 || summary.leaving.length > 0 || summary.events > 0
  );
}

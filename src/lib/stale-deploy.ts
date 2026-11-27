import { unstable_isUnrecognizedActionError } from "next/navigation";

// Each deploy gives server actions new ids. A page loaded before a deploy
// still calls the old ids, and the new server answers 404, which Next.js
// throws as an UnrecognizedActionError. Reloading the page gets the new ids.

// A page loaded this recently already has the current deploy's code, so
// reloading it again won't help. Skipping it also keeps the page from
// reloading over and over. It reads the page's age and stores nothing.
const MIN_PAGE_AGE_MS = 30_000;

/** True when the error came from calling a server action the server doesn't have. */
export function isStaleDeployError(error: unknown): boolean {
  if (unstable_isUnrecognizedActionError(error)) return true;
  // A second copy of Next.js's error class would fail the check above, so
  // fall back to the name it sets.
  return error instanceof Error && error.name === "UnrecognizedActionError";
}

/**
 * Reloads the page, unless it loaded less than 30 seconds ago.
 * Returns whether it reloaded.
 */
export function reloadForNewDeploy(): boolean {
  // performance.now() counts from when this page loaded. Moving between
  // pages inside the site doesn't reset it.
  if (performance.now() < MIN_PAGE_AGE_MS) return false;
  window.location.reload();
  return true;
}

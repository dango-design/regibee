// Asks the browser extension to sync a list with one of its Elfster
// wishlists, for the list's page (src/components/elfster-sync.tsx). Browser
// only. The extension does the reading and sends what it read straight to
// the server (extension/src/background.ts). The page only learns whether it
// could, and whether it did.

import { extensionFeatures, sendToExtension, waitForExtension } from "@/lib/extension-page";

// The extension answers from what it has saved, so this is quick.
const READY_TIMEOUT_MS = 3000;
// Opening a page on Elfster, reading the wishlist and saving it. The
// extension stops waiting for the page after 15 seconds, and a product read
// for another Regibee tab may go first.
const SYNC_TIMEOUT_MS = 60_000;

/**
 * Whether the extension can sync the wishlist now: it's installed and
 * connected, the owner allowed it to read Elfster, and it hasn't tried this
 * wishlist in the last hour.
 */
export async function extensionCanSyncElfster(registryId: string, wishlistId: string): Promise<boolean> {
  const features = await extensionFeatures();
  if (!features?.includes("sync-elfster")) return false;
  const id = crypto.randomUUID();
  const answer = waitForExtension(
    (m) => (m.type === "elfster-sync-ready" && m.id === id ? m.ready : undefined),
    READY_TIMEOUT_MS,
  );
  sendToExtension({ type: "can-sync-elfster", id, registryId, wishlistId });
  return (await answer) === true;
}

/** Has the extension sync the wishlist. True when it did. */
export async function syncElfsterWithExtension(registryId: string, wishlistId: string): Promise<boolean> {
  const id = crypto.randomUUID();
  const answer = waitForExtension((m) => (m.type === "elfster-synced" && m.id === id ? m.synced : undefined), SYNC_TIMEOUT_MS);
  sendToExtension({ type: "sync-elfster", id, registryId, wishlistId });
  return (await answer) === true;
}

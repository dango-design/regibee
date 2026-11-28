"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { extensionCanSyncElfster, syncElfsterWithExtension } from "@/lib/elfster-sync-client";
import { cn } from "@/lib/utils";

interface ElfsterSyncProps {
  registryId: string;
  /** The Elfster wishlists due for a sync on this visit (elfsterSyncsDue in src/lib/elfster-sync-server.ts). */
  wishlistIds: string[];
  /** How long to wait after the page opens before the first read. */
  startAfterMs?: number;
  /** Stories pass stand-ins for these, so nothing is read or saved. */
  canSync?: (registryId: string, wishlistId: string) => Promise<boolean>;
  sync?: (registryId: string, wishlistId: string) => Promise<boolean>;
  className?: string;
}

// The same wait as the price check, so someone who opens the list to click
// through to something else doesn't set off a read.
const START_AFTER_MS = 3000;

/**
 * Keeps a list in sync with its Elfster wishlists while its owner has it
 * open, on a computer with the Regibee extension that's allowed to read
 * Elfster. A few seconds after the page opens, the extension opens a page on
 * Elfster in a background tab, reads the wishlist there, saves it for guests
 * and closes the tab (see "Keeping a list in sync" in extension/README.md).
 *
 * It shows a line while the extension reads, because the tab opens next to
 * the owner's. Nothing else: the owner never sees what's been bought on
 * Elfster, and the page never learns it. It runs once each time the page
 * opens, and the server asks for each wishlist at most once an hour.
 */
export function ElfsterSync({
  registryId,
  wishlistIds,
  startAfterMs = START_AFTER_MS,
  canSync = extensionCanSyncElfster,
  sync = syncElfsterWithExtension,
  className,
}: ElfsterSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const started = useRef(false);
  const left = useRef(false);
  // A refresh of the page while it syncs mustn't start it again.
  const queue = useRef(wishlistIds);

  useEffect(() => {
    left.current = false;
    if (started.current || queue.current.length === 0) return;
    const timer = setTimeout(async () => {
      if (left.current || started.current) return;
      started.current = true;
      for (const wishlistId of queue.current) {
        if (left.current) break;
        if (!(await canSync(registryId, wishlistId).catch(() => false))) continue;
        setSyncing(true);
        await sync(registryId, wishlistId).catch(() => false);
      }
      setSyncing(false);
    }, startAfterMs);
    return () => {
      // Leaving the page stops it after the read under way.
      left.current = true;
      clearTimeout(timer);
    };
  }, [registryId, startAfterMs, canSync, sync]);

  if (!syncing) return null;
  return (
    <div className={cn("flex items-center gap-2.5 rounded-lg bg-secondary px-3 py-2", className)} role="status">
      <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-tertiary motion-reduce:animate-none" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-tertiary">Syncing with Elfster…</p>
    </div>
  );
}

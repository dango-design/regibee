"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { savePriceCheck } from "@/lib/actions/item-details";
import { extensionReadsProducts, readProductWithExtension } from "@/lib/fetch-product";
import type { ReadProduct } from "@/lib/extension";
import type { ListPageMissingDetails } from "@/lib/list-page-types";
import { cn } from "@/lib/utils";

interface PriceCheckProps {
  registryId: string;
  /** Items whose price is due for a check on this visit (priceCheckDue in src/lib/item-details.ts). */
  items: ListPageMissingDetails[];
  /** How long to wait after the page opens before the first read. */
  startAfterMs?: number;
  /** Stories pass stand-ins for these, so nothing is read or saved. */
  detectExtension?: () => Promise<boolean>;
  readProduct?: (url: string) => Promise<ReadProduct | null>;
  saveAction?: typeof savePriceCheck;
  className?: string;
}

// Long enough that someone who opens the list to click through to something
// else doesn't set off a read.
const START_AFTER_MS = 3000;

/**
 * Checks the prices of a few items on a list's page, on a computer with the
 * Regibee extension. It starts on its own a few seconds after the page opens,
 * reads each item's link in a background tab, and saves the price when the
 * store's is different (savePriceCheck). DetailReview then shows the new
 * prices with the old ones, so the owner can switch back.
 *
 * It shows a line while it reads, because the store tabs open and close next
 * to the owner's, with a button to stop. It shows nothing otherwise. It runs
 * once each time the page opens: the server picks a few items each visit.
 */
export function PriceCheck({
  registryId,
  items,
  startAfterMs = START_AFTER_MS,
  detectExtension = extensionReadsProducts,
  readProduct = readProductWithExtension,
  saveAction = savePriceCheck,
  className,
}: PriceCheckProps) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const started = useRef(false);
  const stopped = useRef(false);
  // Each save that changes a price refreshes the page, and `items` with it.
  // Read the items as they were when the page opened.
  const queue = useRef(items);

  useEffect(() => {
    stopped.current = false;
    if (started.current || queue.current.length === 0) return;
    const timer = setTimeout(async () => {
      if (stopped.current || started.current) return;
      started.current = true;
      if (!(await detectExtension())) return;
      const list = queue.current;
      for (const [index, item] of list.entries()) {
        if (stopped.current) break;
        setProgress({ done: index, total: list.length });
        const product = await readProduct(item.external_url).catch(() => null);
        if (stopped.current) break;
        if (product) await saveAction(registryId, item.id, item.external_url, product).catch(() => null);
      }
      setProgress(null);
    }, startAfterMs);
    return () => {
      // Leaving the page stops the checks after the read under way.
      stopped.current = true;
      clearTimeout(timer);
    };
  }, [registryId, startAfterMs, detectExtension, readProduct, saveAction]);

  if (!progress) return null;
  const { done, total } = progress;
  return (
    <div
      className={cn("flex items-center gap-2.5 rounded-lg bg-secondary px-3 py-2", className)}
      role="status"
    >
      <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-tertiary motion-reduce:animate-none" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-tertiary">
        Checking prices at the store, {Math.min(done + 1, total)} of {total}…
      </p>
      <button
        type="button"
        className="shrink-0 text-sm font-semibold text-secondary hover:text-primary"
        onClick={() => {
          stopped.current = true;
          setProgress(null);
        }}
      >
        Stop
      </button>
    </div>
  );
}

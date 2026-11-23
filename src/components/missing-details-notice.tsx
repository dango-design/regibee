"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveReadDetails } from "@/lib/actions/item-details";
import { extensionReadsProducts, readProductWithExtension } from "@/lib/fetch-product";
import type { ReadProduct } from "@/lib/extension";
import type { ListPageMissingDetails } from "@/lib/list-page-types";
import { cn } from "@/lib/utils";

interface MissingDetailsNoticeProps {
  registryId: string;
  /** Items with a store link the extension reads, and no photo or price (src/lib/item-details.ts). */
  items: ListPageMissingDetails[];
  /** Stories pass stand-ins for these, so nothing is read or saved. */
  detectExtension?: () => Promise<boolean>;
  readProduct?: (url: string) => Promise<ReadProduct | null>;
  saveAction?: typeof saveReadDetails;
  className?: string;
}

type Phase = "checking" | "no-extension" | "ready" | "reading";

/**
 * Shown above the items on a list's page when some have a store link but no
 * photo or price. That happens when a store, Amazon above all, blocked
 * Regibee's server, and the item was added without the browser extension,
 * such as from an iPad. With the extension on this computer, the button reads
 * each link in a background tab and fills in what's missing. DetailReview
 * then shows what changed.
 */
export function MissingDetailsNotice({
  registryId,
  items,
  detectExtension = extensionReadsProducts,
  readProduct = readProductWithExtension,
  saveAction = saveReadDetails,
  className,
}: MissingDetailsNoticeProps) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [notRead, setNotRead] = useState(0);
  const [stopping, setStopping] = useState(false);
  const stopped = useRef(false);
  const hasItems = items.length > 0;

  useEffect(() => {
    if (!hasItems) return;
    let cancelled = false;
    detectExtension().then((installed) => {
      if (!cancelled) setPhase((current) => (current === "checking" ? (installed ? "ready" : "no-extension") : current));
    });
    return () => {
      cancelled = true;
    };
  }, [hasItems, detectExtension]);

  // Leaving the page stops the reading. Ask first.
  useEffect(() => {
    if (phase !== "reading") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  const fillIn = async () => {
    // Each save refreshes the page, and `items` with it, so go through the
    // items as they were when the button was clicked.
    const queue = items;
    stopped.current = false;
    setStopping(false);
    setNotRead(0);
    setProgress({ done: 0, total: queue.length });
    setPhase("reading");
    let failed = 0;
    for (const [index, item] of queue.entries()) {
      if (stopped.current) break;
      setProgress({ done: index, total: queue.length });
      const product = await readProduct(item.external_url).catch(() => null);
      const saved = product
        ? await saveAction(registryId, item.id, item.external_url, product).catch(() => ({ error: "Not saved" }))
        : null;
      if (!saved || saved.error) failed++;
    }
    setNotRead(failed);
    setPhase("ready");
  };

  if (phase === "reading") {
    const { done, total } = progress;
    return (
      <div className={cn("space-y-3 rounded-xl border border-brand-200 bg-primary p-3.5", className)} role="status">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-primary">
            Reading {Math.min(done + 1, total)} of {total} from the store…
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={stopping}
            onClick={() => {
              stopped.current = true;
              setStopping(true);
            }}
          >
            {stopping ? "Stopping…" : "Stop after this one"}
          </Button>
        </div>
        <Progress value={total > 0 ? (done / total) * 100 : 0} aria-label="Items read" />
        <p className="text-sm text-tertiary">Keep this tab open until it&apos;s done. Each item opens in a background tab for a few seconds.</p>
      </div>
    );
  }

  if (!hasItems || phase === "checking") return null;

  const count = items.length;
  const one = count === 1;
  const heading = one ? "1 item is missing a photo or price" : `${count} items are missing a photo or price`;

  if (phase === "no-extension") {
    return (
      <div className={cn("flex items-start gap-2.5 rounded-lg bg-secondary px-3 py-2.5", className)}>
        <Info className="mt-px h-4 w-4 shrink-0 text-tertiary" aria-hidden="true" />
        <p className="text-sm text-tertiary">
          <span className="font-semibold text-secondary">{heading}.</span> The store didn&apos;t let Regibee read{" "}
          {one ? "it" : "them"}. To fill {one ? "it" : "them"} in, open this list in Chrome on a computer with the
          Regibee browser extension.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2.5 rounded-xl border border-brand-200 bg-primary p-3.5", className)}>
      <div className="flex items-start gap-2.5">
        <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-primary">{heading}</p>
          <p className="text-sm text-secondary">
            The Regibee extension can read {one ? "it" : "them"} from the store and fill in the name, photo and price.
            You can check what changed afterward and put back anything you&apos;d rather keep.
          </p>
          {notRead > 0 && (
            <p className="text-sm text-error-primary">
              {notRead === 1 ? "1 item couldn't be read." : `${notRead} items couldn't be read.`} The store may have
              asked for a robot check, or the product page may be gone. Try again later.
            </p>
          )}
        </div>
      </div>
      <div className="pl-6.5">
        <Button size="sm" onClick={fillIn}>
          {one ? "Fill it in" : "Fill them in"}
        </Button>
      </div>
    </div>
  );
}

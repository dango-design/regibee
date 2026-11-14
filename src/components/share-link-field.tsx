"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReplaceResult = { path: string } | { error: string };

/**
 * A list's share link, with Copy and "Get a new link". A new link turns the
 * old one off for everyone who has it (replaceRegistryLink in
 * src/lib/actions/registry.ts), so it asks first.
 */
export function ShareLinkField({
  path,
  onReplace,
  replacedMessage = "Done. The old link no longer works. Send this one to the people you want to have it.",
  startConfirming = false,
}: {
  /** The list's page, like /r/birthday-wishlist-k7m2p9qx4tab. */
  path: string;
  onReplace: () => Promise<ReplaceResult>;
  /** What to say once the link is replaced. The demo says nothing changed. */
  replacedMessage?: string;
  /** For stories: open on the question. */
  startConfirming?: boolean;
}) {
  const [currentPath, setCurrentPath] = useState(path);
  // The site's address is only known in the browser. Until then, the path.
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(startConfirming);
  const [replacing, setReplacing] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${currentPath}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const replace = async () => {
    setReplacing(true);
    setError(null);
    const result = await onReplace();
    setReplacing(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setCurrentPath(result.path);
    setConfirming(false);
    setReplaced(true);
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-secondary">Share link</span>
      <div className="flex items-center gap-4">
        <p className="min-w-0 break-all font-mono text-sm text-tertiary">
          {origin.replace(/^https?:\/\//, "")}
          {currentPath}
        </p>
        <button
          type="button"
          aria-label="Copy share link"
          onClick={copy}
          className="shrink-0 text-tertiary transition-colors hover:text-secondary max-sm:-my-3 max-sm:inline-flex max-sm:min-h-11 max-sm:min-w-11 max-sm:items-center max-sm:justify-center"
        >
          {copied ? (
            <span className="inline-flex items-center gap-1 text-sm">
              <Check className="h-4 w-4" />
              Copied!
            </span>
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {confirming ? (
        <div className="space-y-3 rounded-xl border border-secondary bg-secondary p-4">
          <p className="text-sm text-secondary">
            The link you have now will stop working for everyone who has it. You&apos;ll get a new one to send to
            the people you still want to see this list. Guests who already gave a gift can still get to it from
            their emails.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={replace} disabled={replacing}>
              {replacing ? "Getting a new link..." : "Turn off this link and get a new one"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={replacing}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setConfirming(true);
            setReplaced(false);
          }}
        >
          Get a new link
        </Button>
      )}

      {replaced && (
        <p role="status" className="text-sm text-success-primary">
          {replacedMessage}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-error-primary">
          {error}
        </p>
      )}
    </div>
  );
}

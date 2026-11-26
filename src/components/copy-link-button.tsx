"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackClick } from "@/lib/analytics-client";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    trackClick("link_copied", { page: path.startsWith("/e/") ? "event" : "list" });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" onClick={handleCopy}>
      <span className="inline-flex items-center gap-1.5">
        {copied ? (
          <>
            <Check className="h-4 w-4 shrink-0" />
            Copied!
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4 shrink-0" />
            Share Link
          </>
        )}
      </span>
    </Button>
  );
}

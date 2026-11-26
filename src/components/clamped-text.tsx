"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/lib/utils/cx";

const CLAMP = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
} as const;

/**
 * Text that shows its first few lines, with "Read more" to open the rest.
 * Blank lines in the text start new paragraphs. Each paragraph is its own
 * element, spaced with a margin rather than a blank line, so the cut never
 * lands on an empty line and leaves an ellipsis there on its own. The button
 * only shows when the text is actually cut off.
 */
export function ClampedText({
  text,
  lines = 4,
  className,
}: {
  text: string;
  lines?: keyof typeof CLAMP;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cutOff, setCutOff] = useState(false);
  const paragraphs = text.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setCutOff(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, text]);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div id={id} ref={ref} className={cx("break-words", !open && CLAMP[lines], className)}>
        {paragraphs.map((paragraph, index) => (
          <p key={index} className={cx("whitespace-pre-line", index > 0 && "mt-2")}>
            {paragraph}
          </p>
        ))}
      </div>
      {(cutOff || open) && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="cursor-pointer text-sm font-semibold text-brand-tertiary hover:underline"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

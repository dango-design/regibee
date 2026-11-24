import { cn } from "@/lib/utils";

// The words go before "hand-me-downs", so "like-new" takes a hyphen and
// "very good" doesn't. The phone app's item row says the same
// (mobile/src/components/item-row.tsx).
const conditions: Record<string, { label: string; border: string; badge: string }> = {
  "like-new": { label: "like-new", border: "border-blush-200", badge: "bg-blush-200" },
  "very-good": { label: "very good", border: "border-sunshine-100", badge: "bg-sunshine-100" },
  "good": { label: "good", border: "border-mint-200", badge: "bg-mint-200" },
  "acceptable": { label: "acceptable", border: "border-brand-300", badge: "bg-brand-300" },
};

interface UsedConditionTagProps {
  condition: string | null;
  className?: string;
}

/**
 * "Open to like-new hand-me-downs" on an item card. When the card is too
 * narrow for one line, "hand-me-downs" moves to a second line, so the tag
 * never cuts off. It breaks only between the three parts. On one line,
 * rounded-xl is as round as rounded-full.
 */
export function UsedConditionTag({ condition, className }: UsedConditionTagProps) {
  const { label, border, badge } = conditions[condition ?? ""] ?? conditions["like-new"];

  // Each part ends in a space so the text reads as a sentence to screen
  // readers and in copied text. A space at the end of a line takes no room.
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 rounded-xl border bg-primary px-2.5 py-0.5 text-xs font-medium text-primary",
        border,
        className
      )}
    >
      <span className="whitespace-nowrap">Open to </span>
      <span className={cn("inline-flex items-center whitespace-nowrap rounded px-1.5", badge)}>
        {label}{" "}
      </span>
      <span className="whitespace-nowrap">hand-me-downs</span>
    </span>
  );
}

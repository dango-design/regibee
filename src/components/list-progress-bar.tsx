import { listProgressParts, type ListProgress, type ListProgressPart } from "@/lib/gifts";
import { cx } from "@/lib/utils/cx";

/**
 * Each part's color. Covered is a lighter shade of gifted, since it is gifted
 * too. Bought by you takes the yellow of the "Purchased by parent" tag. What's
 * left to buy is the empty track. Palette colors stay the same in dark mode.
 */
const PART_FILL: Record<ListProgressPart, string> = {
  gifted: "bg-mint-500",
  covered: "bg-mint-300",
  "bought-by-you": "bg-sunshine-400",
  "to-buy": "bg-quaternary",
};

/**
 * A list's progress for its managers: what guests gave, what guests covered
 * after a manager bought it, what a manager bought, and what's left to buy
 * (listProgress in src/lib/gifts.ts). The app's list screen draws the same.
 */
export function ListProgressBar({
  progress,
  label,
  className,
}: {
  progress: ListProgress;
  /** The bar's accessible name, such as "Items gifted". */
  label: string;
  className?: string;
}) {
  const parts = listProgressParts(progress).filter((p) => p.part !== "to-buy");
  const percent = progress.total > 0 ? Math.round((progress.gifted / progress.total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={listProgressParts(progress)
        .map((p) => p.label)
        .join(", ")}
      className={cx("flex h-2 w-full overflow-hidden rounded-full bg-quaternary", className)}
    >
      {parts.map((p) => (
        <div
          key={p.part}
          className={cx("h-full transition-all", PART_FILL[p.part])}
          style={{ width: `${(p.count / progress.total) * 100}%` }}
        />
      ))}
    </div>
  );
}

/** The key under the bar: "4 gifted · 1 covered · 2 bought by you · 5 to buy". */
export function ListProgressKey({ progress, className }: { progress: ListProgress; className?: string }) {
  return (
    <ul aria-hidden="true" className={cx("flex flex-wrap gap-x-3 gap-y-1 text-xs text-tertiary", className)}>
      {listProgressParts(progress).map((p) => (
        <li key={p.part} className="inline-flex items-center gap-1.5">
          <span
            className={cx(
              "size-2 shrink-0 rounded-full",
              PART_FILL[p.part],
              p.part === "to-buy" && "ring-1 ring-inset ring-primary",
            )}
          />
          {p.label}
        </li>
      ))}
    </ul>
  );
}

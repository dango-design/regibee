"use client";

import { useId } from "react";
import { Globe, Link2, Lock, type LucideIcon } from "lucide-react";
import { LIST_ACCESS, LIST_VISIBILITIES, type ListVisibility } from "@/lib/list-access";
import { cx } from "@/lib/utils/cx";

const ICONS: Record<ListVisibility, LucideIcon> = {
  private: Lock,
  link: Link2,
  public: Globe,
};

/**
 * Who can open a list: only its managers, anyone with its link, or anyone at
 * all. Sends `visibility` with its form, as "private", "link" or "public".
 */
export function ListAccessField({
  visibility,
  onChange,
}: {
  visibility: ListVisibility;
  onChange: (visibility: ListVisibility) => void;
}) {
  const descriptionId = useId();
  return (
    <fieldset aria-describedby={descriptionId}>
      <legend className="mb-2 text-sm font-medium text-secondary">Who can open this list</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {LIST_VISIBILITIES.map((value) => {
          const option = LIST_ACCESS[value];
          const Icon = ICONS[value];
          const selected = visibility === value;
          return (
            <label
              key={value}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600 sm:flex-col sm:gap-1",
                selected
                  ? "border-brand-600 bg-brand-600/5 ring-1 ring-brand-600"
                  : "border-secondary hover:border-primary",
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                checked={selected}
                onChange={() => onChange(value)}
                className="sr-only"
              />
              <Icon
                aria-hidden="true"
                className={cx("mt-0.5 h-4 w-4 shrink-0 sm:mt-0", selected ? "text-brand-700" : "text-tertiary")}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-primary">{option.label}</span>
                <span className="block text-xs text-tertiary">{option.who}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p id={descriptionId} className="mt-2 text-sm text-tertiary">
        {LIST_ACCESS[visibility].description}
      </p>
    </fieldset>
  );
}

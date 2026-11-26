"use client";

import { Check, Gift, Pipette } from "lucide-react";
import { THEME_COLOR_PRESETS, markOn, normalizeThemeColor, themeColors } from "@/lib/event-colors";
import { HOST_FILL, HOST_INK, hostColorVars } from "@/lib/host-colors";
import { cx } from "@/lib/utils/cx";

/**
 * The invitation's color, in the event form: none, a few to start from, or
 * any color from the browser's picker. A small panel shows how the gift
 * lists will look. The value is "" for none, or "#rrggbb".
 */
export function ThemeColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const color = normalizeThemeColor(value);
  const custom = color !== null && !THEME_COLOR_PRESETS.some((p) => p.color === color);
  const colors = color ? themeColors(color) : null;
  const swatch =
    "relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/15 transition outline-none focus-visible:ring-2 focus-visible:ring-brand-solid focus-visible:ring-offset-2 ring-offset-bg-primary";

  return (
    <div role="group" aria-labelledby="theme-color-label" className="flex flex-col gap-3">
      <div>
        <p id="theme-color-label" className="text-sm font-medium text-secondary">
          Color
        </p>
        <p className="text-sm text-tertiary">
          Fills the invitation&apos;s gift lists and wishlists, and its top when there&apos;s no picture. Pick one
          that goes with your invitation.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={color === null}
          onClick={() => onChange("")}
          className={cx(
            "h-9 cursor-pointer rounded-full px-3 text-sm font-medium ring-1 transition outline-none focus-visible:ring-2 focus-visible:ring-brand-solid",
            color === null ? "bg-brand-solid text-primary_on-brand ring-brand-solid" : "bg-primary text-secondary ring-primary",
          )}
        >
          None
        </button>
        {THEME_COLOR_PRESETS.map((preset) => {
          const selected = color === preset.color;
          return (
            <button
              key={preset.color}
              type="button"
              aria-label={preset.label}
              aria-pressed={selected}
              title={preset.label}
              onClick={() => onChange(preset.color)}
              className={cx(swatch, selected && "ring-2 ring-fg-primary ring-offset-2 ring-offset-bg-primary")}
              style={{ backgroundColor: preset.color }}
            >
              {selected && <Check aria-hidden="true" className="size-4" style={{ color: markOn(preset.color) }} />}
            </button>
          );
        })}
        {/* Any color: the browser's own picker, behind a swatch that shows it. */}
        <label
          className={cx(swatch, "focus-within:ring-2 focus-within:ring-brand-solid", custom && "ring-2 ring-fg-primary ring-offset-2 ring-offset-bg-primary")}
          style={custom ? { backgroundColor: color } : undefined}
          title="Pick any color"
        >
          <input
            type="color"
            aria-label="Pick any color"
            value={color ?? "#c3e3e8"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          {custom ? (
            // Drawn on the color itself, so white on a dark color.
            <Check aria-hidden="true" className="size-4" style={{ color: markOn(color) }} />
          ) : (
            <Pipette aria-hidden="true" className="size-4 text-tertiary" />
          )}
        </label>
      </div>
      {colors && (
        <div aria-hidden="true" className={cx("flex items-center gap-3 rounded-xl p-3", HOST_FILL)} style={hostColorVars(colors)}>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary">
            <Gift className={cx("size-4", HOST_INK)} />
          </span>
          <span className="text-sm font-medium text-primary">How the gift lists will look</span>
        </div>
      )}
    </div>
  );
}

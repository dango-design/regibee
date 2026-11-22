"use client";

import { Check, Gift, Pipette } from "lucide-react";
import { THEME_COLOR_PRESETS, normalizeThemeColor, themeColors } from "@/lib/event-colors";
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
    "relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full ring-1 ring-black/10 transition outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2";

  return (
    <div role="group" aria-labelledby="theme-color-label" className="flex flex-col gap-3">
      <div>
        <p id="theme-color-label" className="text-sm font-medium text-secondary">
          Color
        </p>
        <p className="text-sm text-tertiary">
          Fills the invitation&apos;s gift lists and wish lists, and its top when there&apos;s no picture. Pick one
          that goes with your invitation.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={color === null}
          onClick={() => onChange("")}
          className={cx(
            "h-9 cursor-pointer rounded-full px-3 text-sm font-medium ring-1 transition outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
            color === null ? "bg-brand-600 text-white ring-brand-600" : "bg-primary text-secondary ring-gray-300",
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
              className={cx(swatch, selected && "ring-2 ring-gray-900")}
              style={{ backgroundColor: preset.color }}
            >
              {selected && <Check aria-hidden="true" className="size-4 text-gray-900" />}
            </button>
          );
        })}
        {/* Any color: the browser's own picker, behind a swatch that shows it. */}
        <label
          className={cx(swatch, "focus-within:ring-2 focus-within:ring-brand-600", custom && "ring-2 ring-gray-900")}
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
            <Check aria-hidden="true" className="size-4" style={{ color: colors!.ink }} />
          ) : (
            <Pipette aria-hidden="true" className="size-4 text-tertiary" />
          )}
        </label>
      </div>
      {colors && (
        <div aria-hidden="true" className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: colors.fill }}>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary">
            <Gift className="size-4" style={{ color: colors.ink }} />
          </span>
          <span className="text-sm font-medium text-primary">How the gift lists will look</span>
        </div>
      )}
    </div>
  );
}

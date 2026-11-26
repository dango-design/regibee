"use client";

import { useState } from "react";
import { Check, Loader2, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setListHeader } from "@/lib/actions/registry";
import {
  HEADER_COLORS,
  patternsFor,
  type HeaderColor,
  type HeaderOccasion,
  type HeaderPattern,
  type ListHeader,
} from "@/lib/list-headers";
import { HEADER_BAND, HEADER_INK, listHeaderVars } from "@/lib/list-header-style";
import { cx } from "@/lib/utils/cx";

export interface ListHeaderPickerProps {
  registryId: string;
  title: string;
  /** What the band shows now. */
  header: ListHeader;
  /** The kind of list. Patterns that suit it come first. */
  occasion: HeaderOccasion | null;
  /** Opens the picker as soon as it mounts. For stories. */
  defaultOpen?: boolean;
  /** Stories and the demo pass a stand-in. */
  saveAction?: (registryId: string, choice: { color: string; pattern: string }) => Promise<{ error: string | null }>;
}

/**
 * The "Header" button on a list's band, and the dialog it opens: a preview of
 * the band, its colors and its patterns. Saving reloads the page's data, so
 * the band changes behind the dialog.
 */
export function ListHeaderPicker({
  registryId,
  title,
  header,
  occasion,
  defaultOpen = false,
  saveAction = setListHeader,
}: ListHeaderPickerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [color, setColor] = useState<HeaderColor>(header.color);
  const [pattern, setPattern] = useState<HeaderPattern>(header.pattern);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPicker = () => {
    // Start from what's saved, not from a choice that was cancelled.
    setColor(header.color);
    setPattern(header.pattern);
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveAction(registryId, { color: color.id, pattern: pattern.id });
    setSaving(false);
    if (result.error) setError(result.error);
    else setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-secondary bg-primary/80 px-3 py-1.5 text-xs font-medium text-secondary backdrop-blur-sm transition outline-none hover:bg-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-brand-solid max-sm:min-h-11"
      >
        <Paintbrush aria-hidden="true" className="size-3.5 shrink-0" />
        Header
      </button>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Header</DialogTitle>
          </DialogHeader>

          {/* The band as it will look, with the list's name. */}
          <div
            aria-hidden="true"
            className={cx(
              HEADER_BAND,
              "flex h-28 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-secondary px-4 text-center",
            )}
            style={listHeaderVars({ color, pattern })}
          >
            <span className={cx(HEADER_INK, "text-[10px] font-semibold tracking-[0.08em] uppercase")}>{pattern.label}</span>
            <span className="line-clamp-2 text-xl font-bold tracking-tight break-words text-primary">{title}</span>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-secondary">Color</legend>
            <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
              {HEADER_COLORS.map((option) => {
                const selected = option.id === color.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => setColor(option)}
                    className={cx(
                      "flex size-9 cursor-pointer items-center justify-center rounded-full border transition outline-none focus-visible:ring-2 focus-visible:ring-brand-solid focus-visible:ring-offset-2 max-sm:size-11",
                      selected ? "border-(--swatch-ink) ring-2 ring-(--swatch-ink) ring-offset-2 ring-offset-bg-primary" : "border-secondary",
                    )}
                    style={
                      {
                        background: `linear-gradient(135deg, ${option.light.bg} 50%, ${option.light.pattern} 50%)`,
                        "--swatch-ink": option.light.ink,
                      } as React.CSSProperties
                    }
                  >
                    {selected && <Check aria-hidden="true" className="size-4" style={{ color: option.light.ink }} />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-secondary">Pattern</legend>
            <div role="radiogroup" aria-label="Pattern" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {patternsFor(occasion).map((option) => {
                const selected = option.id === pattern.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPattern(option)}
                    className="group flex cursor-pointer flex-col items-center gap-1 rounded-xl outline-none"
                  >
                    <span
                      className={cx(
                        HEADER_BAND,
                        "block h-14 w-full rounded-lg border transition group-focus-visible:ring-2 group-focus-visible:ring-brand-solid",
                        selected ? "border-transparent ring-2 ring-(--header-ink) dark:ring-(--header-ink-dark)" : "border-secondary",
                      )}
                      style={listHeaderVars({ color, pattern: option })}
                    />
                    <span className={cx("text-xs", selected ? "font-semibold text-primary" : "text-tertiary")}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-error-primary">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              <span className="inline-flex items-center gap-1.5">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

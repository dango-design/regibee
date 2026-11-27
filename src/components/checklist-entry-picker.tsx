"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_CHECKLIST } from "@/lib/checklist-data";
import { CHECKLIST_NONE, checklistEntry, countedEntry, entryTakes, type ChecklistKind } from "@/lib/checklist-matching";
import { cn } from "@/lib/utils";

// Choosing which baby checklist entry an item or gift fund counts for
// (src/lib/checklist-matching.ts). The checklist page opens it in a dialog,
// and the item dialog shows it as a field.

interface ChecklistEntryPickerProps {
  kind: ChecklistKind;
  /** The entry it counts for now, by key, or null for none. */
  current: string | null;
  /** Called with an entry's key, or "none". */
  onChoose: (value: string) => void;
  disabled?: boolean;
}

/** A search field and the checklist's entries, by category. */
export function ChecklistEntryPicker({ kind, current, onChoose, disabled }: ChecklistEntryPickerProps) {
  const [query, setQuery] = useState("");
  const typed = query.trim().toLowerCase();
  const groups = DEFAULT_CHECKLIST.map((category) => ({
    name: category.name,
    entries: category.items.filter(
      (entry) =>
        entryTakes(entry, kind) &&
        (!typed || entry.name.toLowerCase().includes(typed) || category.name.toLowerCase().includes(typed)),
    ),
  })).filter((group) => group.entries.length > 0);

  const row = (value: string, label: string, chosen: boolean) => (
    <button
      key={value}
      type="button"
      disabled={disabled}
      aria-pressed={chosen}
      onClick={() => onChoose(value)}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60 max-sm:min-h-11",
        chosen && "bg-active font-medium",
      )}
    >
      <span className="min-w-0 break-words">{label}</span>
      {chosen && <Check className="h-4 w-4 shrink-0 text-brand-tertiary" aria-hidden="true" />}
    </button>
  );

  return (
    // Enter in the search field mustn't send the item dialog's form.
    <div className="space-y-2" onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}>
      <Input aria-label="Search the checklist" placeholder="Search the checklist" value={query} onChange={setQuery} />
      <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-secondary ring-inset">
        <div className="p-1">
          {!typed && row(CHECKLIST_NONE, "Not counted", current === null)}
          {groups.map((group) => (
            <div key={group.name} role="group" aria-label={group.name}>
              <p className="px-2.5 pt-3 pb-1 text-xs font-semibold text-tertiary">{group.name}</p>
              {group.entries.map((entry) => row(entry.key, entry.name, current === entry.key))}
            </div>
          ))}
          {groups.length === 0 && <p className="px-2.5 py-3 text-sm text-tertiary">Nothing on the checklist matches.</p>}
        </div>
      </div>
    </div>
  );
}

interface ChecklistEntryDialogProps extends Omit<ChecklistEntryPickerProps, "onChoose"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What's being moved, such as the item's name. */
  title: string;
  onChoose: (value: string) => Promise<void> | void;
}

/** The picker in a dialog, for the checklist page. */
export function ChecklistEntryDialog({ open, onOpenChange, title, onChoose, ...picker }: ChecklistEntryDialogProps) {
  const [saving, setSaving] = useState(false);
  const choose = async (value: string) => {
    setSaving(true);
    try {
      await onChoose(value);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Count “{title}” for</DialogTitle>
        </DialogHeader>
        <ChecklistEntryPicker {...picker} onChoose={choose} disabled={saving} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ChecklistEntryFieldProps {
  /** The item's name as it is in the form, which the checklist matches when nothing was chosen. */
  title: string;
  /** What's saved: a key, "none", or null to match by name. */
  saved: string | null | undefined;
  kind?: ChecklistKind;
  /** Sends the choice with the form, only once it changes. */
  name?: string;
}

/**
 * The entry an item counts for, in the item dialog, with Change to pick
 * another. It sends nothing until the owner picks, so the item keeps matching
 * by its name, as its name changes.
 */
export function ChecklistEntryField({ title, saved, kind = "item", name = "checklistEntry" }: ChecklistEntryFieldProps) {
  const [choice, setChoice] = useState<string | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  const labelId = useId();
  const { key } = countedEntry({ id: "", kind, title, checklist_entry: choice ?? saved });
  const shown = checklistEntry(key)?.entry.name ?? "Not counted";

  return (
    <div className="space-y-1.5">
      {choice !== undefined && <input type="hidden" name={name} value={choice} />}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p id={labelId} className="text-sm font-medium text-secondary">
            Checklist
          </p>
          <p className="text-sm text-primary" aria-describedby={labelId}>
            {shown}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={picking}
          onClick={() => setPicking((open) => !open)}
        >
          {picking ? "Done" : "Change"}
        </Button>
      </div>
      {picking && (
        <ChecklistEntryPicker
          kind={kind}
          current={key}
          onChoose={(value) => {
            setChoice(value);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

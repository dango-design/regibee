"use client";

import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, ListChecks } from "lucide-react";
import type { Key } from "react-aria-components";
import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  Input as AriaInput,
  ListBox as AriaListBox,
} from "react-aria-components";
import { Label } from "@/components/base/input/label";
import { Popover } from "@/components/base/select/popover";
import { SelectContext } from "@/components/base/select/select-context";
import { SelectItem } from "@/components/base/select/select-item";
import { useResizeObserver } from "@/hooks/use-resize-observer";
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
 * The entry an item counts for, in the item dialog: a dropdown that looks like
 * the Category field beside it, where typing searches the checklist. It sends
 * nothing until the owner picks, so the item keeps matching by its name, as
 * its name changes.
 */
export function ChecklistEntryField({ title, saved, kind = "item", name = "checklistEntry" }: ChecklistEntryFieldProps) {
  const [choice, setChoice] = useState<string | undefined>(undefined);
  const { key } = countedEntry({ id: "", kind, title, checklist_entry: choice ?? saved });
  const selectedKey = key ?? CHECKLIST_NONE;
  const selectedLabel = checklistEntry(key)?.entry.name ?? NOT_COUNTED;

  const [text, setText] = useState(selectedLabel);
  // The field shows the counted entry's name, also when the item's name
  // changes which entry it matches. Text being typed is left alone.
  const [shown, setShown] = useState(selectedLabel);
  if (shown !== selectedLabel) {
    setShown(selectedLabel);
    if (text === shown) setText(selectedLabel);
  }

  const typed = text.trim().toLowerCase();
  // The counted entry's own name isn't a search: the list shows everything then.
  const searching = typed !== "" && text !== selectedLabel;
  const items = [
    ...(searching ? [] : [{ id: CHECKLIST_NONE, label: NOT_COUNTED }]),
    ...DEFAULT_CHECKLIST.flatMap((category) =>
      category.items
        .filter(
          (entry) =>
            entryTakes(entry, kind) &&
            (!searching || entry.name.toLowerCase().includes(typed) || category.name.toLowerCase().includes(typed)),
        )
        .map((entry) => ({ id: entry.key, label: entry.name, supportingText: category.name })),
    ),
  ];

  const choose = (picked: Key | null) => {
    if (picked == null) return;
    const value = String(picked);
    const label = value === CHECKLIST_NONE ? NOT_COUNTED : (checklistEntry(value)?.entry.name ?? "");
    setText(label);
    setShown(label);
    setChoice(value);
  };

  // The list is as wide as the whole field, not only its text input.
  const fieldRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState("");
  const measure = useCallback(() => {
    if (fieldRef.current) setWidth(`${fieldRef.current.getBoundingClientRect().width}px`);
  }, []);
  useResizeObserver({ ref: fieldRef, box: "border-box", onResize: measure });

  return (
    <SelectContext.Provider value={{ size: "sm" }}>
      <AriaComboBox
        items={items}
        selectedKey={selectedKey}
        onSelectionChange={choose}
        inputValue={text}
        onInputChange={setText}
        // Text left behind that picks nothing goes back to the counted entry.
        onBlur={() => setText(selectedLabel)}
        menuTrigger="focus"
        allowsEmptyCollection
        className="flex flex-col gap-1.5"
      >
        <Label>Checklist</Label>
        <div
          ref={fieldRef}
          onPointerEnter={measure}
          className="relative flex w-full items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary transition duration-100 ease-linear ring-inset focus-within:ring-2 focus-within:ring-brand"
        >
          <ListChecks aria-hidden="true" className="ml-3 size-4 shrink-0 text-fg-quaternary" />
          <AriaInput
            autoComplete="off"
            onFocus={(event) => {
              measure();
              // The combo box focuses the input again as its list opens, so
              // a search being typed is left alone. Otherwise the entry's name
              // is selected, so typing replaces it.
              if (!searching) event.currentTarget.select();
            }}
            className="w-full min-w-0 appearance-none truncate bg-transparent py-2 pr-1 pl-2 text-md font-medium text-primary placeholder:font-normal placeholder:text-placeholder focus:outline-hidden max-sm:py-2.5"
          />
          <AriaButton
            aria-label="Show the checklist"
            className="flex shrink-0 cursor-pointer items-center self-stretch pr-3 pl-1 outline-hidden"
          >
            <ChevronDown aria-hidden="true" className="size-4 stroke-[2.5px] text-fg-quaternary" />
          </AriaButton>
        </div>
        <Popover size="sm" triggerRef={fieldRef} style={{ width }}>
          <AriaListBox
            className="size-full outline-hidden"
            renderEmptyState={() => <p className="px-3 py-2 text-sm text-tertiary">Nothing on the checklist matches.</p>}
          >
            {(item: (typeof items)[number]) => (
              <SelectItem id={item.id} label={item.label} supportingText={"supportingText" in item ? item.supportingText : undefined} />
            )}
          </AriaListBox>
        </Popover>
        {choice !== undefined && <input type="hidden" name={name} value={choice} />}
      </AriaComboBox>
    </SelectContext.Provider>
  );
}

const NOT_COUNTED = "Not counted";

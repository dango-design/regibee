"use client";

import { useCallback, useContext, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Plus } from "@untitledui/icons";
import type { Key } from "react-aria-components";
import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  ComboBoxStateContext,
  Input as AriaInput,
  ListBox as AriaListBox,
} from "react-aria-components";
import { Label } from "@/components/base/input/label";
import { Popover } from "@/components/base/select/popover";
import { SelectContext } from "@/components/base/select/select-context";
import { SelectItem } from "@/components/base/select/select-item";
import { useResizeObserver } from "@/hooks/use-resize-observer";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface CategoryFieldProps {
  label?: string;
  categories: Category[];
  /** The chosen category's id, or undefined for none. */
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /**
   * Makes a category with this name and chooses it. Returns a message when it
   * couldn't, and null when it did.
   */
  onCreate: (name: string) => Promise<string | null>;
  /** Sends the chosen id with a form. */
  name?: string;
}

// Keys for the two rows that aren't categories.
const ADD_KEY = "__add__";
const HINT_KEY = "__hint__";

/**
 * Picks one of a list's categories, or makes a new one: type a name that
 * isn't in the list and choose Add. It works with no categories yet, so the
 * field is never greyed out.
 */
export function CategoryField({ label = "Category", categories, value, onChange, onCreate, name }: CategoryFieldProps) {
  const selected = categories.find((category) => category.id === value);
  const selectedName = selected?.name ?? "";
  const [text, setText] = useState(selectedName);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // The field shows the chosen category's name, also after one is made or the
  // form is reset. Emptying the field takes the category away, and the text
  // being typed then is left alone.
  const [shown, setShown] = useState({ value, name: selectedName });
  if (shown.value !== value || shown.name !== selectedName) {
    setShown({ value, name: selectedName });
    if (value !== undefined || text === shown.name) setText(selectedName);
  }

  const typed = text.trim();
  const sameName = (category: Category) => category.name.toLowerCase() === typed.toLowerCase();
  // Text that is the chosen category's own name isn't a search: the list
  // shows every category then.
  const searching = typed !== "" && typed !== selectedName;
  const matches = searching
    ? categories.filter((category) => category.name.toLowerCase().includes(typed.toLowerCase()))
    : categories;
  const canAdd = searching && !categories.some(sameName);
  const items = [
    ...matches.map((category) => ({ id: category.id, label: category.name })),
    canAdd
      ? { id: ADD_KEY, label: `Add “${typed}”`, icon: Plus }
      : { id: HINT_KEY, label: "Type to add a new one", isDisabled: true },
  ];

  // The field stays usable while a category is being made. Disabling it would
  // take the keyboard's focus away, and the combo box would then report the
  // old category as chosen again.
  const create = async (newName: string) => {
    if (creating) return;
    setCreating(true);
    setError("");
    let message: string | null;
    try {
      message = await onCreate(newName);
    } catch {
      message = "We couldn't add that category. Try again.";
    }
    setCreating(false);
    if (message) setError(message);
  };

  // True while Enter closes the list. Closing makes the combo box report the
  // category chosen before, which would put its name back in the field.
  const closing = useRef(false);

  const choose = (key: Key | null) => {
    if (closing.current) return;
    if (key === ADD_KEY) {
      void create(typed);
      return;
    }
    const category = categories.find((c) => c.id === key);
    if (!category) return;
    setError("");
    setText(category.name);
    onChange(category.id);
  };

  /** Enter with no row highlighted takes the first match, or adds the name typed. */
  const enterTyped = () => {
    const match = categories.find(sameName) ?? matches[0];
    if (match) choose(match.id);
    else void create(typed);
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
        selectedKey={value ?? null}
        onSelectionChange={choose}
        inputValue={text}
        onInputChange={(next) => {
          setText(next);
          // Emptying the field takes the item out of its category.
          if (next === "" && value) onChange(undefined);
        }}
        onBlur={() => {
          // Text left behind chooses the category it names. Anything else
          // goes back to the chosen one, so nothing is added by accident.
          const match = searching ? categories.find(sameName) : undefined;
          if (match) choose(match.id);
          else setText(selectedName);
        }}
        menuTrigger="focus"
        className="flex flex-col gap-1.5"
      >
        <Label>{label}</Label>
        <FieldBox
          fieldRef={fieldRef}
          placeholder={categories.length === 0 ? "Type to add one" : "No category"}
          onPointerEnter={measure}
          enterTyped={searching ? enterTyped : null}
          closing={closing}
        />
        <Popover size="sm" triggerRef={fieldRef} style={{ width }}>
          <AriaListBox className="size-full outline-hidden">
            {(item: (typeof items)[number]) => (
              <SelectItem id={item.id} label={item.label} icon={"icon" in item ? item.icon : undefined} isDisabled={"isDisabled" in item} />
            )}
          </AriaListBox>
        </Popover>
        {name && <input type="hidden" name={name} value={value ?? ""} />}
        {creating && <p className="text-xs text-tertiary">Adding…</p>}
        {error && <p className="text-xs text-error-primary">{error}</p>}
      </AriaComboBox>
    </SelectContext.Provider>
  );
}

/** The box that looks like the site's other dropdowns, with a text input in it. */
function FieldBox({
  fieldRef,
  placeholder,
  onPointerEnter,
  enterTyped,
  closing,
}: {
  fieldRef: React.RefObject<HTMLDivElement | null>;
  placeholder: string;
  onPointerEnter: () => void;
  /** What Enter does while a name is typed and no row is highlighted. */
  enterTyped: (() => void) | null;
  closing: React.RefObject<boolean>;
}) {
  const state = useContext(ComboBoxStateContext);
  const justFocused = useRef(false);

  // Caught before the combo box sees it, which would keep the old category
  // and, with the list closed, save the whole form.
  const onKeyDownCapture = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !enterTyped || state?.selectionManager.focusedKey != null) return;
    event.preventDefault();
    event.stopPropagation();
    closing.current = true;
    state?.close();
    closing.current = false;
    enterTyped();
  };

  return (
    <div
      ref={fieldRef}
      onPointerEnter={onPointerEnter}
      onKeyDownCapture={onKeyDownCapture}
      className={cn(
        "relative flex w-full items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary transition duration-100 ease-linear ring-inset",
        "focus-within:ring-2 focus-within:ring-brand",
      )}
    >
      <AriaInput
        placeholder={placeholder}
        autoComplete="off"
        // Focus opens the list. A click on the field when it already has
        // focus opens it again. The click that gave it focus is skipped.
        onClick={() => {
          if (justFocused.current) justFocused.current = false;
          else if (state && !state.isOpen) state.open(null, "manual");
        }}
        onFocus={(event) => {
          onPointerEnter();
          justFocused.current = true;
          const input = event.currentTarget;
          // The combo box focuses the input again as its list opens, so a
          // name being typed is left alone. Otherwise the chosen name is
          // selected, so typing a new one replaces it.
          if (!enterTyped) input.select();
          requestAnimationFrame(() => {
            justFocused.current = false;
            // Safari drops the selection when the mouse button comes up.
            if (!enterTyped && document.activeElement === input) input.select();
          });
        }}
        className="w-full min-w-0 appearance-none truncate bg-transparent py-2 pr-1 pl-3 text-md font-medium text-primary placeholder:font-normal placeholder:text-placeholder focus:outline-hidden max-sm:py-2.5"
      />
      <AriaButton aria-label="Show categories" className="flex shrink-0 cursor-pointer items-center self-stretch pr-3 pl-1 outline-hidden">
        <ChevronDown aria-hidden="true" className="size-4 stroke-[2.5px] text-fg-quaternary" />
      </AriaButton>
    </div>
  );
}

// A dropdown that opens our own styled list instead of the browser's menu,
// like the site's SelectField (src/components/base/select/select-field.tsx).
// The browser draws a <select>'s menu itself, and on a Mac it looks nothing
// like the rest of Regibee.
//
// The button carries the chosen value in `data-value`, so tests can read it.

export interface DropdownOption {
  value: string;
  label: string;
}

/** Options under an optional heading, like an <optgroup>. */
export interface DropdownGroup {
  label?: string;
  options: DropdownOption[];
}

export interface Dropdown {
  /** The button that shows the chosen option and opens the list. Put a <label for={id}> next to it. */
  button: HTMLButtonElement;
  value: string;
  /** Replaces the options. Keeps the value when it's still there, or picks the first option. */
  setGroups(groups: DropdownGroup[]): void;
  options(): DropdownOption[];
}

const SVG = (paths: string, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const CHEVRON = '<path d="m6 9 6 6 6-6"/>';
const CHECK = '<path d="M20 6 9 17l-5-5"/>';

/** Space kept between the list and the popup's edges. */
const MARGIN = 8;
/** The tallest the list gets, as on the site (max-h-64). */
const MAX_HEIGHT = 256;

let nextId = 0;

export function dropdown(
  id: string,
  groups: DropdownGroup[],
  value: string,
  onChange?: (value: string) => void
): Dropdown {
  const listId = `${id}-list-${nextId++}`;
  const button = document.createElement("button");
  button.type = "button";
  button.id = id;
  button.className = "dropdown";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const text = document.createElement("span");
  text.className = "dropdown-value";
  button.append(text);
  button.insertAdjacentHTML("beforeend", SVG(CHEVRON, 16));

  const list = document.createElement("ul");
  list.id = listId;
  list.className = "dropdown-list";
  list.setAttribute("role", "listbox");
  list.tabIndex = -1;
  list.hidden = true;
  button.setAttribute("aria-controls", listId);

  let current = value;
  let all: DropdownOption[] = [];
  let rows: HTMLElement[] = [];
  let active = -1;

  const show = () => {
    const chosen = all.find((o) => o.value === current);
    text.textContent = chosen?.label ?? "";
    button.dataset.value = current;
  };

  const fill = () => {
    all = groups.flatMap((g) => g.options);
    rows = [];
    list.replaceChildren();
    groups.forEach((group, g) => {
      if (group.options.length === 0) return;
      let parent: HTMLElement = list;
      if (group.label) {
        const headingId = `${listId}-g${g}`;
        const wrapper = document.createElement("li");
        wrapper.setAttribute("role", "presentation");
        const heading = document.createElement("div");
        heading.id = headingId;
        heading.className = "dropdown-heading";
        heading.textContent = group.label;
        const inner = document.createElement("ul");
        inner.setAttribute("role", "group");
        inner.setAttribute("aria-labelledby", headingId);
        wrapper.append(heading, inner);
        list.append(wrapper);
        parent = inner;
      }
      for (const option of group.options) {
        const row = document.createElement("li");
        row.id = `${listId}-o${rows.length}`;
        row.className = "dropdown-option";
        row.setAttribute("role", "option");
        row.dataset.value = option.value;
        const label = document.createElement("span");
        label.textContent = option.label;
        row.append(label);
        row.insertAdjacentHTML("beforeend", SVG(CHECK, 16));
        const index = rows.length;
        row.addEventListener("mousemove", () => setActive(index, false));
        row.addEventListener("click", () => choose(index));
        rows.push(row);
        parent.append(row);
      }
    });
    if (!all.some((o) => o.value === current)) current = all[0]?.value ?? "";
    show();
  };

  const setActive = (index: number, scroll = true) => {
    if (rows.length === 0) return;
    active = Math.max(0, Math.min(index, rows.length - 1));
    rows.forEach((row, i) => row.classList.toggle("active", i === active));
    list.setAttribute("aria-activedescendant", rows[active].id);
    if (scroll) rows[active].scrollIntoView({ block: "nearest" });
  };

  const place = () => {
    const box = button.getBoundingClientRect();
    const height = document.documentElement.clientHeight;
    const below = height - box.bottom - MARGIN - 4;
    const above = box.top - MARGIN - 4;
    list.style.left = `${box.left}px`;
    list.style.width = `${box.width}px`;
    list.style.maxHeight = "";
    const wanted = Math.min(list.scrollHeight, MAX_HEIGHT);
    // Below the button, unless it only fits, or fits better, above.
    if (wanted <= below || below >= above) {
      list.style.top = `${box.bottom + 4}px`;
      list.style.bottom = "";
      list.style.maxHeight = `${Math.min(MAX_HEIGHT, below)}px`;
    } else {
      list.style.top = "";
      list.style.bottom = `${height - box.top + 4}px`;
      list.style.maxHeight = `${Math.min(MAX_HEIGHT, above)}px`;
    }
  };

  const isOpen = () => !list.hidden;

  const open = () => {
    if (isOpen() || rows.length === 0) return;
    // Outside the form, so a scrolling form can't clip it. It's taken away
    // with the popup's view, since the view's button goes with it.
    document.body.append(list);
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    rows.forEach((row) => row.setAttribute("aria-selected", String(row.dataset.value === current)));
    place();
    setActive(Math.max(0, all.findIndex((o) => o.value === current)));
    list.focus({ preventScroll: true });
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", onScroll, true);
  };

  function close(refocus = true) {
    if (!isOpen()) return;
    list.hidden = true;
    list.remove();
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutside, true);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("scroll", onScroll, true);
    if (refocus) button.focus({ preventScroll: true });
  }

  function onOutside(e: Event) {
    const target = e.target as Node;
    if (list.contains(target) || button.contains(target)) return;
    close(false);
  }

  function onResize() {
    close(false);
  }

  function onScroll(e: Event) {
    // The list's own scrolling is fine; the form scrolling away from it isn't.
    if (e.target !== list) close(false);
  }

  const choose = (index: number) => {
    const option = all[index];
    close();
    if (!option || option.value === current) return;
    current = option.value;
    show();
    onChange?.(current);
  };

  button.addEventListener("click", () => (isOpen() ? close() : open()));
  button.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      open();
    }
  });

  let typed = "";
  let typedAt = 0;
  list.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive(active + 1);
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive(active - 1);
        return;
      case "Home":
      case "PageUp":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
      case "PageDown":
        e.preventDefault();
        setActive(rows.length - 1);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        return;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      case "Tab":
        close(false);
        button.focus({ preventScroll: true });
        return;
    }
    // Typing jumps to the first option that starts with what was typed.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
      typedAt = now;
      const found = all.findIndex((o) => o.label.toLowerCase().startsWith(typed));
      if (found >= 0) setActive(found);
    }
  });

  fill();

  return {
    button,
    get value() {
      return current;
    },
    set value(next: string) {
      current = next;
      show();
    },
    setGroups(next: DropdownGroup[]) {
      close(false);
      groups = next;
      fill();
    },
    options: () => all,
  };
}

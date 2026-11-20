"use client";

import {
  useEffect,
  useId,
  useReducer,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/utils/cx";

// The steps of a create form, like a checkout page: a stack of sections with
// one open at a time. Finishing a section closes it and opens the next one the
// person hasn't been to yet. Every field stays in the page while its section
// is closed, so closed sections still hold their values. The new registry form
// (create-registry-form.tsx) and the new event form (event-form.tsx) use it.

/** How long a choice stays on screen before its section closes, so the person sees what they picked. */
export const ADVANCE_DELAY_MS = 350;

export type StepStatus = "open" | "done" | "skipped" | "incomplete" | "upcoming";

/** What a form says about one of its steps. */
export interface StepInfo {
  /** False while a required field is empty. */
  complete: boolean;
  /** Optional steps say so, and their button says Skip while they're empty. */
  optional: boolean;
  hasContent: boolean;
}

export type StepNav<Id extends string> = { open: Id | null; visited: ReadonlySet<Id> };
type NavAction<Id extends string> =
  | { type: "finish"; id: Id }
  | { type: "toggle"; id: Id }
  | { type: "open"; id: Id };

// The next step after `after` that hasn't been visited. If every later step
// has been visited, go back to the first one that hasn't. Null means every
// step has been visited.
function nextUnvisited<Id extends string>(order: readonly Id[], after: Id, visited: ReadonlySet<Id>): Id | null {
  const index = order.indexOf(after);
  return order.slice(index + 1).find((id) => !visited.has(id)) ?? order.find((id) => !visited.has(id)) ?? null;
}

function navReducer<Id extends string>(order: readonly Id[], state: StepNav<Id>, action: NavAction<Id>): StepNav<Id> {
  // Leaving the open step counts as visiting it, however the person left.
  const visited = state.open ? new Set(state.visited).add(state.open) : state.visited;
  switch (action.type) {
    case "finish":
      // A delayed advance can fire after the person has already moved on.
      if (state.open !== action.id) return state;
      return { open: nextUnvisited(order, action.id, visited), visited };
    case "toggle":
      return { open: state.open === action.id ? null : action.id, visited };
    case "open":
      return { open: action.id, visited };
  }
}

/**
 * Runs a stack of steps: which one is open, moving on after a choice, Enter
 * to finish a step, and putting the cursor in each step's first field.
 */
export function useStepSections<Id extends string>({
  order,
  start,
  steps,
  canFinish,
}: {
  /** The steps, in order. It can change, when a step only shows for some answers. */
  order: readonly Id[];
  start: StepNav<Id> | (() => StepNav<Id>);
  steps: Record<Id, StepInfo>;
  /** Called when the person finishes a step. Return false to keep it open, after showing why. */
  canFinish?: (id: Id) => boolean;
}) {
  const [nav, dispatch] = useReducer(
    (state: StepNav<Id>, action: NavAction<Id>) => navReducer(order, state, action),
    undefined,
    () => (typeof start === "function" ? start() : start),
  );

  const sectionRefs = useRef<Partial<Record<Id, HTMLElement | null>>>({});
  /** Holds the create button. Focus moves there once every step is done. */
  const createRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Don't move focus on first load. Only after the person starts using the form.
  const hasInteracted = useRef(false);

  const cancelAdvance = () => {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = undefined;
  };
  useEffect(() => cancelAdvance, []);

  const move = (action: NavAction<Id>) => {
    cancelAdvance();
    hasInteracted.current = true;
    dispatch(action);
  };

  /** Closes a step after a short pause, once the person has made a choice. */
  const advanceSoon = (id: Id, delay = ADVANCE_DELAY_MS) => {
    cancelAdvance();
    advanceTimer.current = setTimeout(() => {
      hasInteracted.current = true;
      dispatch({ type: "finish", id });
    }, delay);
  };

  const finish = (id: Id) => {
    if (canFinish && !canFinish(id)) {
      cancelAdvance();
      return;
    }
    move({ type: "finish", id });
  };

  // When a step opens, put the cursor in its first field. When every step is
  // done, move to the create button.
  useEffect(() => {
    if (!hasInteracted.current) return;
    const target = nav.open ? sectionRefs.current[nav.open] : createRef.current;
    if (!target) return;
    const field =
      target.querySelector<HTMLElement>("[data-autofocus]") ??
      target.querySelector<HTMLElement>(
        '[role="region"] input:not([type="hidden"]):not([tabindex="-1"]), [role="region"] textarea, [role="region"] button, button[type="submit"]',
      );
    field?.focus({ preventScroll: true });
    // Wait for the closing step to finish shrinking before scrolling.
    const timer = setTimeout(() => {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 220);
    return () => clearTimeout(timer);
  }, [nav.open]);

  // Enter in a text field finishes the step instead of submitting the form.
  // In a text area, Enter adds a line, so Cmd or Ctrl + Enter finishes.
  const onSectionKeyDown = (id: Id) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    const tag = target.tagName;
    if (tag === "TEXTAREA" && !(event.metaKey || event.ctrlKey)) return;
    if (tag !== "INPUT" && tag !== "TEXTAREA") return;
    event.preventDefault();
    finish(id);
  };

  const statusOf = (id: Id): StepStatus => {
    if (nav.open === id) return "open";
    if (!nav.visited.has(id)) return "upcoming";
    if (!steps[id].complete) return "incomplete";
    if (steps[id].optional && !steps[id].hasContent) return "skipped";
    return "done";
  };

  /** "Skip" while an optional step is empty, and "Done" when no unvisited step is left after this one. */
  const footerLabel = (id: Id) => {
    if (steps[id].optional && !steps[id].hasContent) return "Skip";
    const visited = new Set(nav.visited).add(id);
    return nextUnvisited(order, id, visited) ? "Continue" : "Done";
  };

  /**
   * The props for a step's StepSection. Upcoming steps show no summary unless
   * `showWhenUpcoming`, for a step whose defaults the person gets if they skip it.
   */
  const sectionProps = (id: Id, summary: ReactNode, { showWhenUpcoming = false } = {}) => {
    const status = statusOf(id);
    return {
      step: order.indexOf(id) + 1,
      optional: steps[id].optional,
      status,
      summary: status === "upcoming" && !showWhenUpcoming ? undefined : summary,
      onToggle: () => move({ type: "toggle", id }),
      onKeyDown: onSectionKeyDown(id),
      sectionRef: (element: HTMLElement | null) => {
        sectionRefs.current[id] = element;
      },
    };
  };

  return { nav, move, advanceSoon, cancelAdvance, finish, statusOf, footerLabel, sectionProps, createRef };
}

function StepMarker({ step, status }: { step: number; status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint-500 text-brand-900">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cx(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        status === "open" && "bg-brand-600 text-white",
        status === "incomplete" && "bg-error-secondary text-error-primary ring-1 ring-error ring-inset",
        (status === "upcoming" || status === "skipped") && "text-tertiary ring-1 ring-secondary ring-inset",
      )}
    >
      {step}
    </span>
  );
}

/** One step: a header that opens and closes it, with a summary while it's closed. */
export function StepSection({
  step,
  title,
  optional = false,
  status,
  summary,
  onToggle,
  onKeyDown,
  sectionRef,
  children,
}: {
  step: number;
  title: string;
  optional?: boolean;
  status: StepStatus;
  summary?: ReactNode;
  onToggle: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  sectionRef: Ref<HTMLElement>;
  children: ReactNode;
}) {
  const id = useId();
  const headerId = `${id}-header`;
  const panelId = `${id}-panel`;
  const isOpen = status === "open";

  return (
    <section
      ref={sectionRef}
      data-state={isOpen ? "open" : "closed"}
      className={cx(
        "rounded-xl border bg-primary transition-shadow duration-200",
        isOpen ? "border-brand-600 shadow-md ring-1 ring-brand-600" : "border-secondary",
      )}
    >
      <h2>
        <button
          type="button"
          id={headerId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <StepMarker step={step} status={status} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span
                className={cx(
                  "text-md font-medium",
                  status === "upcoming" ? "text-tertiary" : "text-primary",
                )}
              >
                {title}
              </span>
              {optional && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-tertiary">
                  Optional
                </span>
              )}
            </span>
            {!isOpen && summary && (
              <span className="mt-0.5 block truncate text-sm font-normal text-tertiary">{summary}</span>
            )}
          </span>
          {!isOpen && status !== "upcoming" && (
            <span className="shrink-0 text-sm font-medium text-brand-600">
              {status === "skipped" ? "Add" : "Edit"}
            </span>
          )}
        </button>
      </h2>
      <div
        className={cx(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          inert={!isOpen}
          onKeyDown={onKeyDown}
          className="min-h-0 overflow-hidden"
        >
          <div className="px-4 pt-1 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** A step's button: Continue, Skip or Done. */
export function StepFooter({
  label,
  onClick,
  primary = true,
  enterHint = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  enterHint?: boolean;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <Button
        type="button"
        variant={primary ? "default" : "outline"}
        onClick={onClick}
      >
        {label}
      </Button>
      {enterHint && <span className="hidden text-xs text-tertiary sm:inline">or press Enter</span>}
    </div>
  );
}

/** A card to pick one of a few choices. */
export function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-autofocus={selected || undefined}
      onClick={onClick}
      className={cx(
        "flex cursor-pointer flex-col items-start rounded-lg border p-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
        selected
          ? "border-brand-600 bg-brand-600/5 ring-1 ring-brand-600"
          : "border-secondary hover:border-primary",
      )}
    >
      {/* The icon sits beside the title's first line, so a title that wraps,
          like "Anyone with the link", doesn't pull it down between lines. */}
      <span className="flex items-start gap-2 font-medium text-primary">
        {icon && <span className="flex h-[1lh] shrink-0 items-center">{icon}</span>}
        {title}
      </span>
      <span className="mt-1 block text-xs text-tertiary">{description}</span>
    </button>
  );
}

/** A chip to pick one of many choices, like an occasion. */
export function ChoiceChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-autofocus={selected || undefined}
      onClick={onClick}
      className={cx(
        "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 max-sm:min-h-11",
        selected ? "border-brand-600 bg-brand-600 text-white" : "border-secondary text-secondary hover:border-primary",
      )}
    >
      {label}
    </button>
  );
}

// While someone types a year, a date input reports partial years such as
// "0002", "0020" and "0202". Count the date as finished once the year has four
// real digits.
export function isFinishedDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1000;
}

/** "Mar 14, 2027", for a step's summary. */
export function formatStepDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

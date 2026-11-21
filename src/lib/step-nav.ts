// Which step of a create form is open, and what each one says about itself.
// The new registry and new event forms are a stack of steps with one open at
// a time. Finishing a step opens the next one the person hasn't been to yet.
// The website (src/components/step-sections.tsx) and the phone app
// (mobile/src/components/steps.tsx) both run their steps with this.
//
// The phone app shares this file, so it imports nothing.

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

export type StepNavAction<Id extends string> =
  | { type: "finish"; id: Id }
  | { type: "toggle"; id: Id }
  | { type: "open"; id: Id };

/**
 * The next step after `after` that hasn't been visited. If every later step
 * has been visited, the first one that hasn't. Null when every step has been
 * visited.
 */
export function nextUnvisited<Id extends string>(order: readonly Id[], after: Id, visited: ReadonlySet<Id>): Id | null {
  const index = order.indexOf(after);
  return order.slice(index + 1).find((id) => !visited.has(id)) ?? order.find((id) => !visited.has(id)) ?? null;
}

export function stepNavReducer<Id extends string>(
  order: readonly Id[],
  state: StepNav<Id>,
  action: StepNavAction<Id>,
): StepNav<Id> {
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

export function stepStatus<Id extends string>(nav: StepNav<Id>, id: Id, info: StepInfo): StepStatus {
  if (nav.open === id) return "open";
  if (!nav.visited.has(id)) return "upcoming";
  if (!info.complete) return "incomplete";
  if (info.optional && !info.hasContent) return "skipped";
  return "done";
}

/** A step's button: "Skip" while an optional step is empty, "Done" when no unvisited step is left after it, else "Continue". */
export function stepFooterLabel<Id extends string>(
  order: readonly Id[],
  nav: StepNav<Id>,
  id: Id,
  info: StepInfo,
): "Skip" | "Continue" | "Done" {
  if (info.optional && !info.hasContent) return "Skip";
  const visited = new Set(nav.visited).add(id);
  return nextUnvisited(order, id, visited) ? "Continue" : "Done";
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

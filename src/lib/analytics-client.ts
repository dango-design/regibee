// Named clicks the server can't see, sent to PostHog (analytics) from the
// browser. PostHog is started in src/instrumentation-client.ts; when it isn't
// (no key, the phone app's web view, Storybook), these do nothing.
//
// Like the server's events, these carry no names, links or anything about a
// gift idea. See "Analytics" in CLAUDE.md.

import posthog from "posthog-js";

/** Every click the browser sends, with the only properties it may carry. */
export type ClickEvents = {
  /** Someone copied a list's or an event's link to send it. */
  link_copied: { page: "list" | "event" };
};

export function trackClick<E extends keyof ClickEvents>(event: E, properties: ClickEvents[E]): void {
  try {
    if (!posthog.__loaded) return;
    posthog.capture(event, { ...properties, platform: "web" });
  } catch {
    // Counting must never break the page.
  }
}

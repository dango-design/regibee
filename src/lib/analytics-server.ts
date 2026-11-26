// Sends usage events to PostHog (analytics) from the server.
//
// The server actions call track() after something is saved, such as a new
// list or a gift. The phone app runs the same server actions through
// /api/app/action, so one call here counts the website and the app.
//
// What may be sent is fixed by AnalyticsEvents below. Never add a name, an
// email, a message, an item's name or link, a list's slug or anything about a
// gift idea: PostHog is outside Regibee, and anyone with a PostHog login can
// read it. See "Analytics" in CLAUDE.md.
//
// Nothing is sent unless NEXT_PUBLIC_POSTHOG_KEY is set, which it is only on
// production. Previews, local runs and the end-to-end tests send nothing.
//
// This calls PostHog's capture API with fetch instead of using posthog-node.
// posthog-node batches events and sends them later, which a Vercel function
// may never do, and Storybook bundles server actions for the browser, where a
// Node library can break every story that imports one.

import { after } from "next/server";
import { inAppRequest } from "@/lib/app-request";
import type { ListVisibility } from "@/lib/list-access";

type NoProperties = Record<string, never>;

/** Every event the server sends, with the only properties it may carry. */
export type AnalyticsEvents = {
  /** Someone clicked the link in their sign-up email. */
  account_confirmed: NoProperties;
  list_created: { occasion: string; access: ListVisibility };
  /** `count` is more than 1 when several saved items go on a list at once. */
  item_added: { store: string | null; has_photo: boolean; has_price: boolean; count: number };
  fund_added: NoProperties;
  gift_reserved: { guest_signed_in: boolean };
  fund_contribution: NoProperties;
  group_gift_started: NoProperties;
  group_gift_pledge: NoProperties;
  event_created: { occasion: string };
  event_invites_sent: { count: number };
  rsvp_submitted: { answer: string };
  /** Never add a property: a gift idea and what's in it must stay secret. */
  gift_idea_saved: NoProperties;
  follow_requested: NoProperties;
};

/**
 * Who did it. An account is counted by its Supabase user id, never its email.
 * A guest gets a new random id each time and no person profile, so PostHog
 * counts what guests do without keeping a record of any guest.
 */
export type AnalyticsActor = { userId: string } | { guest: true };

export type AnalyticsPlatform = "web" | "app" | "extension";

const DEFAULT_HOST = "https://us.i.posthog.com";

function posthogKey(): string | null {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY || null;
}

/** "https://www.target.com/p/..." → "target.com". Only the store, never the path. */
export function storeDomain(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    return new URL(link).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Sends one event after the response has gone out, so a page or the app never
 * waits on PostHog. Any failure is logged and ignored: counting must never
 * break a gift or an RSVP.
 */
export function track<E extends keyof AnalyticsEvents>(
  event: E,
  actor: AnalyticsActor,
  properties: AnalyticsEvents[E],
  options: { platform?: AnalyticsPlatform } = {},
): void {
  const key = posthogKey();
  if (!key) return;

  const platform = options.platform ?? (inAppRequest() ? "app" : "web");
  const body = JSON.stringify({
    api_key: key,
    event,
    distinct_id: "userId" in actor ? actor.userId : crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    properties: {
      ...properties,
      platform,
      // PostHog's library name, so its charts can tell server events apart.
      $lib: "regibee-server",
      ...("guest" in actor ? { $process_person_profile: false } : {}),
    },
  });

  const send = async () => {
    try {
      const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST;
      const response = await fetch(`${host}/i/v0/e/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) console.error(`PostHog refused ${event}: ${response.status}`);
    } catch (error) {
      console.error(`Couldn't send ${event} to PostHog`, error);
    }
  };

  try {
    after(send);
  } catch {
    // after() only works while a request is being handled.
    void send();
  }
}

/**
 * Deletes an account's person and events from PostHog, for account deletion.
 * Needs a personal API key with the person:write scope, which only production
 * has. Without one, it does nothing.
 */
export async function deleteAnalyticsPerson(userId: string): Promise<void> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) return;

  const host = process.env.POSTHOG_API_HOST || "https://us.posthog.com";
  const headers = { Authorization: `Bearer ${apiKey}` };
  const base = `${host}/api/projects/${encodeURIComponent(projectId)}/persons`;

  const found = await fetch(`${base}/?distinct_id=${encodeURIComponent(userId)}`, { headers });
  if (!found.ok) throw new Error(`PostHog couldn't look up the person: ${found.status}`);
  const { results } = (await found.json()) as { results?: { id: string }[] };

  for (const person of results ?? []) {
    const deleted = await fetch(
      `${base}/${encodeURIComponent(person.id)}/?delete_events=true&delete_recordings=true`,
      { method: "DELETE", headers },
    );
    if (!deleted.ok) throw new Error(`PostHog couldn't delete the person: ${deleted.status}`);
  }
}

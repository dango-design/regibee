// The website's server code, called from the app. Most of what Regibee does
// beyond a list's own items (events, following, groups, saved items, emails,
// managers) runs only on the website's server, which holds the service-role
// key. The app sends its session's access token, and the server runs the
// same server actions and page loaders the website uses, as this user
// (src/app/api/app on the website). So the app and the website do the same
// thing, in the same code.
//
// Signed out, the app may still call the guest loaders and actions the
// website lets anyone use (src/lib/app-guest-calls.ts on the website): the
// loaders with no token, and the actions with a guest's anonymous session.

import { isGuestAction, isGuestLoader } from "@shared/app-guest-calls";

import { guestSupabase, SITE_URL, supabase } from "@/lib/supabase";

/** An error to show people as it is: the server's own words. */
export class ApiError extends Error {}

const SIGNED_OUT = "You're signed out. Sign in again.";

/** The signed-in account's access token, or null. getSession refreshes it first if it has run out. */
async function accountToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * The phone's guest session's access token. The first guest action on a
 * signed-out phone makes the session, from the phone, the way the website's
 * gift dialog gives a guest one. Later ones reuse it.
 */
async function guestAccessToken(): Promise<string> {
  const { data, error } = await guestSupabase.auth.getSession();
  if (data.session && !error) return data.session.access_token;
  // A session that can't be refreshed any more is dropped for a new one.
  if (error) await guestSupabase.auth.signOut({ scope: "local" }).catch(() => {});
  const made = await guestSupabase.auth.signInAnonymously();
  if (made.error || !made.data.session) throw new ApiError("Regibee can't be reached right now. Try again.");
  return made.data.session.access_token;
}

/** The token for a call: the account's, or a guest's when the call is one guests may make. */
async function tokenFor(call: { loader: string } | { action: string }): Promise<string | null> {
  const token = await accountToken();
  if (token) return token;
  if ("loader" in call && isGuestLoader(call.loader)) return null;
  if ("action" in call && isGuestAction(call.action)) return guestAccessToken();
  throw new ApiError(SIGNED_OUT);
}

async function post(path: string, body: unknown, token: string | null): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${SITE_URL}${path}`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("You're offline, or Regibee can't be reached. Try again.");
  }
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !json) {
    throw new ApiError(typeof json?.error === "string" ? json.error : "Something went wrong. Try again.");
  }
  return json;
}

/**
 * What one of the website's pages loads (src/lib/app-loaders.ts on the
 * website). Null when the page would say "not found".
 */
export async function loadPage<T>(loader: string, ...args: unknown[]): Promise<T | null> {
  const json = await post("/api/app/data", { loader, args }, await tokenFor({ loader }));
  if ("data" in json) return json.data as T;
  return null;
}

/** A form's fields, for the server actions that read forms. */
export function form(fields: Record<string, string | number | boolean | null | undefined | string[]>) {
  return { $form: fields };
}

export interface ActionOutcome<T> {
  /** What the action returned. */
  result: T;
  /** Where the website would go next, such as a new list's page. */
  redirect?: string;
}

/**
 * Runs one of the website's server actions ("registry.updateRegistry") as
 * this user, or as the phone's guest for a guest action when signed out. An
 * action that answers { error } throws it as an ApiError, in the action's own
 * words.
 */
export async function runAction<T = unknown>(action: string, ...args: unknown[]): Promise<ActionOutcome<T>> {
  const json = await post("/api/app/action", { action, args }, await tokenFor({ action }));
  if (json.notFound) throw new ApiError("We couldn't find that. It may have been deleted.");
  const result = (json.result ?? null) as T;
  const error = result && typeof result === "object" && "error" in result ? (result as { error: unknown }).error : null;
  if (typeof error === "string" && error) throw new ApiError(error);
  return { result, redirect: typeof json.redirect === "string" ? json.redirect : undefined };
}

/** Like runAction, for when only success matters. */
export async function act<T = unknown>(action: string, ...args: unknown[]): Promise<T> {
  return (await runAction<T>(action, ...args)).result;
}

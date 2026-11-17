// The website's server code, called from the app. Most of what Regibee does
// beyond a list's own items (events, following, groups, saved items, emails,
// managers) runs only on the website's server, which holds the service-role
// key. The app sends its session's access token, and the server runs the
// same server actions and page loaders the website uses, as this user
// (src/app/api/app on the website). So the app and the website do the same
// thing, in the same code.

import { SITE_URL, supabase } from "@/lib/supabase";

/** An error to show people as it is: the server's own words. */
export class ApiError extends Error {}

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  // getSession refreshes the token first if it has run out.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("You're signed out. Sign in again.");

  let response: Response;
  try {
    response = await fetch(`${SITE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
  const json = await post("/api/app/data", { loader, args });
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
 * this user. An action that answers { error } throws it as an ApiError, in the
 * action's own words.
 */
export async function runAction<T = unknown>(action: string, ...args: unknown[]): Promise<ActionOutcome<T>> {
  const json = await post("/api/app/action", { action, args });
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

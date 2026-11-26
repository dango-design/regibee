// Requests from the iPhone and Android app (mobile/). The app signs in to the
// same Supabase project and sends its session's access token as
// "Authorization: Bearer <token>". The routes under src/app/api/app run the
// website's own server actions and page loaders for it, so the app and the
// website do the same thing in the same code.
//
// While a request from the app is being handled, createClient()
// (src/utils/supabase/server.ts) returns a client that acts as the app's user
// instead of reading the website's cookies. That only happens inside
// runAsAppUser, so no other request can act on a token this way.
//
// A signed-out app may call a few guest loaders and actions too
// (src/lib/app-guest-calls.ts): with an anonymous guest session's token, or
// with no token at all. With no token, createClient() returns a client with
// no session. It still ignores cookies.

import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type AppRequest = { accessToken: string | null; user: User | null };

// Made the first time it's needed, not when this file loads. Storybook bundles
// server actions for the browser, where node:async_hooks is an empty module
// (.storybook/main.ts). Making it on load broke every story that imports a
// server action, since they all import createClient().
let storage: AsyncLocalStorage<AppRequest> | undefined;

function appRequest(): AsyncLocalStorage<AppRequest> {
  storage ??= new AsyncLocalStorage<AppRequest>();
  return storage;
}

/** The app user's access token, while a request from the app is being handled. */
export function appAccessToken(): string | null {
  return storage?.getStore()?.accessToken ?? null;
}

/** A request from the app is being handled, signed in or not. */
export function inAppRequest(): boolean {
  return Boolean(storage?.getStore());
}

/**
 * Runs `run` as the app's user: createClient() then acts as them. With no
 * token (a signed-out app calling a guest loader), it acts as nobody.
 */
export function runAsAppUser<T>(accessToken: string | null, user: User | null, run: () => Promise<T>): Promise<T> {
  return appRequest().run({ accessToken, user }, run);
}

/**
 * A Supabase client that acts as the app's user, under the same access rules
 * (RLS) as the website's cookie client. It has no stored session, so
 * auth.getUser() is pointed at the access token. Without a token it's a
 * signed-out client, like the website's for a visitor with no cookies.
 */
export function appUserClient(accessToken: string | null): SupabaseClient {
  if (!accessToken) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // The user was checked when the request came in, so each call doesn't ask
  // Supabase's auth server again.
  const user = storage?.getStore()?.user;
  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = ((jwt?: string) =>
    !jwt && user
      ? Promise.resolve({ data: { user }, error: null })
      : getUser(jwt ?? accessToken)) as typeof client.auth.getUser;
  return client;
}

export function appError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export type AppCallerInfo =
  | { caller: "account" | "guest"; user: User; accessToken: string; response?: undefined }
  | { caller: "nobody"; user: null; accessToken: null; response?: undefined }
  | { response: NextResponse; caller?: undefined; user?: undefined; accessToken?: undefined };

/**
 * Who sent a request from the app: a signed-in account, a guest's anonymous
 * session, or nobody (no token). A token that doesn't check out is refused,
 * even for guest calls. Only the Authorization header counts: cookies are
 * ignored, so a web page can't make these requests with someone's website
 * session.
 */
export async function identifyAppCaller(request: Request): Promise<AppCallerInfo> {
  const header = request.headers.get("authorization");
  if (!header) return { caller: "nobody", user: null, accessToken: null };
  const accessToken = header.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!accessToken) return { response: appError("Sign in first.", 401) };
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await anon.auth.getUser(accessToken);
  if (error || !data.user) return { response: appError("Sign in first.", 401) };
  // Guests get anonymous sessions when they reserve a gift. Those aren't accounts.
  return { caller: data.user.is_anonymous ? "guest" : "account", user: data.user, accessToken };
}

type AppAuth =
  | { user: User; accessToken: string; response?: undefined }
  | { response: NextResponse; user?: undefined; accessToken?: undefined };

/** The signed-in account behind a request from the app, or a response refusing it. */
export async function authenticateApp(request: Request): Promise<AppAuth> {
  const who = await identifyAppCaller(request);
  if (who.response) return { response: who.response };
  if (who.caller === "nobody") return { response: appError("Sign in first.", 401) };
  if (who.caller === "guest") return { response: appError("Guests don't have an account.", 403) };
  return { user: who.user, accessToken: who.accessToken };
}

/**
 * What a server action's redirect() or notFound() becomes for the app: the
 * page the website would have gone to, or "not found". Anything else is
 * thrown again.
 */
export function navigationFromError(error: unknown): { redirect: string } | { notFound: true } {
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest: unknown }).digest) : "";
  // redirect() throws "NEXT_REDIRECT;<type>;<url>;<status>;" (next/navigation).
  if (digest.startsWith("NEXT_REDIRECT;")) return { redirect: digest.split(";")[2] ?? "/" };
  // notFound() throws "NEXT_HTTP_ERROR_FALLBACK;404".
  if (digest === "NEXT_HTTP_ERROR_FALLBACK;404") return { notFound: true };
  throw error;
}

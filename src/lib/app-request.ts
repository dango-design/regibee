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

import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const appRequest = new AsyncLocalStorage<{ accessToken: string; user: User }>();

/** The app user's access token, while a request from the app is being handled. */
export function appAccessToken(): string | null {
  return appRequest.getStore()?.accessToken ?? null;
}

/** Runs `run` as the app's user: createClient() then acts as them. */
export function runAsAppUser<T>(accessToken: string, user: User, run: () => Promise<T>): Promise<T> {
  return appRequest.run({ accessToken, user }, run);
}

/**
 * A Supabase client that acts as the app's user, under the same access rules
 * (RLS) as the website's cookie client. It has no stored session, so
 * auth.getUser() is pointed at the access token.
 */
export function appUserClient(accessToken: string): SupabaseClient {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // The user was checked when the request came in, so each call doesn't ask
  // Supabase's auth server again.
  const user = appRequest.getStore()?.user;
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

type AppAuth =
  | { user: User; accessToken: string; response?: undefined }
  | { response: NextResponse; user?: undefined; accessToken?: undefined };

/**
 * The account behind a request from the app, or a response refusing it. Only
 * the Authorization header counts: cookies are ignored, so a web page can't
 * make these requests with someone's website session.
 */
export async function authenticateApp(request: Request): Promise<AppAuth> {
  const accessToken = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!accessToken) return { response: appError("Sign in first.", 401) };
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await anon.auth.getUser(accessToken);
  if (error || !data.user) return { response: appError("Sign in first.", 401) };
  // Guests get anonymous sessions when they reserve a gift. Those aren't accounts.
  if (data.user.is_anonymous) return { response: appError("Guests don't have an account.", 403) };
  return { user: data.user, accessToken };
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

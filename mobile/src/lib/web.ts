// Website pages inside the app. Other people's lists, profiles and
// invitations are website pages: the app shows them in its own web view
// (src/app/web.tsx), signed in as this account, so they work the way they do
// for the account on the website.

import { router } from "expo-router";

import { isWebViewPath, safeAppPath } from "@shared/in-app";

import { SITE_URL, supabase } from "@/lib/supabase";

/** Opens a page of the website, such as "/r/<slug>", inside the app. */
export function openSite(path: string) {
  router.push({ pathname: "/web", params: { path: sitePath(path) } });
}

/** A website address or path, as a path on the website. */
export function sitePath(pathOrUrl: string): string {
  const path = pathOrUrl.startsWith(SITE_URL) ? pathOrUrl.slice(SITE_URL.length) || "/" : pathOrUrl;
  return safeAppPath(path);
}

// The web view stays signed in only while this access token lasts (see
// src/app/api/app/open/route.ts on the website). Get a new one when the
// current one has less than this left.
const FRESH_FOR_SECONDS = 20 * 60;

/** This session's access token with a while left on it, or null when signed out. */
export async function freshAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const left = (session.expires_at ?? 0) - Date.now() / 1000;
  if (left > FRESH_FOR_SECONDS) return session.access_token;
  const refreshed = await supabase.auth.refreshSession();
  return refreshed.data.session?.access_token ?? session.access_token;
}

/** The address that signs the web view in and then shows `path`. */
export function signedInAddress(path: string): string {
  return `${SITE_URL}/api/app/open?next=${encodeURIComponent(sitePath(path))}`;
}

/**
 * The website path in a link someone was sent, such as
 * https://www.regibee.com/r/<slug> or regibee://e/<slug>, when it's a page the
 * app shows. Null for anything else.
 */
export function sitePathFromLink(link: string): string | null {
  const text = link.trim();
  const rest = text.startsWith(SITE_URL)
    ? text.slice(SITE_URL.length)
    : text.replace(/^regibee:\/\/\/?/i, "/").replace(/^(https?:\/\/)?(www\.)?regibee\.com/i, "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(rest)) return null;
  const path = rest.startsWith("/") ? rest : `/${rest}`;
  return isWebViewPath(path.split(/[?#]/)[0]) ? safeAppPath(path) : null;
}

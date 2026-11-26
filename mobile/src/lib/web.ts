// Website pages inside the app. Pages for guests and followers open as the
// app's own screens where it has one (nativeRoute below), and otherwise in
// its web view (src/app/web.tsx), signed in as this account, so they work the
// way they do for the account on the website. The plan for the rest is in
// docs/native-guest-screens.md.

import { router, type Href } from "expo-router";

import { isWebViewPath, safeAppPath } from "@shared/in-app";

import { SITE_URL, supabase } from "@/lib/supabase";

/** A value from a query string, decoded, or undefined. */
function queryValue(query: string, name: string): string | undefined {
  const raw = query.match(new RegExp(`(?:^|&)${name}=([^&]*)`))?.[1];
  if (raw === undefined) return undefined;
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return undefined;
  }
}

/** A list's slug from a gift link's `to`: a slug, or a link to /r/<slug>. */
function listSlugFrom(to: string): string | null {
  const fromPath = to.match(/(?:^|\/)r\/([a-z0-9][a-z0-9-]{0,120})(?:[/?#]|$)/i);
  if (fromPath) return fromPath[1].toLowerCase();
  return /^[a-z0-9][a-z0-9-]{2,120}$/i.test(to) ? to.toLowerCase() : null;
}

/**
 * The app's own screen for a website page, or null when it shows the page in
 * the web view. Each native screen lives at the website's own path, so a
 * link from outside can open it as it is.
 *
 * - /e/<slug>, with the guest's ?g=<token>: the invitation (src/app/e/[slug].tsx).
 * - /r/<slug>: someone else's list (src/app/r/[slug].tsx). Not with a signed
 *   buyer link (?email=&sig=) or a step from a gift email (?gift=&step=):
 *   the web view still handles those.
 * - /e/<event>/gifts?g=<token>&to=<list>, a gift link on a guest's
 *   invitation: the list, with the event and token, so a gift is matched to
 *   the guest's RSVP.
 *
 * Signed in or out: the screens work without an account, as the website's
 * pages do (the guest calls in src/lib/api.ts).
 */
export function nativeRoute(path: string): Href | null {
  const [beforeHash] = path.split("#");
  const [pathname, query = ""] = beforeHash.split("?");
  const giftLink = pathname.match(/^\/e\/([^/]+)\/gifts\/?$/);
  if (giftLink) {
    const slug = listSlugFrom(queryValue(query, "to") ?? "");
    if (!slug) return null;
    const token = queryValue(query, "g");
    const event = decodeURIComponent(giftLink[1]);
    return token ? { pathname: "/r/[slug]", params: { slug, event, g: token } } : { pathname: "/r/[slug]", params: { slug } };
  }
  const invitation = pathname.match(/^\/e\/([^/]+)\/?$/);
  if (invitation) {
    const token = query.match(/(?:^|&)g=([^&]*)/)?.[1];
    const slug = decodeURIComponent(invitation[1]);
    return token ? { pathname: "/e/[slug]", params: { slug, g: decodeURIComponent(token) } } : { pathname: "/e/[slug]", params: { slug } };
  }
  const list = pathname.match(/^\/r\/([^/]+)\/?$/);
  if (list) {
    if (queryValue(query, "sig") !== undefined || queryValue(query, "gift") !== undefined) return null;
    return { pathname: "/r/[slug]", params: { slug: decodeURIComponent(list[1]) } };
  }
  return null;
}

/**
 * The native screen a website path opens, with its slug filled in, such as
 * "/r/<slug>", or null when it has none. Two paths with the same key open the
 * same screen: /e/<event>/gifts?to=<list> and the /r/<list> it leads to.
 */
export function nativeScreenKey(path: string): string | null {
  const route = nativeRoute(path);
  if (!route || typeof route === "string" || !("pathname" in route)) return null;
  const slug = (route.params as { slug?: string } | undefined)?.slug ?? "";
  return route.pathname.replace("[slug]", slug);
}

/**
 * The app's own path for a website page that has a native screen, for a link
 * from outside the app (+native-intent.ts), or null.
 */
export function nativePath(path: string): string | null {
  const route = nativeRoute(path);
  if (!route || typeof route === "string" || !("pathname" in route)) return null;
  const { slug, ...rest } = (route.params ?? {}) as Record<string, string>;
  const query = Object.entries(rest)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("&");
  return `${route.pathname.replace("[slug]", encodeURIComponent(slug ?? ""))}${query ? `?${query}` : ""}`;
}

/** Opens a page of the website, such as "/r/<slug>", inside the app: its own screen, or the web view. */
export function openSite(path: string) {
  const native = nativeRoute(sitePath(path));
  if (native) router.push(native);
  else openWebView(path);
}

/** Opens a page of the website in the web view, even one the app has its own screen for. */
export function openWebView(path: string, { replace = false }: { replace?: boolean } = {}) {
  const target = { pathname: "/web", params: { path: sitePath(path) } } as const;
  if (replace) router.replace(target);
  else router.push(target);
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

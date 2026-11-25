// Website pages shown inside the phone app's web view (mobile/src/app/web.tsx).
// The phone app imports this file too, so it has no imports of its own.

/** Set by /api/app/open. While it's there, the page is inside the phone app. */
export const IN_APP_COOKIE = "regibee_in_app";

/**
 * The pages the app shows in its web view: the ones guests and followers use.
 * Everything an account manages has its own screen in the app.
 */
const WEB_VIEW_PATHS = [
  "/r/",
  "/e/",
  "/u/",
  "/group-gift/",
  "/invite/",
  "/host-invite/",
  "/follow-invite/",
  "/list-request/",
  "/privacy",
];

/** Whether a path on the website is one the app shows in its web view. */
export function isWebViewPath(path: string): boolean {
  return WEB_VIEW_PATHS.some((prefix) => path === prefix || path.startsWith(prefix));
}

/**
 * A path on this site to send the web view to, or "/" for anything else. A
 * full address or "//host" would send the signed-in web view to another site.
 */
export function safeAppPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

/**
 * Where a website path belongs in the app, for a link tapped inside the web
 * view: a list's manage page and an event's host page have their own screens.
 */
export function appScreenForPath(path: string): { screen: "registry" | "event" | "group"; id: string } | { screen: "home" } | null {
  const [pathname] = path.split(/[?#]/);
  const registry = pathname.match(/^\/dashboard\/registry\/([^/]+)/);
  if (registry && registry[1] !== "new") return { screen: "registry", id: registry[1] };
  const event = pathname.match(/^\/dashboard\/events\/([^/]+)/);
  if (event && event[1] !== "new") return { screen: "event", id: event[1] };
  const group = pathname.match(/^\/dashboard\/groups\/([^/]+)/);
  if (group) return { screen: "group", id: group[1] };
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/login" || pathname === "/signup") {
    return { screen: "home" };
  }
  return null;
}

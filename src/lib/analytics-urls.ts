// Cleans page addresses before they go to PostHog (analytics).
//
// Some addresses hold a secret. The 12 random characters at the end of a list's
// slug are what keep a link-only list to the people it was sent to, and invite
// and group gift links work the same way. PostHog must never see them, so every
// address is cleaned here first: /r/<slug> becomes /r/:slug, ids become :id,
// and the query string and #hash are dropped.
//
// A new page with a secret in its address needs a line in SECRET_SEGMENTS.
//
// The website (src/instrumentation-client.ts) and the phone app
// (mobile/src/lib/analytics.ts, through @shared) both use this file, so it
// imports nothing.

/** First path segment → what to show instead of the segment after it. */
const SECRET_SEGMENTS: Record<string, string> = {
  r: ":slug",
  e: ":slug",
  u: ":profile",
  invite: ":token",
  "group-gift": ":token",
  "host-invite": ":token",
  "follow-invite": ":token",
  "list-request": ":token",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A path with its secrets and ids replaced, and no query string or hash.
 * "/r/baby-shower-abc123def456?x=1" → "/r/:slug".
 */
export function scrubPath(path: string): string {
  const bare = path.split(/[?#]/)[0] ?? "";
  const segments = bare.split("/");
  // segments[0] is "" for a path that starts with "/".
  const start = segments[0] === "" ? 1 : 0;
  // The demo pages repeat the real ones under /demo.
  const first = segments[start] === "demo" ? start + 1 : start;

  return segments
    .map((segment, index) => {
      if (index === first + 1 && SECRET_SEGMENTS[segments[first]] && segment) {
        return SECRET_SEGMENTS[segments[first]];
      }
      // /r/<slug>/gift/<purchase id>
      if (index === first + 3 && segments[first] === "r" && segments[first + 2] === "gift" && segment) {
        return ":id";
      }
      if (UUID.test(segment)) return ":id";
      return segment;
    })
    .join("/");
}

/**
 * A full address cleaned the same way: "https://regibee.com/r/<slug>?x" →
 * "https://regibee.com/r/:slug". Something that isn't an address comes back
 * as an empty string, so nothing unchecked gets through.
 */
export function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${scrubPath(parsed.pathname)}`;
  } catch {
    return "";
  }
}

/**
 * Where a visitor came from. Our own pages are cleaned like any address.
 * Another site's address keeps only its origin ("https://mail.google.com"),
 * since its path can hold anything, such as an email's id.
 */
export function scrubReferrer(referrer: string, ownOrigin: string): string {
  if (!referrer || referrer === "$direct") return referrer;
  try {
    const parsed = new URL(referrer);
    return parsed.origin === ownOrigin ? scrubUrl(referrer) : parsed.origin;
  } catch {
    return "";
  }
}

/**
 * Pages that send nothing at all. Gift ideas must stay secret, even that
 * someone keeps them, and the support pages show other people's accounts.
 * The phone app's gift idea screen is "/idea".
 */
export function isUntrackedPath(path: string): boolean {
  const bare = scrubPath(path);
  return (
    bare === "/support" ||
    bare.startsWith("/support/") ||
    bare === "/dashboard/saved/ideas" ||
    bare.startsWith("/dashboard/saved/ideas/") ||
    bare === "/idea"
  );
}

/**
 * Properties dropped from every event. A page's title can hold a list's name
 * or its owner's name, such as "Sam's baby registry".
 */
const DROPPED_PROPERTIES = new Set(["title", "$title"]);

/**
 * An event's properties with every address cleaned and page titles removed.
 * Returns a new object. `ownOrigin` is the site's own origin, for telling our
 * referrers from other sites'.
 *
 * PostHog's libraries add address properties under many names, such as
 * $current_url, $initial_pathname or $prev_pageview_url, and add more over
 * time. So this goes by the name: anything with "url" in it is cleaned as an
 * address, "pathname" or "screen_name" as a path, and "referrer" as a
 * referrer. The $set and $set_once objects get the same treatment.
 */
export function scrubEventProperties(
  properties: Record<string, unknown>,
  ownOrigin: string,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (DROPPED_PROPERTIES.has(key)) continue;
    const name = key.toLowerCase();
    if ((key === "$set" || key === "$set_once") && value && typeof value === "object" && !Array.isArray(value)) {
      clean[key] = scrubEventProperties(value as Record<string, unknown>, ownOrigin);
    } else if (typeof value !== "string") {
      clean[key] = value;
    } else if (name.includes("referrer")) {
      const referrer = scrubReferrer(value, ownOrigin);
      if (!pointsAtUntrackedPage(referrer)) clean[key] = referrer;
    } else if (name.includes("url")) {
      const url = scrubUrl(value);
      if (!pointsAtUntrackedPage(url)) clean[key] = url;
    } else if (name.includes("pathname") || name.includes("screen_name")) {
      // $prev_pageview_pathname names the page before this one, which can be
      // a gift idea or support page. Leave it out rather than say so.
      if (!isUntrackedPath(value)) clean[key] = scrubPath(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/** Whether a full address goes to a page that sends nothing. */
function pointsAtUntrackedPage(url: string): boolean {
  try {
    return isUntrackedPath(new URL(url).pathname);
  } catch {
    return false;
  }
}

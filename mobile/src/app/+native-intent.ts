// Links that open the app from outside.
//
// The iPhone share extension opens regibee://dataUrl=<key>#weburl, which isn't
// a screen, so send it to the share screen. ShareIntentProvider reads the
// shared content itself.
//
// A link to a website page the app shows in its web view, such as
// regibee://r/<slug> or https://www.regibee.com/e/<slug>, opens that page
// inside the app (src/app/web.tsx).

import { sitePathFromLink } from "@/lib/web";

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes("dataUrl=")) return "/share";
    const sitePath = sitePathFromLink(path);
    if (sitePath) return `/web?path=${encodeURIComponent(sitePath)}`;
    return path;
  } catch {
    return "/";
  }
}

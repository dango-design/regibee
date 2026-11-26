// Links that open the app from outside.
//
// The iPhone share extension opens regibee://dataUrl=<key>#weburl, which isn't
// a screen, so send it to the share screen. ShareIntentProvider reads the
// shared content itself.
//
// A link to a website page for guests and followers, such as
// regibee://r/<slug> or https://www.regibee.com/e/<slug>, opens inside the
// app: on the app's own screen at the same path when it has one (nativePath
// in src/lib/web.ts), and otherwise in the web view (src/app/web.tsx).

import { nativePath, sitePathFromLink } from "@/lib/web";

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes("dataUrl=")) return "/share";
    const sitePath = sitePathFromLink(path);
    const native = sitePath ? nativePath(sitePath) : null;
    if (native) return native;
    if (sitePath) return `/web?path=${encodeURIComponent(sitePath)}`;
    return path;
  } catch {
    return "/";
  }
}

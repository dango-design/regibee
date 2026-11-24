"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// How long a click may go without a new page before the bar gives up, such as
// when a link's own handler cancelled the navigation.
const GIVE_UP_MS = 15_000;
// A page that arrives sooner than this never shows the bar, so quick
// navigations don't flash it.
const SHOW_AFTER_MS = 120;

/** The link a click will follow to another page of this site, if any. */
function pageLinkFor(event: MouseEvent): URL | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!link || link.hasAttribute("download")) return null;
  if (link.target && link.target !== "_self") return null;

  const to = new URL(link.href, window.location.href);
  if (to.origin !== window.location.origin) return null;
  // Same page: a link to a part of it (#section), or to itself.
  if (to.pathname === window.location.pathname && to.search === window.location.search) return null;
  return to;
}

/**
 * A thin bar across the top of the window that fills while the next page
 * loads. It starts when someone clicks a link to another page of the site and
 * ends when that page shows, so every click gets an answer even on a slow
 * connection or a page with no loading screen of its own.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!pageLinkFor(event)) return;
      clearTimers();
      timers.current.push(
        setTimeout(() => setState("loading"), SHOW_AFTER_MS),
        setTimeout(() => setState("idle"), GIVE_UP_MS),
      );
    }
    // Capture, so a link that stops the click from bubbling still counts.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  // The address changed: the new page, or its loading screen, is showing.
  useEffect(() => {
    clearTimers();
    setState((current) => (current === "loading" ? "done" : "idle"));
    timers.current.push(setTimeout(() => setState("idle"), 300));
  }, [pathname, search]);

  return (
    <div
      aria-hidden="true"
      data-state={state}
      className="navigation-progress pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div className="navigation-progress-bar h-full origin-left bg-brand-600" />
    </div>
  );
}

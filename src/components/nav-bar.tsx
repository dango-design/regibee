"use client";

import { lazy } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

// Only signed-in people see the account menu, so it's a separate download.
// It still renders on the server.
//
// Use React's lazy here, not next/dynamic. In the browser, the lazy menu
// pauses hydration until its code arrives. If React picks up again by
// replaying the paused component, it drops that component's place in a list
// of siblings, and every react-aria id inside comes out different from the
// server's HTML. next/dynamic renders the lazy component as the second of two
// siblings, so the menu button got the wrong id: a hydration warning, and an
// open menu labelled by an id that wasn't on the page. Here it's an only
// child, with no place in a list to lose. Keep it that way.
const AccountMenu = lazy(() => import("@/components/account-menu").then((m) => ({ default: m.AccountMenu })));

export interface NavAccount {
  name: string;
  /** Link to the account's profile page. */
  profilePath: string;
  /** The profile photo. Without one, the menu button shows the name's initials. */
  photoUrl?: string | null;
  email: string | null;
  followRequestCount: number;
  /** On the support team: the menu links to /support (src/lib/support.ts). */
  support?: boolean;
}

// Signed-in people get just the logo and their account menu. The logo goes to
// the dashboard, where My registries, Events and Following are tabs
// (src/components/dashboard-tabs.tsx).
export function NavBar({
  account,
  demo = false,
  returnTo,
}: {
  account: NavAccount | null;
  /** The demo's bar: links stay under /demo, and signing out just leaves. */
  demo?: boolean;
  /**
   * Where Log in and Sign up come back to, such as a guest's own event link.
   * Left out, they go to the dashboard.
   */
  returnTo?: string;
}) {
  const basePath = demo ? "/demo" : "";
  const back = returnTo ? `?redirect=${encodeURIComponent(returnTo)}` : "";
  return (
    <header className="sticky top-0 z-50 w-full border-b border-secondary bg-primary/95 backdrop-blur supports-[backdrop-filter]:bg-primary/80">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary focus:shadow-lg focus:outline-2 focus:outline-focus-ring"
      >
        Skip to main content
      </a>

      <div className="container mx-auto flex h-16 items-center gap-6 px-4">
        <Link
          href={account ? `${basePath}/dashboard` : "/"}
          className="flex items-center gap-2 rounded-md font-semibold text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Logo />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {account ? (
            <AccountMenu account={account} basePath={basePath} demo={demo} />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/login${back}`}>Log in</Link>
              </Button>
              <Button
                size="sm"
                asChild
              >
                <Link href={`/signup${back}`}>Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

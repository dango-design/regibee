"use client";

import { useEffect, useState } from "react";
import { isStaleDeployError, reloadForNewDeploy } from "@/lib/stale-deploy";
import { fontVariables } from "./fonts";
import "./globals.css";

// Shows when an error reaches the top of the app. Without this file, Next.js
// shows a bare "Application error" page. It replaces the root layout, so it
// renders its own <html> and <body>.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const stale = isStaleDeployError(error);
  const [reloading, setReloading] = useState(stale);

  useEffect(() => {
    if (stale && !reloadForNewDeploy()) setReloading(false);
  }, [stale]);

  return (
    <html lang="en" className={fontVariables}>
      <head>
        <title>Regibee</title>
      </head>
      <body className="font-sans antialiased bg-primary">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          {reloading ? (
            <p className="text-md text-secondary">Regibee was updated. Reloading…</p>
          ) : (
            <>
              <h1 className="font-display text-display-xs font-semibold text-primary">Something went wrong</h1>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-primary_on-brand"
              >
                Reload the page
              </button>
            </>
          )}
        </main>
      </body>
    </html>
  );
}

"use client";

import { useEffect } from "react";
import { isStaleDeployError, reloadForNewDeploy } from "@/lib/stale-deploy";

/**
 * Reloads the page when a server action fails because the site was deployed
 * after the page loaded. This covers actions called from click handlers,
 * whose errors don't reach an error page. `global-error.tsx` covers the rest.
 */
export function StaleDeployReload() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleDeployError(event.reason)) reloadForNewDeploy();
    };
    const onError = (event: ErrorEvent) => {
      if (isStaleDeployError(event.error)) reloadForNewDeploy();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}

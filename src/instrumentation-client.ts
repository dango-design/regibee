// Starts PostHog (analytics) in the browser. Next.js runs this file once, before
// the page becomes interactive.
//
// The browser only sends page views and a few named clicks (trackClick in
// src/lib/analytics-client.ts). It never says which account is signed in:
// what accounts do is counted on the server (src/lib/analytics-server.ts).
// See "Analytics" in CLAUDE.md.
//
// What keeps it private:
// - Cookieless mode: PostHog stores nothing in the browser. Its servers tell
//   visitors apart with a daily hash instead. "Enable cookieless tracking"
//   must be on in the PostHog project's settings, or PostHog drops the events.
// - Every address goes through src/lib/analytics-urls.ts first, which hides
//   list slugs, invite tokens and ids, and drops page titles.
// - Gift idea and support pages send nothing, and neither does a browser that
//   sends Do Not Track (the privacy policy says so).
// - No autocapture, no session recording, no surveys, and no scripts loaded
//   from PostHog after this one.
//
// Events go to /ingest on our own domain, which next.config.ts passes on to
// PostHog, so ad blockers don't drop them.

import posthog from "posthog-js";
import { isUntrackedPath, scrubEventProperties } from "@/lib/analytics-urls";
import { IN_APP_COOKIE } from "@/lib/in-app";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// The phone app's web view counts its own screens (mobile/src/lib/analytics.ts).
const inApp = typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith(`${IN_APP_COOKIE}=`));

if (key && !inApp) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    cookieless_mode: "always",
    person_profiles: "never",
    capture_pageview: "history_change",
    capture_pageleave: false,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    // No feature flags, so skip the request for them and the remote settings
    // that come with it. Only what's set here applies.
    advanced_disable_flags: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    mask_personal_data_properties: true,
    respect_dnt: true,
    before_send: (event) => {
      if (!event) return null;
      if (isUntrackedPath(window.location.pathname)) return null;
      const origin = window.location.origin;
      return {
        ...event,
        properties: scrubEventProperties(event.properties ?? {}, origin),
        ...(event.$set ? { $set: scrubEventProperties(event.$set, origin) } : {}),
        ...(event.$set_once ? { $set_once: scrubEventProperties(event.$set_once, origin) } : {}),
      };
    },
  });
}

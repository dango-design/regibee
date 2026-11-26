// Sends screen views and app opens to PostHog (analytics).
//
// What people create and give is counted on the website's server
// (src/lib/analytics-server.ts), since the app runs the website's server
// actions. This only adds how people move around the app. See "Analytics" in
// the root CLAUDE.md.
//
// - Screens are named by their path, cleaned by @shared/analytics-urls, so
//   "item/<id>" goes as "/item/:id". The gift idea screen sends nothing.
// - After sign-in, the account is identified by its Supabase user id only,
//   the same id the server uses, so both land on one person. Never send an
//   email, a name or anything about a gift idea.
// - No touch capture, session replay, surveys or feature flags.
//
// EXPO_PUBLIC_POSTHOG_KEY comes from the build's EAS environment: production
// builds send to the main PostHog project, preview and testing builds to a
// second one, and development builds without the variable send nothing.

import { usePathname } from "expo-router";
import PostHog from "posthog-react-native";
import { useEffect } from "react";
import { Platform } from "react-native";

import { isUntrackedPath, scrubEventProperties, scrubPath } from "@shared/analytics-urls";
import { SITE_URL } from "@/lib/supabase";

const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;

export const analytics: PostHog | null =
  key && Platform.OS !== "web"
    ? new PostHog(key, {
        host: "https://us.i.posthog.com",
        captureAppLifecycleEvents: true,
        personProfiles: "identified_only",
        enableSessionReplay: false,
        disableSurveys: true,
        disableRemoteConfig: true,
        preloadFeatureFlags: false,
        sendFeatureFlagEvent: false,
        before_send: (event) => {
          if (!event) return null;
          type Properties = NonNullable<typeof event.properties>;
          const scrub = (properties: Properties) => scrubEventProperties(properties, SITE_URL) as Properties;
          return {
            ...event,
            properties: { ...scrub(event.properties ?? {}), platform: "app" },
            ...(event.$set ? { $set: scrub(event.$set) } : {}),
            ...(event.$set_once ? { $set_once: scrub(event.$set_once) } : {}),
          };
        },
      })
    : null;

/** Sends a screen view each time the app's route changes. */
export function useScreenViews(): void {
  const pathname = usePathname();
  useEffect(() => {
    if (!analytics || !pathname || isUntrackedPath(pathname)) return;
    void analytics.screen(scrubPath(pathname));
  }, [pathname]);
}

/**
 * Ties this phone's events to the signed-in account, by user id only, and
 * starts a new anonymous id on sign-out. The demo account counts as signed out.
 */
export function useAnalyticsAccount(userId: string | null): void {
  useEffect(() => {
    if (!analytics) return;
    if (userId) analytics.identify(userId);
    else analytics.reset();
  }, [userId]);
}

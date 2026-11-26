import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The end-to-end tests run their own dev server against the local database
  // (see e2e/README.md). Its own folder keeps it from sharing compiled files,
  // which hold the Supabase address, with a dev server that uses production.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // PostHog (analytics) events from the browser go to /ingest on our own
  // domain, and these pass them on to PostHog's US servers. Ad blockers drop
  // requests to PostHog's own domains. See src/instrumentation-client.ts.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/array/:path*", destination: "https://us-assets.i.posthog.com/array/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  // PostHog's API paths end in a slash, which Next.js would otherwise redirect.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

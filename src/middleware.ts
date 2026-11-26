import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.webmanifest (web app manifest, see src/app/manifest.ts)
     * - public files (public folder)
     * - ingest (analytics events passed on to PostHog, see next.config.ts)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|ingest/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

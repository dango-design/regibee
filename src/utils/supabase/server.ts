import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { appAccessToken, appUserClient } from "@/lib/app-request";

export async function createClient() {
  // A request from the phone app (src/app/api/app) acts as the app's user,
  // from its access token, instead of the website's cookies.
  const accessToken = appAccessToken();
  if (accessToken) return appUserClient(accessToken);

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticateApp } from "@/lib/app-request";
import { IN_APP_COOKIE, safeAppPath } from "@/lib/in-app";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/app/open?next=/r/<slug>, with the app's access token as
// "Authorization: Bearer <token>".
//
// The phone app shows other people's lists, profiles and invitations as
// website pages, in a web view inside the app (mobile/src/app/web.tsx). This
// route signs that web view in as the app's user, then sends it to the page.
// So the person sees the page as their own account does: follower-only lists,
// their own private list's preview, forms filled in from their account.
//
// It saves the app's access token as the website's session cookie. It doesn't
// take the app's refresh token: two places using one refresh token end each
// other's session. So the web view stays signed in until the access token
// runs out, about an hour at most, and the app sends a fresh one each time it
// opens a page.
//
// Without a token, it signs the web view out instead, so a page opened while
// the app is signed out never shows the last account.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeAppPath(url.searchParams.get("next"));
  const supabase = await createClient();
  const cookieStore = await cookies();

  if (request.headers.get("authorization")) {
    const auth = await authenticateApp(request);
    if (auth.response) return auth.response;
    const { error } = await supabase.auth.setSession({
      access_token: auth.accessToken,
      // Not a real refresh token, on purpose (see above).
      refresh_token: "from-the-app",
    });
    if (error) {
      console.error("[app] couldn't sign the web view in:", error.message);
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
  } else {
    await supabase.auth.signOut({ scope: "local" });
  }

  // The website's top bar hides itself while this is set (src/components/nav.tsx).
  cookieStore.set(IN_APP_COOKIE, "1", { path: "/", sameSite: "lax", secure: url.protocol === "https:" });
  return NextResponse.redirect(new URL(next, url.origin));
}

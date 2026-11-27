import { NextResponse, after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { track } from "@/lib/analytics-server";
import { sendWelcomeEmail } from "@/lib/email";

// A sign-up email's link is used within seconds of confirming the address.
// Anything older is a sign-in that came through here for another reason.
const JUST_CONFIRMED_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Password recovery flows should always go to the reset page
      if (type === "recovery" || next === "/reset-password") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      const confirmedAt = data.user?.email_confirmed_at ? Date.parse(data.user.email_confirmed_at) : NaN;
      if (data.user && Date.now() - confirmedAt < JUST_CONFIRMED_MS) {
        track("account_confirmed", { userId: data.user.id }, {});
        // Once per account: sendWelcomeEmail claims it before sending.
        const userId = data.user.id;
        after(() => sendWelcomeEmail(userId));
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code exchange fails, redirect to login with error
  return NextResponse.redirect(`${origin}/login`);
}

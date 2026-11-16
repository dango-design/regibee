import { NextResponse, type NextRequest } from "next/server";
import { checkAuthEmails } from "@/lib/auth-email-alert-server";

export const dynamic = "force-dynamic";

// A pg_cron job in Supabase calls this every 5 minutes
// (supabase/migrations/20261116074313_auth_email_alerts.sql). Vercel Cron
// isn't used because, on Vercel's Hobby plan, it runs a job once a day at
// most. The job sends CRON_SECRET as a bearer token, as Vercel Cron does.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET isn't set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkAuthEmails();
  return NextResponse.json(result);
}

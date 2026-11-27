import { NextResponse, type NextRequest } from "next/server";
import { processEventReminders, processExchangeReminders, processRsvpReminders } from "@/lib/event-reminders-server";

export const dynamic = "force-dynamic";

// Vercel Cron calls this once a day (see vercel.json) to email everyone going
// to tomorrow's events, remind guests who haven't replied, and remind Secret
// Santas to get their gift (src/lib/event-reminders-server.ts). Vercel sends the CRON_SECRET env var as a bearer
// token, so without it nothing runs.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET isn't set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The jobs don't depend on each other, so one failing doesn't stop the others.
  const failed = (job: string) => (err: unknown) => {
    console.error(`[cron] Failed to send ${job}:`, err);
    return { events: 0, emails: 0 };
  };
  const [dayBefore, rsvp, exchange] = await Promise.all([
    processEventReminders().catch(failed("day-before reminders")),
    processRsvpReminders().catch(failed("RSVP reminders")),
    processExchangeReminders().catch(failed("gift exchange reminders")),
  ]);
  return NextResponse.json({ ...dayBefore, rsvp, exchange });
}

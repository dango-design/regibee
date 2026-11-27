import { NextResponse, type NextRequest } from "next/server";
import { processGiftReservations } from "@/lib/gift-reservations-server";
import { revealGiftsAfterEvents } from "@/lib/gift-reveals-server";
import { processGiftDigests, processThanksReminders } from "@/lib/gift-digest-server";

export const dynamic = "force-dynamic";

// Vercel Cron calls this once a day (see vercel.json): it releases gift
// reservations that ran out, reveals hidden gifts the day after an event
// (src/lib/gift-reveals-server.ts), and sends the daily gift summaries and
// thank-you reminders (src/lib/gift-digest-server.ts). Vercel sends the CRON_SECRET env var as a
// bearer token, so without it nothing runs.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET isn't set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The jobs don't depend on each other, so one failing doesn't stop the others.
  const [reservations, reveals, digests, thanks] = await Promise.all([
    processGiftReservations(),
    revealGiftsAfterEvents().catch((err) => {
      console.error("[cron] Failed to reveal gifts:", err);
      return { revealed: 0, emailed: 0 };
    }),
    processGiftDigests().catch((err) => {
      console.error("[cron] Failed to send daily gift summaries:", err);
      return { digests: 0 };
    }),
    processThanksReminders().catch((err) => {
      console.error("[cron] Failed to send thank-you reminders:", err);
      return { thanks: 0 };
    }),
  ]);
  return NextResponse.json({ ...reservations, reveals, ...digests, ...thanks });
}

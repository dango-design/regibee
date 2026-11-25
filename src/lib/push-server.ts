// Server-only: sends push notifications to the phone app through Expo's push
// service, next to the emails in mailer.ts. See push.ts for the rules.
//
// Pushes don't count against the email limits (src/lib/account-levels.ts):
// Expo doesn't charge for them, and they only go to accounts that turned
// them on in the app, never to an address someone typed in.

import { supabaseAdmin } from "./supabase-admin";
import { expoMessages, unregisteredTokens, type ExpoPushTicket, type PushNotice } from "./push";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Sends one notice to every phone the accounts turned notifications on for.
 * Never throws: a push that fails is logged and skipped, like an email.
 */
export async function sendPush(userIds: string[], notice: PushNotice): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const { data, error } = await supabaseAdmin.from("push_tokens").select("token").in("user_id", ids);
    if (error) {
      // Before the push_tokens migration runs, there's nothing to send to.
      console.error("[push] Couldn't read push tokens:", error.message);
      return;
    }
    const tokens = (data ?? []).map((row) => row.token as string);
    if (tokens.length === 0) return;

    const gone: string[] = [];
    for (const batch of expoMessages(tokens, notice)) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          // Only needed if "enhanced push security" is turned on for the Expo project.
          ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        console.error(`[push] Expo answered ${response.status}:`, await response.text().catch(() => ""));
        continue;
      }
      const result = (await response.json().catch(() => null)) as { data?: ExpoPushTicket[] } | null;
      const tickets = result?.data ?? [];
      for (const ticket of tickets) {
        if (ticket.status === "error" && ticket.details?.error !== "DeviceNotRegistered") {
          console.error("[push] Expo refused a push:", ticket.details?.error ?? ticket.message);
        }
      }
      gone.push(...unregisteredTokens(batch, tickets));
    }

    if (gone.length > 0) {
      const { error: deleteError } = await supabaseAdmin.from("push_tokens").delete().in("token", gone);
      if (deleteError) console.error("[push] Couldn't remove old push tokens:", deleteError.message);
    }
  } catch (err) {
    console.error("[push] Failed to send:", err);
  }
}

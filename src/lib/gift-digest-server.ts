// Server-only: the daily gift emails. A manager who chose "Once a day" for
// gift emails gets one summary of the day's gifts instead of an email per
// gift, and every list's managers get a thank-you reminder a few days after
// the list's date. The rules are in src/lib/gift-emails.ts. The daily cron
// route src/app/api/cron/gift-reservations runs both.
//
// Every query is filtered by a manager's queued rows, a list's id, or a date.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/mailer";
import { giftNewsManagers } from "@/lib/email";
import { giftDigestHtml, thanksReminderHtml, type GiftSummaryRow } from "@/lib/email-templates";
import {
  THANKS_REMINDER_DAYS,
  THANKS_REMINDER_LATE_DAYS,
  digestSubject,
  groupDigest,
  parseGiftEmails,
  shiftDate,
  thanksReminderDue,
  type DigestGift,
} from "@/lib/gift-emails";
import { hidesReservations, SECRET_GIVER_NAME } from "@/lib/gifts";

const FROM = "Regibee <notifications@regibee.com>";
const TEST_RECIPIENT_OVERRIDE = process.env.RESEND_TEST_RECIPIENT;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

const SETTINGS_PATH = "/dashboard/account#gift-emails";

/** Full URL for a photo, since mail apps can't load "/hero/x.svg". */
function absolute(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? `${siteUrl()}${url}` : null;
}

interface PurchaseRow {
  id: string;
  status: string;
  quantity: number;
  amount: number | null;
  message: string | null;
  hide_giver: boolean;
  buyer_name: string;
  registry_item_id: string | null;
  cash_fund_id: string | null;
}

/** What each purchase was for: its item or fund's title, photo and price. */
async function giftDetails(purchases: PurchaseRow[]) {
  const itemIds = [...new Set(purchases.map((p) => p.registry_item_id).filter(Boolean))] as string[];
  const fundIds = [...new Set(purchases.map((p) => p.cash_fund_id).filter(Boolean))] as string[];
  const [{ data: items }, { data: funds }] = await Promise.all([
    itemIds.length
      ? supabaseAdmin.from("registry_items").select("id, title, image_url, price, is_parent_purchased").in("id", itemIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    fundIds.length
      ? supabaseAdmin.from("cash_funds").select("id, title").in("id", fundIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  return {
    items: new Map((items ?? []).map((i) => [i.id as string, i])),
    funds: new Map((funds ?? []).map((f) => [f.id as string, f])),
  };
}

function summaryRow(
  purchase: PurchaseRow,
  details: Awaited<ReturnType<typeof giftDetails>>,
  shownName: string,
): GiftSummaryRow | null {
  if (purchase.cash_fund_id) {
    const fund = details.funds.get(purchase.cash_fund_id);
    if (!fund) return null;
    return {
      shownName,
      title: fund.title as string,
      kind: "fund",
      quantity: 1,
      amount: purchase.amount != null ? Number(purchase.amount) : null,
      message: purchase.message,
      imageUrl: null,
    };
  }
  const item = purchase.registry_item_id ? details.items.get(purchase.registry_item_id) : undefined;
  if (!item) return null;
  const covered = Boolean(item.is_parent_purchased);
  return {
    shownName,
    title: item.title as string,
    kind: covered ? "covered" : "given",
    quantity: purchase.quantity,
    amount: covered && item.price != null ? Number(item.price) * purchase.quantity : null,
    message: purchase.message,
    imageUrl: absolute(item.image_url as string | null),
  };
}

const PURCHASE_COLUMNS = "id, status, quantity, amount, message, hide_giver, buyer_name, registry_item_id, cash_fund_id";

// ── Daily summary ────────────────────────────────────────────

/**
 * Sends each manager who chose "Once a day" one email with the gifts queued
 * for them, then deletes those rows. A gift the guest undid since is left
 * out. Returns how many summaries went out.
 */
export async function processGiftDigests(now = new Date()): Promise<{ digests: number }> {
  const { data: rows, error } = await supabaseAdmin
    .from("gift_email_digest")
    .select("id, user_id, registry_id, purchase_id, kind, shown_name")
    .lte("created_at", now.toISOString())
    .order("id");
  if (error) throw new Error(`Couldn't read the daily gift summaries: ${error.message}`);

  const byUser = new Map<string, typeof rows>();
  for (const row of rows ?? []) {
    const list = byUser.get(row.user_id as string) ?? [];
    list.push(row);
    byUser.set(row.user_id as string, list);
  }

  let digests = 0;
  for (const [userId, queued] of byUser) {
    try {
      const [{ data: purchases }, { data: registries }, { data: profile }, { data: auth }] = await Promise.all([
        supabaseAdmin.from("purchases").select(PURCHASE_COLUMNS).in("id", queued.map((r) => r.purchase_id as string)),
        supabaseAdmin.from("registries").select("id, title").in("id", [...new Set(queued.map((r) => r.registry_id as string))]),
        supabaseAdmin.from("profiles").select("gift_emails").eq("id", userId).maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(userId),
      ]);
      const purchaseById = new Map(((purchases ?? []) as PurchaseRow[]).map((p) => [p.id, p]));
      const details = await giftDetails((purchases ?? []) as PurchaseRow[]);
      const gifts: DigestGift[] = [];
      for (const row of queued) {
        const purchase = purchaseById.get(row.purchase_id as string);
        if (!purchase || purchase.status === "cancelled") continue;
        const summary = summaryRow(purchase, details, row.shown_name as string);
        if (summary) gifts.push({ ...summary, registryId: row.registry_id as string });
      }
      const titles = new Map((registries ?? []).map((r) => [r.id as string, r.title as string]));
      const lists = groupDigest(gifts, titles);
      const email = auth.user?.email;
      // Someone who turned gift emails off since gets nothing.
      if (lists.length > 0 && email && parseGiftEmails(profile?.gift_emails) !== "off") {
        await sendEmail({
          from: FROM,
          to: TEST_RECIPIENT_OVERRIDE || email,
          subject: digestSubject(lists),
          headers: { "List-Unsubscribe": `<${siteUrl()}${SETTINGS_PATH}>` },
          html: giftDigestHtml({
            lists: lists.map((l) => ({
              title: l.title,
              url: `${siteUrl()}/dashboard/registry/${l.registryId}?tab=purchases`,
              gifts: l.gifts,
            })),
            settingsUrl: `${siteUrl()}${SETTINGS_PATH}`,
          }),
        });
        digests++;
      }
      await supabaseAdmin.from("gift_email_digest").delete().in("id", queued.map((r) => r.id as number));
    } catch (err) {
      // The rows stay, so tomorrow's run tries again.
      console.error("[gift digest] Failed to send a daily summary:", err);
    }
  }
  return { digests };
}

// ── Thank-you reminder ───────────────────────────────────────

/** The gifts guests said they gave from a list: its own items and its gift funds. */
async function givenGifts(registryId: string): Promise<PurchaseRow[]> {
  const [{ data: onItems }, { data: onFunds }] = await Promise.all([
    supabaseAdmin
      .from("purchases")
      .select(`${PURCHASE_COLUMNS}, registry_items!registry_item_id!inner(registry_id)`)
      .eq("registry_items.registry_id", registryId)
      .eq("status", "purchased")
      .order("created_at"),
    supabaseAdmin
      .from("purchases")
      .select(`${PURCHASE_COLUMNS}, cash_funds!cash_fund_id!inner(registry_id)`)
      .eq("cash_funds.registry_id", registryId)
      .eq("status", "purchased")
      .order("created_at"),
  ]);
  return [...((onItems ?? []) as unknown as PurchaseRow[]), ...((onFunds ?? []) as unknown as PurchaseRow[])];
}

/**
 * Sends each list's managers the thank-you reminder once for the list's
 * date, a few days after it. Returns how many lists got one.
 */
export async function processThanksReminders(now = new Date()): Promise<{ thanks: number }> {
  const today = now.toISOString().slice(0, 10);
  const { data: lists, error } = await supabaseAdmin
    .from("registries")
    .select("id, title, settings, event_date, thanks_reminded_for")
    .lte("event_date", shiftDate(today, -THANKS_REMINDER_DAYS))
    .gte("event_date", shiftDate(today, -THANKS_REMINDER_DAYS - THANKS_REMINDER_LATE_DAYS));
  if (error) throw new Error(`Couldn't read lists for thank-you reminders: ${error.message}`);

  let thanks = 0;
  for (const list of lists ?? []) {
    try {
      const hidden = hidesReservations(list.settings);
      const gifts = hidden ? [] : await givenGifts(list.id as string);
      const due = thanksReminderDue(
        {
          event_date: list.event_date as string | null,
          thanks_reminded_for: list.thanks_reminded_for as string | null,
          hidesReservations: hidden,
          giftCount: gifts.length,
        },
        today,
      );
      if (!due) continue;

      // Claim it first, so two runs can't both send it.
      const { data: claimed } = await supabaseAdmin
        .from("registries")
        .update({ thanks_reminded_for: list.event_date })
        .eq("id", list.id)
        .or(`thanks_reminded_for.is.null,thanks_reminded_for.neq.${list.event_date}`)
        .select("id");
      if (!claimed || claimed.length === 0) continue;

      const details = await giftDetails(gifts);
      const rows = gifts
        .map((p) => summaryRow(p, details, p.hide_giver ? SECRET_GIVER_NAME : p.buyer_name))
        .filter((r): r is GiftSummaryRow => r !== null);
      const managers = (await giftNewsManagers(list.id as string)).filter((m) => m.giftEmails !== "off");
      for (const manager of managers) {
        await sendEmail({
          from: FROM,
          to: TEST_RECIPIENT_OVERRIDE || manager.email,
          subject: `Say thanks for your gifts from ${list.title}`,
          headers: { "List-Unsubscribe": `<${siteUrl()}${SETTINGS_PATH}>` },
          html: thanksReminderHtml({
            registryTitle: list.title as string,
            gifts: rows,
            listUrl: `${siteUrl()}/dashboard/registry/${list.id}?tab=purchases`,
            settingsUrl: `${siteUrl()}${SETTINGS_PATH}`,
          }),
        });
      }
      thanks++;
    } catch (err) {
      console.error("[thanks] Failed to send a thank-you reminder:", err);
    }
  }
  return { thanks };
}

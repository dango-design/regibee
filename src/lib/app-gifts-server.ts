// Shares a guest's gifts between the phone app and the website's pages in
// its web view. The rules are in src/lib/my-gifts-cookie.ts.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { MY_GIFTS_COOKIE, MY_GIFTS_COOKIE_OPTIONS, hasAccountGifts, purchaseIdsToCheck, syncAppGifts } from "@/lib/my-gifts-cookie";

type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: typeof MY_GIFTS_COOKIE_OPTIONS): unknown;
  delete(name: string): unknown;
};

/** Each of these purchase ids that's still a gift (not cancelled), mapped to its item id. */
async function liveGiftItems(purchaseIds: string[]): Promise<Map<string, string>> {
  const live = new Map<string, string>();
  if (purchaseIds.length === 0) return live;
  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("id, registry_item_id")
    .in("id", purchaseIds)
    .neq("status", "cancelled");
  if (error) throw new Error(`Couldn't look up the app's gifts: ${error.message}`);
  for (const row of (data ?? []) as { id: string; registry_item_id: string | null }[]) {
    if (row.registry_item_id) live.set(row.id, row.registry_item_id);
  }
  return live;
}

/**
 * Puts the app's gifts in the web view's gifts cookie, for the signed-in
 * account. Only gifts that match a live purchase on their item go in.
 */
export async function syncAppGiftsCookie(cookieStore: CookieStore, fromApp: Record<string, string>, account: string) {
  const raw = cookieStore.get(MY_GIFTS_COOKIE)?.value;
  const live = await liveGiftItems(purchaseIdsToCheck(raw, fromApp, account));
  cookieStore.set(MY_GIFTS_COOKIE, syncAppGifts({ raw, fromApp, account, live }), MY_GIFTS_COOKIE_OPTIONS);
}

/** Takes an app account's gifts out of the web view when it's opened signed out. */
export function clearAppGiftsCookie(cookieStore: CookieStore) {
  if (hasAccountGifts(cookieStore.get(MY_GIFTS_COOKIE)?.value)) cookieStore.delete(MY_GIFTS_COOKIE);
}

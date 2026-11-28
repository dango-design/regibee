import { NextResponse } from "next/server";
import { authenticateExtension, isRegistryManager, jsonError, readJson } from "@/lib/extension-server";
import { isUuid, type WishlistSyncResponse } from "@/lib/extension";
import { MAX_SYNC_ITEMS, parseImportItem, type ImportItem } from "@/lib/wishlist-import";
import { isSyncedWith, syncWishlist } from "@/lib/elfster-sync-server";

// POST { registryId, wishlistId, items, background? } → keeps the registry in
// sync with the Elfster wishlist the manager has open. It saves which item
// each wish is and how many of it have been given on Elfster, for the guest
// page (src/lib/wishlist-import.ts). The answer lists the items whose wish
// left the wishlist, and never what's been given: managers don't see that.
//
// With `background: true`, the extension read the wishlist on its own, for
// the list's page (src/components/elfster-sync.tsx). Then it only syncs a list
// that's already kept in sync with the wishlist: a sync someone stopped
// stays stopped.
export async function POST(request: Request) {
  const auth = await authenticateExtension(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  const body = await readJson(request);
  const registryId = body?.registryId;
  const wishlistId = body?.wishlistId;
  const rawItems = body?.items;
  if (!isUuid(registryId) || !isUuid(wishlistId) || !Array.isArray(rawItems) || rawItems.length > MAX_SYNC_ITEMS) {
    return jsonError("Invalid request", 400);
  }
  if (!(await isRegistryManager(user.id, registryId))) {
    return jsonError("You don't manage that registry.", 403);
  }

  if (body?.background === true && !(await isSyncedWith(registryId, wishlistId).catch(() => false))) {
    return jsonError("That list isn't kept in sync with this wishlist.", 409);
  }

  const wishes = rawItems.map(parseImportItem).filter((item): item is ImportItem => item !== null);
  let response: WishlistSyncResponse;
  try {
    response = await syncWishlist(registryId, wishlistId, user.id, wishes);
  } catch (err) {
    console.error("[extension] Elfster sync failed:", err);
    return jsonError("Couldn't sync the wishlist.", 500);
  }

  return NextResponse.json(response);
}

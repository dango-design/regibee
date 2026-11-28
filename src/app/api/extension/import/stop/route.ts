import { NextResponse } from "next/server";
import { authenticateExtension, isRegistryManager, jsonError, readJson } from "@/lib/extension-server";
import { isUuid } from "@/lib/extension";
import { stopWishlistSync } from "@/lib/elfster-sync-server";

// POST { registryId, wishlistId } → stops keeping the registry in sync with
// the Elfster wishlist. What's been given on Elfster stops counting, so
// guests can choose those items again.
export async function POST(request: Request) {
  const auth = await authenticateExtension(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  const body = await readJson(request);
  const registryId = body?.registryId;
  const wishlistId = body?.wishlistId;
  if (!isUuid(registryId) || !isUuid(wishlistId)) return jsonError("Invalid request", 400);
  if (!(await isRegistryManager(user.id, registryId))) {
    return jsonError("You don't manage that registry.", 403);
  }

  try {
    await stopWishlistSync(registryId, wishlistId);
  } catch (err) {
    console.error("[extension] Stopping the Elfster sync failed:", err);
    return jsonError("Couldn't stop the sync.", 500);
  }

  return NextResponse.json({ stopped: true });
}

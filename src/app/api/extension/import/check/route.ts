import { NextResponse } from "next/server";
import { authenticateExtension, isRegistryManager, jsonError, readJson } from "@/lib/extension-server";
import { importItemKey, isUuid, MAX_ITEMS_PER_REQUEST, type ImportCheckResponse } from "@/lib/extension";
import { LINK_COLUMNS, loadListItems, type LinkRow } from "@/lib/list-items";
import { parseImportItem } from "@/lib/wishlist-import";

// POST { registryId, items } → which of a wishlist's items are already on
// the registry. Items match on their link, or on their name when they have
// no link, the same as POST /api/extension/import.
export async function POST(request: Request) {
  const auth = await authenticateExtension(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  const body = await readJson(request);
  const registryId = body?.registryId;
  const rawItems = body?.items;
  if (!isUuid(registryId) || !Array.isArray(rawItems) || rawItems.length > MAX_ITEMS_PER_REQUEST) {
    return jsonError("Invalid request", 400);
  }
  if (!(await isRegistryManager(user.id, registryId))) {
    return jsonError("You don't manage that registry.", 403);
  }

  const wanted = new Set<string>();
  for (const raw of rawItems) {
    const item = parseImportItem(raw);
    const key = item && importItemKey(item);
    if (key) wanted.add(key);
  }

  // Items placed on this list from the owner's other lists count too
  // (src/lib/list-items.ts). The manager check above has passed.
  let rows: LinkRow[];
  try {
    rows = await loadListItems<LinkRow>(registryId, LINK_COLUMNS);
  } catch {
    return jsonError("Couldn't read the registry.", 500);
  }

  const existing = new Set<string>();
  for (const row of rows) {
    const key = importItemKey({ url: row.external_url, title: row.title });
    if (key && wanted.has(key)) existing.add(key);
  }

  const response: ImportCheckResponse = { existing: [...existing] };
  return NextResponse.json(response);
}

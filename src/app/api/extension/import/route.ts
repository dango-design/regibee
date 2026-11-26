import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authenticateExtension, isRegistryManager, jsonError, readJson } from "@/lib/extension-server";
import { importItemKey, isUuid, MAX_ITEMS_PER_REQUEST, type ImportResponse } from "@/lib/extension";
import { LINK_COLUMNS, loadListItems, type LinkRow } from "@/lib/list-items";
import { parseImportItem, type ImportItem } from "@/lib/wishlist-import";

// POST { registryId, items } → adds the items of a wishlist from another
// site (Elfster) that aren't on the registry yet. Unlike POST
// /api/extension/items, an item can link to any shop, or to none. Items
// match on their link, or on their name when they have no link.
export async function POST(request: Request) {
  const auth = await authenticateExtension(request);
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  const body = await readJson(request);
  const registryId = body?.registryId;
  const rawItems = body?.items;
  if (!isUuid(registryId) || !Array.isArray(rawItems) || rawItems.length > MAX_ITEMS_PER_REQUEST) {
    return jsonError("Invalid request", 400);
  }
  if (!(await isRegistryManager(user.id, registryId))) {
    return jsonError("You don't manage that registry.", 403);
  }

  // Items placed on this list from the owner's other lists count too
  // (src/lib/list-items.ts). The manager check above has passed.
  let existingItems: LinkRow[];
  try {
    existingItems = await loadListItems<LinkRow>(registryId, LINK_COLUMNS);
  } catch {
    return jsonError("Couldn't read the registry.", 500);
  }

  const taken = new Set<string>();
  for (const row of existingItems) {
    const key = importItemKey({ url: row.external_url, title: row.title });
    if (key) taken.add(key);
  }

  // Skip invalid items, items already on the registry, and repeats in this request.
  const toAdd: (ImportItem & { key: string })[] = [];
  let skipped = 0;
  for (const raw of rawItems) {
    const item = parseImportItem(raw);
    const key = item && importItemKey(item);
    if (!item || !key) continue;
    if (taken.has(key)) {
      skipped++;
      continue;
    }
    taken.add(key);
    toAdd.push({ ...item, key });
  }

  if (toAdd.length === 0) {
    const empty: ImportResponse = { added: [], skipped };
    return NextResponse.json(empty);
  }

  const { data: inserted, error } = await supabase
    .from("registry_items")
    .insert(
      toAdd.map((item) => ({
        registry_id: registryId,
        title: item.title,
        external_url: item.url,
        image_url: item.imageUrl,
        price: item.price,
        quantity_needed: item.quantity,
        quantity_fulfilled: 0,
        is_essential: item.isEssential,
        notes: item.notes,
      }))
    )
    .select("id, title, external_url");
  if (error) return jsonError("Couldn't add the items.", 500);

  revalidatePath(`/dashboard/registry/${registryId}`);
  const response: ImportResponse = {
    added: (inserted ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      key: importItemKey({ url: row.external_url as string | null, title: row.title as string }) ?? "",
    })),
    skipped,
  };
  return NextResponse.json(response);
}

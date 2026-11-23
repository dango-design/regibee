import { supabaseAdmin } from "@/lib/supabase-admin";
import { extensionCanReadLink } from "@/lib/extension";
import { isMissingDetails, parseDetailChanges, shownSide } from "@/lib/item-details";
import type { ListPageDetailReview, ListPageItem, ListPageMissingDetails } from "@/lib/list-page-types";

// Filling in items' details later (src/lib/item-details.ts), for a list's
// page. item_detail_reads is for the server only, so this reads it with the
// service-role client. Only call it after checking the person manages the list.

interface DetailReadRow {
  item_id: string;
  read_url: string;
  changes: unknown;
  reviewed_at: string | null;
}

/** The reads of these items, by item. Null before the migration runs. */
async function loadDetailReads(itemIds: string[]): Promise<Map<string, DetailReadRow> | null> {
  const reads = new Map<string, DetailReadRow>();
  if (itemIds.length === 0) return reads;
  const { data, error } = await supabaseAdmin
    .from("item_detail_reads")
    .select("item_id, read_url, changes, reviewed_at")
    .in("item_id", itemIds);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }
  for (const row of (data ?? []) as DetailReadRow[]) reads.set(row.item_id, row);
  return reads;
}

/**
 * Which items on a list the extension can fill in, and the filled-in details
 * nobody has reviewed yet. Both empty before the migration runs.
 *
 * `canEditPlaced` is false for someone who helps with this list but isn't its
 * owner. They can't change items placed here from the owner's other lists, so
 * those aren't offered.
 */
export async function loadItemDetailsState(
  items: Pick<ListPageItem, "id" | "title" | "external_url" | "image_url" | "price" | "is_parent_purchased" | "placed">[],
  { canEditPlaced }: { canEditPlaced: boolean },
): Promise<{ missingDetails: ListPageMissingDetails[]; detailReview: ListPageDetailReview[] }> {
  const reads = await loadDetailReads(items.map((i) => i.id));
  if (!reads) return { missingDetails: [], detailReview: [] };

  const missingDetails: ListPageMissingDetails[] = [];
  const detailReview: ListPageDetailReview[] = [];
  for (const item of items) {
    const read = reads.get(item.id);
    if (
      item.external_url &&
      extensionCanReadLink(item.external_url) &&
      isMissingDetails(item) &&
      (canEditPlaced || !item.placed) &&
      // Read once per link. A new link can be read again.
      read?.read_url !== item.external_url
    ) {
      missingDetails.push({ id: item.id, title: item.title, external_url: item.external_url });
    }

    if (read && !read.reviewed_at) {
      // A change someone has edited over since isn't the read's to undo.
      const changes = parseDetailChanges(read.changes).flatMap((change) => {
        const shown = shownSide(change, item);
        return shown ? [{ ...change, shown }] : [];
      });
      if (changes.length > 0) {
        detailReview.push({ itemId: item.id, title: item.title, imageUrl: item.image_url, changes });
      }
    }
  }
  return { missingDetails, detailReview };
}

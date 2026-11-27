import { supabaseAdmin } from "@/lib/supabase-admin";
import { extensionCanReadLink } from "@/lib/extension";
import {
  isMissingDetails,
  lastPriceCheck,
  parseDetailChanges,
  PRICE_CHECKS_PER_VISIT,
  priceCheckDue,
  priceChecksOff,
  shownSide,
} from "@/lib/item-details";
import type { ListPageDetailReview, ListPageItem, ListPageMissingDetails } from "@/lib/list-page-types";

// Filling in items' details later (src/lib/item-details.ts), for a list's
// page. item_detail_reads is for the server only, so this reads it with the
// service-role client. Only call it after checking the person manages the list.

interface DetailReadRow {
  item_id: string;
  read_url: string;
  read_at: string;
  changes: unknown;
  reviewed_at: string | null;
  price_checks_off_url?: string | null;
}

/** The reads of these items, by item. Null before the migration runs. */
async function loadDetailReads(itemIds: string[]): Promise<Map<string, DetailReadRow> | null> {
  const reads = new Map<string, DetailReadRow>();
  if (itemIds.length === 0) return reads;
  const columns = "item_id, read_url, read_at, changes, reviewed_at";
  const withOff = await supabaseAdmin
    .from("item_detail_reads")
    .select(`${columns}, price_checks_off_url`)
    .in("item_id", itemIds);
  // Before 20261127202011_price_checks_off.sql runs, every item's checks are on.
  const { data, error } =
    withOff.error?.code === "42703"
      ? await supabaseAdmin.from("item_detail_reads").select(columns).in("item_id", itemIds)
      : withOff;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }
  for (const row of (data ?? []) as DetailReadRow[]) reads.set(row.item_id, row);
  return reads;
}

/**
 * Which items on a list the extension can fill in, which prices it should
 * check on this visit, and the filled-in details nobody has reviewed yet. All
 * empty before the migration runs.
 *
 * `canEditPlaced` is false for someone who helps with this list but isn't its
 * owner. They can't change items placed here from the owner's other lists, so
 * those aren't offered.
 */
export async function loadItemDetailsState(
  items: Pick<
    ListPageItem,
    | "id"
    | "title"
    | "external_url"
    | "image_url"
    | "price"
    | "is_parent_purchased"
    | "placed"
    | "created_at"
    | "quantity_needed"
    | "quantity_fulfilled"
  >[],
  { canEditPlaced }: { canEditPlaced: boolean },
): Promise<{
  missingDetails: ListPageMissingDetails[];
  priceChecks: ListPageMissingDetails[];
  detailReview: ListPageDetailReview[];
}> {
  const reads = await loadDetailReads(items.map((i) => i.id));
  if (!reads) return { missingDetails: [], priceChecks: [], detailReview: [] };

  const missingDetails: ListPageMissingDetails[] = [];
  const dueChecks: { item: ListPageMissingDetails; checked: string }[] = [];
  const detailReview: ListPageDetailReview[] = [];
  const now = new Date();
  for (const item of items) {
    const read = reads.get(item.id);
    const readable =
      item.external_url && extensionCanReadLink(item.external_url) && (canEditPlaced || !item.placed)
        ? item.external_url
        : null;
    if (readable && isMissingDetails(item)) {
      // Read once per link. A new link can be read again.
      if (read?.read_url !== readable) {
        missingDetails.push({ id: item.id, title: item.title, external_url: readable });
      }
    } else if (readable) {
      const checkItem = { ...item, external_url: readable };
      if (priceCheckDue(checkItem, read, now)) {
        dueChecks.push({
          item: { id: item.id, title: item.title, external_url: readable },
          checked: lastPriceCheck(checkItem, read),
        });
      }
    }

    if (read && !read.reviewed_at) {
      // A change someone has edited over since isn't the read's to undo.
      const changes = parseDetailChanges(read.changes).flatMap((change) => {
        const shown = shownSide(change, item);
        return shown ? [{ ...change, shown }] : [];
      });
      if (changes.length > 0) {
        detailReview.push({
          itemId: item.id,
          title: item.title,
          imageUrl: item.image_url,
          changes,
          priceChecksOff: item.external_url ? priceChecksOff({ external_url: item.external_url }, read) : false,
        });
      }
    }
  }
  // The longest unchecked first, a few per visit.
  const priceChecks = dueChecks
    .sort((a, b) => Date.parse(a.checked) - Date.parse(b.checked))
    .slice(0, PRICE_CHECKS_PER_VISIT)
    .map((check) => check.item);
  return { missingDetails, priceChecks, detailReview };
}

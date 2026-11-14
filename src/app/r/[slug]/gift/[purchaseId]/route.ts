import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isUuid } from "@/lib/extension";
import { isGiftLinkStep } from "@/lib/gifts";
import { listsForItems } from "@/lib/list-items";
import { listForOldLink } from "@/lib/list-links";
import { MY_GIFTS_COOKIE, MY_GIFTS_COOKIE_OPTIONS, withGift } from "@/lib/my-gifts-cookie";

export const dynamic = "force-dynamic";

// The link in a guest's emails back to their gift. It adds the gift to this
// browser's gifts cookie, so the registry page shows it as theirs, then opens
// the registry at that gift. It changes no data: confirming or releasing
// happens on the page, so an email app that opens links ahead of time can't do
// either.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; purchaseId: string }> }
) {
  const { slug, purchaseId } = await params;
  const linkTarget = new URL(`/r/${encodeURIComponent(slug)}`, request.url);
  if (!isUuid(purchaseId)) return NextResponse.redirect(linkTarget);

  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select("id, status, registry_item_id")
    .eq("id", purchaseId)
    .single();
  if (!purchase?.registry_item_id) return NextResponse.redirect(linkTarget);

  // An item can be on several of its owner's lists (src/lib/list-items.ts).
  // The link works on any of them. If the list has a new link since the
  // email went out, the purchase id proves this is the guest's gift, so it
  // goes to the list's new link (src/lib/list-links.ts).
  const [lists, { data: current }] = await Promise.all([
    listsForItems([purchase.registry_item_id]),
    supabaseAdmin.from("registries").select("id, slug").eq("slug", slug).maybeSingle(),
  ]);
  const registry = (current as { id: string; slug: string } | null) ?? (await listForOldLink(slug));
  const item = { id: purchase.registry_item_id as string };
  if (!registry || !(lists.get(item.id) ?? []).includes(registry.id)) {
    return NextResponse.redirect(linkTarget);
  }

  const target = new URL(`/r/${encodeURIComponent(registry.slug)}`, request.url);
  target.searchParams.set("gift", item.id);
  const step = request.nextUrl.searchParams.get("step");
  if (purchase.status === "cancelled") target.searchParams.set("step", "ended");
  else if (isGiftLinkStep(step)) target.searchParams.set("step", step);

  const response = NextResponse.redirect(target);
  if (purchase.status !== "cancelled") {
    response.cookies.set(
      MY_GIFTS_COOKIE,
      withGift(request.cookies.get(MY_GIFTS_COOKIE)?.value, "items", item.id, purchase.id),
      MY_GIFTS_COOKIE_OPTIONS
    );
  }
  return response;
}

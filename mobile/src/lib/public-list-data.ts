// Someone else's list, as a guest sees it: what the website's /r/<slug> page
// loads (loadPublicList in src/lib/public-list-page.ts on the website), and
// the website's gift actions (reserveItem, confirmGift and releaseGift in
// src/lib/actions/registry.ts). The gifts this account reserves are kept on
// the phone (src/lib/my-gifts.ts), in place of the website's cookie.
//
// These work signed out too, and in the demo, which has no account: the
// website lets anyone open a list and reserve a gift (see src/lib/api.ts).
// Signed out, the gifts are kept under the phone's own key.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PublicListPageData } from "@shared/public-list-page-types";

import { act, form, loadPage, runAction } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { forgetGift, readMyGifts, rememberGift } from "@/lib/my-gifts";

/** The invitation a list was opened from: the event's slug and the guest's RSVP token. */
export interface EventLink {
  event: string;
  token: string;
}

export const publicListKeys = {
  all: ["public-list"] as const,
  list: (slug: string, link: EventLink | null, accountId: string) =>
    ["public-list", slug, link?.event ?? "", link?.token ?? "", accountId] as const,
};

/** The signed-in account's id, or "" signed out and in the demo. Gifts are kept under it. */
function useAccountId() {
  return useSession().session?.user.id ?? "";
}

/**
 * The list with this slug, as this account, or a signed-out guest, sees it.
 * Null when the website says "not found": there's no such list, or it's
 * private.
 */
export function usePublicList(slug: string, link: EventLink | null) {
  const accountId = useAccountId();
  return useQuery({
    queryKey: publicListKeys.list(slug, link, accountId),
    queryFn: async () => {
      const items = await readMyGifts(accountId);
      return (await loadPage<PublicListPageData>("publicList", slug, items, link)) ?? null;
    },
  });
}

/** What reserveItem returns once the gift is saved. */
export interface ReservedGift {
  purchaseId: string;
  status: "reserved" | "purchased";
  reservedUntil: string | null;
  /** The address to ship it to, now that this guest has a gift on the list. */
  shippingAddress?: string;
}

export interface ReserveInput {
  itemId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  message: string;
  /** The guest bought it before coming here: saved as bought straight away. */
  alreadyBought: boolean;
}

function useRefreshLists() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: publicListKeys.all });
}

/**
 * Reserves an item, or marks it bought, the way the website's gift dialog
 * does. The purchase id is kept on the phone before the list reloads, so the
 * list shows the gift as this guest's.
 */
export function useReserveItem(link: EventLink | null) {
  const accountId = useAccountId();
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async (input: ReserveInput) => {
      const { result } = await runAction<ReservedGift>(
        "registry.reserveItem",
        form({
          itemId: input.itemId,
          buyerName: input.buyerName,
          buyerEmail: input.buyerEmail,
          quantity: input.quantity,
          message: input.message,
          alreadyBought: input.alreadyBought ? "1" : null,
          // Matches the gift to the guest's RSVP, as the website's event
          // guest cookie does.
          eventSlug: link?.event ?? null,
          guestToken: link?.token ?? null,
        }),
      );
      await rememberGift(accountId, input.itemId, result.purchaseId);
      return result;
    },
    onSettled: refresh,
  });
}

/** The guest bought the item they reserved. */
export function useConfirmGift() {
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: (purchaseId: string) => act("registry.confirmGift", purchaseId),
    onSettled: refresh,
  });
}

/** The guest isn't getting the item after all: it goes back on the list. */
export function useReleaseGift() {
  const accountId = useAccountId();
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async ({ itemId, purchaseId }: { itemId: string; purchaseId: string }) => {
      await act("registry.releaseGift", purchaseId);
      await forgetGift(accountId, itemId);
    },
    onSettled: refresh,
  });
}

/** Follows the list's owner, or withdraws the request. */
export function useFollowOwner() {
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: ({ publicId, follow }: { publicId: string; follow: boolean }) =>
      act(follow ? "follows.requestFollow" : "follows.cancelFollow", publicId),
    onSettled: refresh,
  });
}

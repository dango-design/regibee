// Someone else's list, as a guest sees it: what the website's /r/<slug> page
// loads (loadPublicList in src/lib/public-list-page.ts on the website), and
// the website's actions for guests: reserveItem, confirmGift, releaseGift,
// contributeToCashFund, coverParentPurchasedItem and suggestItem in
// src/lib/actions/registry.ts, and startGroupGift in
// src/lib/actions/group-gifts.ts. The gifts this account gives are kept on
// the phone (src/lib/my-gifts.ts), in place of the website's cookie.
//
// From an invitation's gift link, the gift actions get the event's slug and
// the guest's RSVP token (`eventSlug`, `guestToken`), in place of the
// website's event guest cookie, so the gift is matched to the guest's RSVP.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PublicListPageData } from "@shared/public-list-page-types";

import { act, form, loadPage, runAction } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { forgetGift, readMyFundGifts, readMyGifts, rememberFundGift, rememberGift } from "@/lib/my-gifts";

/** The invitation a list was opened from: the event's slug and the guest's RSVP token. */
export interface EventLink {
  event: string;
  token: string;
}

export const publicListKeys = {
  all: ["public-list"] as const,
  list: (slug: string, link: EventLink | null, userId: string) =>
    ["public-list", slug, link?.event ?? "", link?.token ?? "", userId] as const,
};

/**
 * The list with this slug, as this account sees it as a guest. Null when the
 * website says "not found": there's no such list, or it's private.
 */
export function usePublicList(slug: string, link: EventLink | null) {
  const { userId, demo } = useSession();
  return useQuery({
    queryKey: publicListKeys.list(slug, link, userId),
    enabled: Boolean(userId) && !demo,
    queryFn: async () => {
      const [items, funds] = await Promise.all([readMyGifts(userId), readMyFundGifts(userId)]);
      return (await loadPage<PublicListPageData>("publicList", slug, items, link, funds)) ?? null;
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

/** Matches a gift to the guest's RSVP, as the website's event guest cookie does. */
function rsvpFields(link: EventLink | null) {
  return { eventSlug: link?.event ?? null, guestToken: link?.token ?? null };
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
  const { userId } = useSession();
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
          ...rsvpFields(link),
        }),
      );
      await rememberGift(userId, input.itemId, result.purchaseId);
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
  const { userId } = useSession();
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async ({ itemId, purchaseId }: { itemId: string; purchaseId: string }) => {
      await act("registry.releaseGift", purchaseId);
      await forgetGift(userId, itemId);
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

export interface ContributeInput {
  fundId: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  message: string;
}

/**
 * Gives to a gift fund, the way the website's Contribute dialog does. The
 * guest sends the money themselves. The amount is kept on the phone, so the
 * fund says "Contributed".
 */
export function useContributeToFund(link: EventLink | null) {
  const { userId } = useSession();
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async (input: ContributeInput) => {
      await act(
        "registry.contributeToCashFund",
        form({
          fundId: input.fundId,
          amount: input.amount,
          buyerName: input.buyerName,
          buyerEmail: input.buyerEmail,
          message: input.message,
          ...rsvpFields(link),
        }),
      );
      await rememberFundGift(userId, input.fundId, input.amount);
    },
    onSettled: refresh,
  });
}

export interface CoverInput {
  itemId: string;
  quantity: number;
  buyerName: string;
  buyerEmail: string;
  message: string;
}

/**
 * Gives an item the owners already bought: the guest sent them its price and
 * says so here. Saved as given straight away. The purchase id is kept on the
 * phone, so the guest can see and undo it (useReleaseGift).
 */
export function useCoverItem(link: EventLink | null) {
  const { userId } = useSession();
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async (input: CoverInput) => {
      const result = await act<{ purchaseId: string }>(
        "registry.coverParentPurchasedItem",
        form({
          itemId: input.itemId,
          quantity: input.quantity,
          buyerName: input.buyerName,
          buyerEmail: input.buyerEmail,
          message: input.message,
          ...rsvpFields(link),
        }),
      );
      await rememberGift(userId, input.itemId, result.purchaseId);
      return result;
    },
    onSettled: refresh,
  });
}

export interface SuggestInput {
  registryId: string;
  title: string;
  externalUrl: string;
  price: number | null;
  notes: string;
  suggestedByName: string;
  suggestedByEmail: string;
}

/** Suggests an item to the list's owner. */
export function useSuggestItem() {
  return useMutation({
    mutationFn: (input: SuggestInput) =>
      act(
        "registry.suggestItem",
        form({
          registryId: input.registryId,
          title: input.title,
          externalUrl: input.externalUrl,
          price: input.price,
          notes: input.notes,
          suggestedByName: input.suggestedByName,
          suggestedByEmail: input.suggestedByEmail,
        }),
      ),
  });
}

export interface StartGroupGiftInput {
  registryId: string;
  itemId: string;
  /** What was typed, or null for the item's price. */
  goalAmount: string | null;
  paybackNote: string;
}

/**
 * Starts a group gift on an item: reserves it in this account's name and
 * returns the token for the group gift's page. From an invitation, the group
 * gift shows on it too.
 */
export function useStartGroupGift(link: EventLink | null) {
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: (input: StartGroupGiftInput) =>
      act<{ token: string }>("groupGifts.startGroupGift", { ...input, ...rsvpFields(link) }),
    onSettled: refresh,
  });
}

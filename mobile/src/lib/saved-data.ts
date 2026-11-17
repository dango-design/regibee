// The Saved tab: every item on every list you own, with the lists it's on
// (the website's loader, src/lib/saved-items.ts), and gift ideas, which only
// their owner can read (src/lib/gift-ideas.ts). Changes run the website's own
// server actions (src/lib/actions/saved.ts and gift-ideas.ts).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GIFT_IDEA_COLUMNS, toGiftIdea, type GiftIdea, type GiftIdeaInput, type GiftIdeaRow } from "@shared/gift-ideas";
import type { SavedItemsData, SavedList } from "@shared/saved-items-types";

import { act, ApiError, loadPage } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { supabase } from "@/lib/supabase";

export const savedKeys = {
  items: (userId: string) => ["saved", "items", userId] as const,
  ideas: (userId: string) => ["saved", "ideas", userId] as const,
};

/** "Wishlist", "Birthday", or "Wishlist for Max" for a list kept for a child, as the website labels them. */
export function listKind(list: SavedList) {
  return list.forChild ? `${list.kindLabel} for ${list.forChild}` : list.kindLabel;
}

/** The demo has no Saved tab, as on the website. */
function notInDemo(): never {
  throw new ApiError("Make an account to save items and gift ideas.");
}

export function useSavedItems() {
  const { userId, demo } = useSession();
  return useQuery({
    queryKey: savedKeys.items(userId),
    enabled: Boolean(userId) && !demo,
    queryFn: async () => {
      const data = await loadPage<SavedItemsData>("saved");
      if (!data) throw new ApiError("You're signed out. Sign in again.");
      return data;
    },
  });
}

function useRefreshLists() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
      queryClient.invalidateQueries({ queryKey: ["registry"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
}

/**
 * Puts items on one of your lists, or takes them off it. Taken off its last
 * list, an item is deleted, with any gifts on it.
 */
export function usePlaceItems() {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async ({ itemIds, listId, on }: { itemIds: string[]; listId: string; on: boolean }) => {
      if (isDemo()) notInDemo();
      return act<{ changed: number; deleted: number }>(
        on ? "saved.addItemsToList" : "saved.removeItemsFromList",
        itemIds,
        listId
      );
    },
    // Tick or untick it straight away.
    onMutate: ({ itemIds, listId, on }) => {
      const key = savedKeys.items(userId);
      const previous = queryClient.getQueryData<SavedItemsData>(key);
      if (previous) {
        queryClient.setQueryData<SavedItemsData>(key, {
          ...previous,
          items: previous.items
            .map((item) =>
              itemIds.includes(item.id)
                ? {
                    ...item,
                    listIds: on
                      ? item.listIds.includes(listId)
                        ? item.listIds
                        : [...item.listIds, listId]
                      : item.listIds.filter((id) => id !== listId),
                  }
                : item
            )
            .filter((item) => item.listIds.length > 0),
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(savedKeys.items(userId), context.previous);
    },
    onSettled: () => refresh(),
  });
}

/** "Start my wishlist": a list for you, named after you, with no event. */
export function useStartWishlist() {
  const refresh = useRefreshLists();
  return useMutation({
    mutationFn: async () => {
      if (isDemo()) notInDemo();
      return act<{ registryId: string }>("saved.startMyWishlist");
    },
    onSuccess: () => refresh(),
  });
}

// ---------------------------------------------------------------------------
// Gift ideas
// ---------------------------------------------------------------------------

/** Your gift ideas. The table's access rules return only your own. */
export function useGiftIdeas() {
  const { userId, demo } = useSession();
  return useQuery({
    queryKey: savedKeys.ideas(userId),
    enabled: Boolean(userId) && !demo,
    queryFn: async (): Promise<GiftIdea[]> => {
      const { data, error } = await supabase
        .from("gift_ideas")
        .select(GIFT_IDEA_COLUMNS)
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return ((data ?? []) as GiftIdeaRow[]).map(toGiftIdea);
    },
  });
}

function useIdeaChange<V>(run: (variables: V) => Promise<unknown>, optimistic?: (ideas: GiftIdea[], variables: V) => GiftIdea[]) {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const key = savedKeys.ideas(userId);
  return useMutation({
    mutationFn: async (variables: V) => {
      if (isDemo()) notInDemo();
      return run(variables);
    },
    onMutate: (variables) => {
      const previous = queryClient.getQueryData<GiftIdea[]>(key);
      if (previous && optimistic) queryClient.setQueryData<GiftIdea[]>(key, optimistic(previous, variables));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** "Save idea" and "Save": a new idea, or changes to one. */
export function useSaveIdea() {
  return useIdeaChange(({ input, id }: { input: GiftIdeaInput; id?: string }) =>
    act<{ id: string }>("giftIdeas.saveGiftIdea", input, id)
  );
}

/** The "Bought" box on an idea. */
export function useSetIdeaBought() {
  return useIdeaChange(
    ({ id, bought }: { id: string; bought: boolean }) => act("giftIdeas.setGiftIdeaBought", id, bought),
    (ideas, { id, bought }) => ideas.map((i) => (i.id === id ? { ...i, boughtAt: bought ? new Date().toISOString() : null } : i))
  );
}

export function useDeleteIdea() {
  return useIdeaChange(
    (id: string) => act("giftIdeas.deleteGiftIdea", id),
    (ideas, id) => ideas.filter((i) => i.id !== id)
  );
}

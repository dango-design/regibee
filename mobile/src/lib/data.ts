// Reading and changing lists, as the signed-in user. The home screen and a
// list's screen load what the website's pages load (src/lib/dashboard-page.ts
// and src/lib/list-page.ts on the website), and changes run the website's own
// server actions (src/lib/actions/registry.ts), through src/lib/api.ts. So the
// app counts the same items, including ones placed on several lists, and
// follows the same rules.

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { DashboardData } from "@shared/dashboard-page-types";
import type { ListPageData, ListPagePurchase } from "@shared/list-page-types";
import type { ListVisibility } from "@shared/list-access";

import { act, ApiError, form, loadPage, runAction } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { demo, isDemo } from "@/lib/demo";
import { supabase } from "@/lib/supabase";
import type {
  CashFund,
  Category,
  EventType,
  Gift,
  Item,
  ItemInput,
  Registry,
  RegistryDetail,
  RegistrySummary,
  RegistryType,
  UsedCondition,
} from "@/lib/types";

export const keys = {
  dashboard: (userId: string) => ["dashboard", userId] as const,
  registry: (id: string) => ["registry", id] as const,
};

// ---------------------------------------------------------------------------
// The home screen
// ---------------------------------------------------------------------------

async function fetchDashboard(): Promise<DashboardData> {
  if (isDemo()) return demo.dashboard();
  const data = await loadPage<DashboardData>("dashboard");
  if (!data) throw new ApiError("You're signed out. Sign in again.");
  return data;
}

/** The home screen: the user's lists, the ones they help manage, and its notices. */
export function useDashboard() {
  const { userId } = useSession();
  return useQuery({
    queryKey: keys.dashboard(userId),
    queryFn: fetchDashboard,
    enabled: Boolean(userId),
  });
}

/** Every list the user can add to: their own, then the ones they help manage. */
export function useRegistries() {
  const { userId } = useSession();
  return useQuery({
    queryKey: keys.dashboard(userId),
    queryFn: fetchDashboard,
    enabled: Boolean(userId),
    select: (data): RegistrySummary[] => [...data.owned, ...data.shared],
  });
}

// ---------------------------------------------------------------------------
// A list
// ---------------------------------------------------------------------------

function toGift(p: ListPagePurchase): Gift {
  return {
    id: p.id,
    buyer_name: p.buyer_name,
    buyer_email: p.buyer_email,
    quantity: p.quantity,
    amount: p.amount,
    status: p.status,
    reserved_until: p.reserved_until,
    message: p.message,
    created_at: p.created_at,
    registry_item_id: p.registry_item_id,
    cash_fund_id: p.cash_fund_id,
    hide_giver: Boolean(p.hide_giver),
    kind: p.cash_fund_id ? "fund" : "item",
    for_title: p.item_title,
    item_price: p.registry_items?.price ?? null,
    item_bought_by_owner: Boolean(p.registry_items?.is_parent_purchased),
  };
}

/** The website's list page data, as the app's screens read it. */
export function fromListPage(data: ListPageData): RegistryDetail {
  const gifts = data.purchases.map(toGift);
  const registry = data.registry as unknown as Registry;
  return {
    registry,
    role: data.isOwner ? "owner" : "manager",
    categories: data.categories.map((c) => ({ ...c, registry_id: registry.id })),
    items: data.items.map((item) => ({
      ...item,
      minimum_condition: item.minimum_condition as UsedCondition | null,
      purchases: gifts
        .filter((g) => g.registry_item_id === item.id)
        .map(({ id, status, reserved_until, buyer_name, quantity, created_at, hide_giver, message, buyer_email, amount }) => ({
          id,
          status,
          reserved_until,
          buyer_name,
          quantity,
          created_at,
          hide_giver,
          message,
          buyer_email,
          amount,
        })),
    })),
    funds: data.funds.map((fund) => ({ ...fund, registry_id: registry.id })),
    gifts,
    suggestions: data.suggestions,
    pendingSuggestions: data.pendingSuggestionCount,
    reservationsHidden: data.hideReservations,
    revealedCount: data.revealInfo?.revealedCount,
    nextReveal: data.revealInfo?.next ?? null,
    turnedOnByExchange: data.turnedOnByExchange,
    linkedEvents: data.linkedEvents,
    showChecklist: data.showChecklist,
    checklistProgress: data.checklistProgress,
    linkedRegistries: data.linkedRegistries ?? null,
    registryLinkStores: data.storesWithRegistryLinks ?? [],
    plainLinkGroups: data.plainLinkGroups,
    perkRows: data.perkRows,
    perkEmails: data.perkEmails,
    readyPerkCount: data.readyPerkCount,
    zipCode: data.zipCode ?? null,
    canPlanEvents: data.canPlanEvents,
    eventPromptDismissed: data.eventPromptDismissed,
    showPlanEventButton: data.showPlanEventButton,
  };
}

async function fetchRegistry(id: string): Promise<RegistryDetail> {
  if (isDemo()) return demo.registry(id);
  const data = await loadPage<ListPageData>("listPage", id);
  if (!data) throw new ApiError("This list is gone, or you don't help manage it anymore.");
  return fromListPage(data);
}

export function useRegistry(id: string | undefined) {
  const { userId } = useSession();
  return useQuery({
    queryKey: keys.registry(id ?? ""),
    queryFn: () => fetchRegistry(id!),
    enabled: Boolean(id && userId),
  });
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

function cleanInput(input: ItemInput) {
  const quantity = Math.max(1, Math.round(input.quantity_needed) || 1);
  return {
    title: input.title.trim(),
    external_url: input.external_url?.trim() || null,
    image_url: input.image_url?.trim() || null,
    price: input.price != null && Number.isFinite(input.price) && input.price > 0 ? input.price : null,
    quantity_needed: quantity,
    category_id: input.category_id,
    is_essential: input.is_essential,
    is_open_to_used: input.is_open_to_used,
    minimum_condition: input.is_open_to_used ? (input.minimum_condition ?? "like-new") : null,
    notes: input.notes?.trim() || null,
  };
}

/** The website's add and edit item dialogs send these fields. */
function itemForm(values: ReturnType<typeof cleanInput>, bought?: boolean) {
  return form({
    title: values.title,
    categoryId: values.category_id ?? "",
    externalUrl: values.external_url ?? "",
    imageUrl: values.image_url ?? "",
    price: values.price != null ? String(values.price) : "",
    quantityNeeded: String(values.quantity_needed),
    isEssential: String(values.is_essential),
    ...(bought === undefined ? {} : { isParentPurchased: String(bought) }),
    isOpenToUsed: String(values.is_open_to_used),
    minimumCondition: values.minimum_condition ?? "",
    notes: values.notes ?? "",
  });
}

/** Updates the cached list right away, so the screen changes before the save finishes. */
function patchCached(queryClient: QueryClient, registryId: string, change: (detail: RegistryDetail) => RegistryDetail) {
  const key = keys.registry(registryId);
  const previous = queryClient.getQueryData<RegistryDetail>(key);
  if (previous) queryClient.setQueryData<RegistryDetail>(key, change(previous));
  return previous;
}

function useRefresh() {
  const queryClient = useQueryClient();
  return (registryId?: string) =>
    Promise.all([
      // An item can be on several lists, so every list may have changed.
      registryId
        ? queryClient.invalidateQueries({ queryKey: ["registry"] })
        : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
    ]);
}

/** Runs a change and rolls the cached list back if it fails. */
function useListChange<V>(
  registryIdOf: (variables: V) => string,
  run: (variables: V) => Promise<unknown>,
  optimistic?: (detail: RegistryDetail, variables: V) => RegistryDetail,
) {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: run,
    onMutate: (variables: V) =>
      optimistic ? { previous: patchCached(queryClient, registryIdOf(variables), (d) => optimistic(d, variables)) } : {},
    onError: (_error, variables, context) => {
      if (context && "previous" in context && context.previous) {
        queryClient.setQueryData(keys.registry(registryIdOf(variables)), context.previous);
      }
    },
    onSettled: (_data, _error, variables) => refresh(registryIdOf(variables)),
  });
}

export function useAddItem() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ registryId, input }: { registryId: string; input: ItemInput }) => {
      const values = cleanInput(input);
      const bought = input.is_parent_purchased;
      if (isDemo()) {
        return demo.addItem(registryId, {
          ...values,
          is_parent_purchased: bought,
          quantity_fulfilled: bought ? values.quantity_needed : 0,
        });
      }
      const result = await act<{ id?: string }>("registry.addRegistryItem", registryId, itemForm(values, bought));
      return { id: result?.id ?? "", title: values.title };
    },
    onSuccess: (_data, { registryId }) => refresh(registryId),
  });
}

export function useUpdateItem() {
  return useListChange<{ item: Item; input: ItemInput }>(
    ({ item }) => item.registry_id,
    async ({ item, input }) => {
      const values = cleanInput(input);
      if (isDemo()) {
        const boughtChanged = input.is_parent_purchased !== item.is_parent_purchased;
        demo.updateItem(item.id, {
          ...values,
          is_parent_purchased: input.is_parent_purchased,
          quantity_fulfilled: boughtChanged ? (input.is_parent_purchased ? values.quantity_needed : 0) : item.quantity_fulfilled,
        });
        return;
      }
      // The website's edit dialog saves the details, then the bought box if it changed.
      await act("registry.updateRegistryItem", item.id, item.registry_id, itemForm(values));
      if (input.is_parent_purchased !== item.is_parent_purchased) {
        await act("registry.toggleParentPurchased", item.id, item.registry_id, input.is_parent_purchased);
      }
    },
    (detail, { item, input }) => ({
      ...detail,
      items: detail.items.map((i) =>
        i.id === item.id ? { ...i, ...cleanInput(input), is_parent_purchased: input.is_parent_purchased } : i
      ),
    })
  );
}

async function setBoughtMyself(item: Item, bought: boolean) {
  if (isDemo()) {
    demo.updateItem(item.id, { is_parent_purchased: bought, quantity_fulfilled: bought ? item.quantity_needed : 0 });
    return;
  }
  // A database trigger corrects quantity_fulfilled, so unmarking keeps guests'
  // gifts counted (supabase/migrations/20261113213004_gift_counts.sql).
  await act("registry.toggleParentPurchased", item.id, item.registry_id, bought);
}

/** Quick changes from a list row: most wanted, bought it myself. */
export function useToggleItem() {
  return useListChange<{ item: Item; field: "is_essential" | "is_parent_purchased" }>(
    ({ item }) => item.registry_id,
    async ({ item, field }) => {
      if (field === "is_parent_purchased") return setBoughtMyself(item, !item.is_parent_purchased);
      if (isDemo()) return demo.updateItem(item.id, { is_essential: !item.is_essential });
      // The website changes it with the rest of the item's details. On its
      // own it's one column the access rules let the list's owner change.
      const { data, error } = await supabase
        .from("registry_items")
        .update({ is_essential: !item.is_essential })
        .eq("id", item.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new ApiError("Only the list's owner can change this item.");
    },
    (detail, { item, field }) => ({
      ...detail,
      items: detail.items.map((i) => {
        if (i.id !== item.id) return i;
        if (field === "is_essential") return { ...i, is_essential: !i.is_essential };
        const bought = !i.is_parent_purchased;
        return { ...i, is_parent_purchased: bought, quantity_fulfilled: bought ? i.quantity_needed : 0 };
      }),
    })
  );
}

/**
 * Takes an item off this list, as the website does: an item that's also on
 * the owner's other lists stays on them. Only an item on no other list is
 * deleted, with guests' gifts on it.
 */
export function useDeleteItem() {
  return useListChange<Item>(
    (item) => item.registry_id,
    async (item) => {
      if (isDemo()) return demo.deleteItem(item.id);
      await act("registry.deleteRegistryItem", item.id, item.registry_id);
    },
    (detail, item) => ({ ...detail, items: detail.items.filter((i) => i.id !== item.id) })
  );
}

/** "A and B", or "A, B and 2 more", as the website's edit dialog names an item's other lists. */
export function listNames(titles: string[]): string {
  if (titles.length <= 2) return titles.join(" and ");
  return `${titles[0]}, ${titles[1]} and ${titles.length - 2} more`;
}

/** The confirmation the website's edit dialog shows before taking an item off a list. */
export function removeItemWording(item: Pick<Item, "title" | "otherLists">) {
  const others = item.otherLists ?? [];
  if (others.length === 0) {
    return { title: `Delete “${item.title}”?`, message: "This cannot be undone.", button: "Remove item" };
  }
  return {
    title: `Remove “${item.title}” from this list?`,
    message: `It stays on ${listNames(others)}.`,
    button: "Remove from list",
  };
}

export function useCancelGift(registryId: string) {
  const { session } = useSession();
  return useListChange<Gift>(
    () => registryId,
    async (gift) => {
      if (isDemo()) return demo.cancelGift(registryId, gift.id);
      // The database checks that the caller manages the registry (016_rpc_caller_from_auth_uid.sql).
      const { error } = await supabase.rpc("cancel_reservation", {
        p_purchase_id: gift.id,
        p_owner_id: session?.user.id,
      });
      if (error) throw error;
    },
    (detail, gift) => ({
      ...detail,
      gifts: detail.gifts.map((g) => (g.id === gift.id ? { ...g, status: "cancelled" } : g)),
    })
  );
}

export interface NewRegistryInput {
  title: string;
  registryType: RegistryType;
  eventType: EventType | null;
  eventDate: string | null;
  visibility: ListVisibility;
  listedOnProfile: boolean;
  description: string;
  venmo: string;
  paypal: string;
  zelle: string;
  zipCode: string;
}

/** The id at the end of a page the website would go to: /dashboard/registry/<id>. */
function idFromRedirect(path: string | undefined, prefix: string) {
  return path?.startsWith(prefix) ? path.slice(prefix.length).split(/[/?#]/)[0] || null : null;
}

export function useCreateRegistry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: NewRegistryInput) => {
      if (isDemo()) {
        return demo.createRegistry(
          {
            title: input.title.trim(),
            registry_type: input.registryType,
            event_type: input.registryType === "personal" ? input.eventType : null,
            event_date: input.eventDate,
            description: input.description.trim() || null,
            visibility: input.visibility,
          },
          input.registryType === "baby"
        );
      }
      // The website's create form (src/components/create-registry-form.tsx)
      // sends the same fields. The server makes the link and, for baby lists,
      // the 10 starting categories.
      const { redirect } = await runAction("registry.createRegistry", form({
        title: input.title.trim(),
        registryType: input.registryType,
        eventType: input.registryType === "personal" ? (input.eventType ?? "") : "",
        eventDate: input.eventDate ?? "",
        description: input.description.trim(),
        visibility: input.visibility,
        listedOnProfile: String(input.listedOnProfile),
        venmo: input.venmo.trim(),
        paypal: input.paypal.trim(),
        zelle: input.zelle.trim(),
        zipCode: input.zipCode.trim(),
        // Sales tax is added to what the owner buys when there's a zip code, as on the website.
        taxEnabled: String(Boolean(input.zipCode.trim())),
      }));
      const id = idFromRedirect(redirect, "/dashboard/registry/");
      if (!id) throw new ApiError("Your list was made, but we couldn't open it. Pull down on your lists to refresh.");
      return { id };
    },
    onSuccess: () => refresh(),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ registryId, name }: { registryId: string; name: string }): Promise<Category> => {
      if (isDemo()) return demo.createCategory(registryId, name.trim());
      const result = await act<{ category: Omit<Category, "registry_id"> }>("registry.createCategory", registryId, name.trim());
      return { ...result.category, registry_id: registryId };
    },
    onSuccess: (_data, { registryId }) => queryClient.invalidateQueries({ queryKey: keys.registry(registryId) }),
  });
}

/** The estimated price with sales tax, for what the owner bought, as the website's add dialog adds it. */
export async function estimateTax(zipCode: string, price: number) {
  if (isDemo()) return null;
  return act<{ priceWithTax: string; taxRate: number } | null>("tax.estimateTax", zipCode, price);
}

// ---------------------------------------------------------------------------
// Gift funds
// ---------------------------------------------------------------------------

export interface FundInput {
  title: string;
  description: string;
  goalAmount: number | null;
}

function fundForm(input: FundInput) {
  return form({
    title: input.title.trim(),
    description: input.description.trim(),
    goalAmount: input.goalAmount != null && input.goalAmount > 0 ? String(input.goalAmount) : "",
  });
}

export function useSaveFund() {
  return useListChange<{ registryId: string; fund?: CashFund; input: FundInput }>(
    ({ registryId }) => registryId,
    async ({ registryId, fund, input }) => {
      if (isDemo()) return demo.saveFund(registryId, fund?.id ?? null, input);
      if (fund) await act("registry.updateCashFund", fund.id, registryId, fundForm(input));
      else await act("registry.addCashFund", registryId, fundForm(input));
    },
    (detail, { fund, input }) =>
      fund
        ? {
            ...detail,
            funds: detail.funds.map((f) =>
              f.id === fund.id
                ? { ...f, title: input.title.trim(), description: input.description.trim() || null, goal_amount: input.goalAmount }
                : f
            ),
          }
        : detail
  );
}

export function useDeleteFund() {
  return useListChange<CashFund>(
    (fund) => fund.registry_id,
    async (fund) => {
      if (isDemo()) return demo.deleteFund(fund.registry_id, fund.id);
      await act("registry.deleteCashFund", fund.id, fund.registry_id);
    },
    (detail, fund) => ({
      ...detail,
      funds: detail.funds.filter((f) => f.id !== fund.id),
      gifts: detail.gifts.filter((g) => g.cash_fund_id !== fund.id),
    })
  );
}

// ---------------------------------------------------------------------------
// Suggestions from guests
// ---------------------------------------------------------------------------

export type SuggestionAction = "add" | "accept" | "decline";

/** "Add to registry", "Accept offering" and "Decline", as the website's Suggestions Inbox does them. */
export function useAnswerSuggestion(registryId: string) {
  return useListChange<{ suggestionId: string; action: SuggestionAction }>(
    () => registryId,
    async ({ suggestionId, action }) => {
      if (isDemo()) return demo.answerSuggestion(registryId, suggestionId, action);
      const name = { add: "acceptSuggestion", accept: "acceptOffering", decline: "declineSuggestion" }[action];
      await act(`registry.${name}`, form({ suggestionId, registryId }));
    },
    (detail, { suggestionId, action }) => {
      const status = ({ add: "added", accept: "accepted", decline: "declined" } as const)[action];
      const suggestions = detail.suggestions.map((s) => (s.id === suggestionId ? { ...s, status } : s));
      return {
        ...detail,
        suggestions,
        pendingSuggestions: suggestions.filter((s) => s.status === "pending" || s.status === "offering").length,
      };
    }
  );
}

// ---------------------------------------------------------------------------
// Notices on a list
// ---------------------------------------------------------------------------

/** "Don't remind me" on the plain store links notice. */
export function useHidePlainLinks(registryId: string) {
  return useListChange<string[]>(
    () => registryId,
    async (itemIds) => {
      if (isDemo()) return;
      await act("registry.hidePlainLinkReminders", registryId, itemIds);
    },
    (detail, itemIds) => ({
      ...detail,
      plainLinkGroups: detail.plainLinkGroups
        .map((group) => ({ ...group, items: group.items.filter((i) => !itemIds.includes(i.id)) }))
        .filter((group) => group.items.length > 0),
    })
  );
}

/** Dismisses the "Planning a party?" prompt. */
export function useDismissEventPrompt(registryId: string) {
  return useListChange<void>(
    () => registryId,
    async () => {
      if (isDemo()) return;
      await act("registry.dismissEventPrompt", registryId);
    },
    (detail) => ({ ...detail, eventPromptDismissed: true, showPlanEventButton: detail.linkedEvents.length === 0 })
  );
}

/** Takes the list off an event. */
export function useUnlinkEvent(registryId: string) {
  return useListChange<string>(
    () => registryId,
    async (eventId) => {
      if (isDemo()) return;
      await act("events.unlinkRegistryFromEvent", eventId, registryId);
    },
    (detail, eventId) => ({ ...detail, linkedEvents: detail.linkedEvents.filter((e) => e.id !== eventId) })
  );
}

/** The Store perks tab's "Done, hide this" and "Email me when a perk may be ready". */
export function useUpdateStorePerks(registryId: string) {
  return useListChange<{ welcomeBoxDone?: { store: string; done: boolean }; emails?: boolean }>(
    () => registryId,
    async (patch) => {
      if (isDemo()) return;
      await act("registry.updateStorePerks", registryId, patch);
    },
    (detail, patch) => ({
      ...detail,
      perkEmails: patch.emails ?? detail.perkEmails,
      // Show a welcome box as requested, or not, straight away.
      perkRows: detail.perkRows.map((row) =>
        row.welcomeBox && patch.welcomeBoxDone?.store === row.storeId
          ? {
              ...row,
              welcomeBox: {
                ...row.welcomeBox,
                status: patch.welcomeBoxDone.done
                  ? "done"
                  : row.welcomeBox.afterGift && row.giftCount === 0
                    ? "waiting"
                    : "ready",
              },
            }
          : row
      ),
    })
  );
}

// ---------------------------------------------------------------------------
// The baby checklist
// ---------------------------------------------------------------------------

/** "Add to registry" on the checklist: the item, in the category of the same name. */
export function useAddChecklistItem(registryId: string) {
  return useListChange<{ name: string; categoryId: string | null; quantity: number; essential: boolean; description?: string }>(
    () => registryId,
    async ({ name, categoryId, quantity, essential, description }) => {
      if (isDemo()) {
        demo.addItem(registryId, {
          title: name,
          external_url: null,
          image_url: null,
          price: null,
          quantity_needed: quantity,
          quantity_fulfilled: 0,
          category_id: categoryId,
          is_essential: essential,
          is_parent_purchased: false,
          is_open_to_used: false,
          minimum_condition: null,
          notes: description ?? null,
        });
        return;
      }
      await act(
        "registry.addRegistryItem",
        registryId,
        form({
          title: name,
          categoryId: categoryId ?? "",
          quantityNeeded: String(quantity),
          isEssential: String(essential),
          notes: description ?? "",
        })
      );
    }
  );
}

/** "Manually mark as registered" and "Undo" on the checklist. */
export function useToggleChecklistDismissed(registryId: string) {
  return useListChange<{ name: string; dismissed: boolean }>(
    () => registryId,
    async ({ name, dismissed }) => {
      if (isDemo()) {
        const list = demo.registry(registryId).registry.settings?.checklist_dismissed as string[] | undefined;
        const next = new Set((list ?? []).map((n) => n.toLowerCase()));
        if (dismissed) next.add(name.toLowerCase());
        else next.delete(name.toLowerCase());
        demo.updateSettings(registryId, { checklist_dismissed: [...next] });
        return;
      }
      await act("registry.toggleChecklistDismissed", registryId, name, dismissed);
    },
    (detail, { name, dismissed }) => {
      const list = new Set(((detail.registry.settings?.checklist_dismissed as string[] | undefined) ?? []).map((n) => n.toLowerCase()));
      if (dismissed) list.add(name.toLowerCase());
      else list.delete(name.toLowerCase());
      return { ...detail, registry: { ...detail.registry, settings: { ...detail.registry.settings, checklist_dismissed: [...list] } } };
    }
  );
}

/** A friendly message for an error from the server, Supabase or the network. */
export function errorMessage(error: unknown): string {
  const fallback = "Something went wrong. Try again.";
  if (!error) return fallback;
  // The website's own words.
  if (error instanceof ApiError) return error.message || fallback;
  const message = typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error);
  const code = typeof error === "object" && "code" in error ? String((error as { code: unknown }).code ?? "") : "";
  if (/network|fetch|timed? ?out|offline/i.test(message)) return "You're offline, or Regibee can't be reached. Try again.";
  // The access rules (RLS) turned it down.
  if (code === "42501" || /row-level security/i.test(message)) return "You don't have access to change this registry.";
  // Database and API errors are written for developers. Sign-in errors are written for people.
  if (/^(\d{2}[0-9A-Z]{3}|PGRST\d+)$/.test(code)) return fallback;
  return message || fallback;
}

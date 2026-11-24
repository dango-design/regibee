// "Look around first": the app with the website's sample registry
// (src/lib/demo-data.ts), kept in memory. Nothing in the demo reaches the
// database, and closing the app resets it.

import { getChecklistProgress } from "@shared/checklist-matching";
import type { DashboardCard, DashboardData } from "@shared/dashboard-page-types";
import {
  DEMO_CASH_FUNDS,
  DEMO_CATEGORIES,
  DEMO_ITEMS,
  DEMO_REGISTRY,
  demoDueDate,
  demoPurchases,
  demoSuggestions,
} from "@shared/demo-data";
import type { RegistryDeletionSummary } from "@shared/delete-confirmation";
import { GIFT_HOLD_DAYS, giftActivityAction, giverNameForOwner } from "@shared/gifts";
import { visibilityColumns, type ListVisibility } from "@shared/list-access";
import { copyForRegistry } from "@shared/registry-copy";
import {
  parseHiddenPlainLinkItems,
  parseRetailerRegistries,
  plainLinksByStore,
  storesWithRegistryLinks,
} from "@shared/retailers";
import { buildStorePerks, parseStorePerksState, readyPerkCount } from "@shared/store-perks";

import type { CashFund, Category, Gift, Item, Registry, RegistryDetail, Suggestion } from "@/lib/types";

export const DEMO_USER_ID = "demo-user";

let active = false;

/** True while someone is looking around without an account. */
export function isDemo() {
  return active;
}

export function setDemoActive(value: boolean) {
  if (active && !value) store = null;
  active = value;
}

interface DemoList {
  registry: Registry;
  categories: Category[];
  items: Item[];
  funds: CashFund[];
  suggestions: Suggestion[];
}

interface Store {
  lists: Map<string, DemoList>;
  gifts: Map<string, Gift[]>;
}

let store: Store | null = null;

function today() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const HOUR_MS = 3_600_000;

// The website's sample gifts were all given before gift holds existed, so they
// count as given. Here two are still held, reserved this many hours ago, so the
// demo shows both kinds (src/lib/gifts.ts).
const HELD_HOURS_AGO: Record<string, number> = { "purchase-10": 3, "purchase-9": 30 };

const BABY_CATEGORIES = [
  "Nursery & Sleep",
  "Feeding",
  "Diapering",
  "Gear & Travel",
  "Bath",
  "Clothing",
  "Health & Safety",
  "Toys & Books",
  "Maternity & Postpartum",
  "Gifts & Extras",
];

function build(): Store {
  const day = today();
  const registry: Registry = {
    id: "demo",
    owner_id: DEMO_USER_ID,
    title: DEMO_REGISTRY.title,
    slug: DEMO_REGISTRY.slug,
    event_date: demoDueDate(day),
    is_public: DEMO_REGISTRY.is_public,
    is_private: false,
    listed_on_profile: true,
    description: DEMO_REGISTRY.description,
    photo_url: null,
    registry_type: "baby",
    event_type: null,
    honoree_names: DEMO_REGISTRY.honoree_names,
    settings: { ...DEMO_REGISTRY.settings, tax_enabled: true },
    created_at: new Date().toISOString(),
  };
  const categories: Category[] = DEMO_CATEGORIES.map((c) => ({ ...c, registry_id: "demo" }));
  const items: Item[] = DEMO_ITEMS.map((item) => ({
    ...item,
    registry_id: "demo",
    minimum_condition: (item.minimum_condition ?? null) as Item["minimum_condition"],
    created_at: new Date().toISOString(),
    // demo.registry fills these in from the gifts.
    purchases: [],
  }));
  const titles = new Map<string, string>([
    ...items.map((i) => [i.id, i.title] as const),
    ...DEMO_CASH_FUNDS.map((f) => [f.id, f.title] as const),
  ]);
  const gifts: Gift[] = demoPurchases(day).map((p) => {
    const heldHoursAgo = HELD_HOURS_AGO[p.id];
    const reservedAt = heldHoursAgo === undefined ? null : Date.now() - heldHoursAgo * HOUR_MS;
    return {
      id: p.id,
      buyer_name: p.buyer_name,
      buyer_email: p.buyer_email ?? null,
      quantity: p.quantity,
      amount: p.amount ?? null,
      status: p.status,
      reserved_until: reservedAt === null ? null : new Date(reservedAt + GIFT_HOLD_DAYS * 24 * HOUR_MS).toISOString(),
      message: p.message ?? null,
      created_at: reservedAt === null ? p.created_at : new Date(reservedAt).toISOString(),
      registry_item_id: p.registry_item_id ?? null,
      cash_fund_id: p.cash_fund_id ?? null,
      kind: p.cash_fund_id ? "fund" : "item",
      for_title: titles.get((p.registry_item_id ?? p.cash_fund_id) as string) ?? "",
      item_price: items.find((i) => i.id === p.registry_item_id)?.price ?? null,
      item_bought_by_owner: Boolean(items.find((i) => i.id === p.registry_item_id)?.is_parent_purchased),
    };
  });
  const list: DemoList = {
    registry,
    categories,
    items,
    funds: DEMO_CASH_FUNDS.map((f) => ({ ...f, registry_id: "demo" })),
    suggestions: demoSuggestions(day).map((s) => ({ ...s, external_url: s.external_url ?? null, notes: s.notes ?? null })) as Suggestion[],
  };
  return { lists: new Map([["demo", list]]), gifts: new Map([["demo", gifts]]) };
}

function current() {
  store ??= build();
  return store;
}

function listFor(id: string) {
  const list = current().lists.get(id);
  if (!list) throw new Error("That registry isn't in the demo.");
  return list;
}

function giftsFor(id: string) {
  return [...(current().gifts.get(id) ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function card(list: DemoList): DashboardCard {
  const r = list.registry;
  const active = giftsFor(r.id).filter((g) => g.status !== "cancelled" && g.kind === "item");
  return {
    id: r.id,
    owner_id: r.owner_id,
    title: r.title,
    slug: r.slug,
    event_date: r.event_date,
    is_public: r.is_public,
    is_private: Boolean(r.is_private),
    listed_on_profile: Boolean(r.listed_on_profile),
    photo_url: r.photo_url,
    registry_type: r.registry_type ?? "baby",
    event_type: r.event_type,
    honoree_names: r.honoree_names,
    settings: r.settings ?? null,
    created_at: r.created_at,
    role: "owner",
    totalItems: list.items.length,
    fulfilledItems: list.items.filter((i) => i.quantity_fulfilled >= i.quantity_needed).length,
    totalValue: list.items.reduce((sum, i) => sum + (i.price ?? 0), 0),
    recentActivity: active.slice(0, 3).map((g) => ({ id: g.id, name: giverNameForOwner(g), action: giftActivityAction(g) })),
    reservationsHidden: false,
  };
}

function setList(id: string, change: (list: DemoList) => DemoList) {
  current().lists.set(id, change(listFor(id)));
}

function setItems(registryId: string, change: (items: Item[]) => Item[]) {
  setList(registryId, (list) => ({ ...list, items: change(list.items) }));
}

function itemRegistry(itemId: string) {
  for (const [id, list] of current().lists) if (list.items.some((i) => i.id === itemId)) return id;
  throw new Error("That item isn't in the demo.");
}

let nextId = 1;
const newId = (prefix: string) => `${prefix}-new-${nextId++}`;

export const demo = {
  dashboard(): DashboardData {
    const day = today();
    const weekAgo = Date.now() - 7 * 24 * HOUR_MS;
    const lists = [...current().lists.values()].reverse();
    return {
      owned: lists.map(card),
      shared: [],
      giftsThisWeek: lists
        .flatMap((l) => giftsFor(l.registry.id))
        .filter((g) => g.status !== "cancelled" && Date.parse(g.created_at) >= weekAgo).length,
      followRequestCount: 0,
      showProfilePrompt: false,
      // The app's home doesn't show "Coming up": Events has its own tab in the tab bar.
      upcomingEvents: [],
      today: day,
    };
  },
  registry(id: string): RegistryDetail {
    const list = listFor(id);
    const r = list.registry;
    // Read from the gifts each time, so cancelling a gift shows on its item too.
    const gifts = giftsFor(id);
    const items = list.items.map((item) => ({
      ...item,
      purchases: gifts
        .filter((g) => g.registry_item_id === item.id)
        .map(({ id, status, reserved_until, buyer_name, quantity, created_at, message, buyer_email }) => ({
          id,
          status,
          reserved_until,
          buyer_name,
          quantity,
          created_at,
          message,
          buyer_email,
        })),
    }));
    // The same notices as the website's demo, worked out the same way (src/lib/list-page.ts).
    const settings = r.settings ?? null;
    const linkedRegistries = r.registry_type === "baby" ? parseRetailerRegistries(settings) : null;
    const hidden = new Set(parseHiddenPlainLinkItems(settings));
    const plainLinkGroups = linkedRegistries
      ? [...plainLinksByStore(items, linkedRegistries.map((l) => l.store))]
          .map(([storeId, group]) => ({
            storeId,
            items: group.filter((i) => !hidden.has(i.id)).map((i) => ({ id: i.id, title: i.title })),
          }))
          .filter((group) => group.items.length > 0)
      : [];
    const perkRows = linkedRegistries
      ? buildStorePerks({
          items,
          purchases: gifts,
          linkedRegistries,
          dueDate: r.event_date,
          today: today(),
          state: parseStorePerksState(settings),
        })
      : [];
    const suggestionsPending = list.suggestions.filter((s) => s.status === "pending" || s.status === "offering").length;
    return {
      registry: r,
      role: "owner",
      categories: list.categories,
      items,
      funds: list.funds,
      gifts,
      suggestions: list.suggestions,
      pendingSuggestions: suggestionsPending,
      reservationsHidden: false,
      turnedOnByExchange: false,
      linkedEvents: [],
      showChecklist: copyForRegistry(r).checklistAvailable,
      checklistProgress: getChecklistProgress(
        items.map((i) => i.title),
        (settings?.checklist_dismissed as string[] | undefined) ?? undefined
      ),
      linkedRegistries,
      registryLinkStores: linkedRegistries ? storesWithRegistryLinks(items.map((i) => i.external_url)) : [],
      plainLinkGroups,
      perkRows,
      perkEmails: parseStorePerksState(settings).emails,
      readyPerkCount: readyPerkCount(perkRows),
      zipCode: settings?.tax_enabled !== false ? ((settings?.zip_code as string | undefined) ?? null) : null,
      canPlanEvents: false,
      eventPromptDismissed: true,
      showPlanEventButton: false,
    };
  },
  addItem(registryId: string, values: Omit<Item, "id" | "registry_id" | "sort_order" | "created_at" | "purchases">) {
    const item: Item = {
      ...values,
      id: newId("item"),
      registry_id: registryId,
      sort_order: 0,
      created_at: new Date().toISOString(),
      purchases: [],
    };
    setItems(registryId, (items) => [item, ...items]);
    return { id: item.id, title: item.title };
  },
  updateItem(itemId: string, patch: Partial<Item>) {
    setItems(itemRegistry(itemId), (items) => items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
  },
  deleteItem(itemId: string) {
    const registryId = itemRegistry(itemId);
    // Guests' gifts go with the item, as in the database.
    const gifts = current().gifts.get(registryId);
    if (gifts) current().gifts.set(registryId, gifts.filter((g) => g.registry_item_id !== itemId));
    setItems(registryId, (items) => items.filter((i) => i.id !== itemId));
  },
  cancelGift(registryId: string, giftId: string) {
    const gifts = current().gifts.get(registryId) ?? [];
    const gift = gifts.find((g) => g.id === giftId);
    current().gifts.set(
      registryId,
      gifts.map((g) => (g.id === giftId ? { ...g, status: "cancelled" } : g))
    );
    if (gift?.registry_item_id) {
      setItems(registryId, (items) =>
        items.map((i) => (i.id === gift.registry_item_id ? { ...i, quantity_fulfilled: Math.max(0, i.quantity_fulfilled - gift.quantity) } : i))
      );
    }
  },
  createRegistry(
    input: {
      title: string;
      registry_type: Registry["registry_type"];
      event_type: Registry["event_type"];
      event_date: string | null;
      description: string | null;
      visibility: ListVisibility;
    },
    withBabyCategories: boolean
  ) {
    const id = newId("registry");
    const registry: Registry = {
      id,
      owner_id: DEMO_USER_ID,
      title: input.title,
      slug: id,
      event_date: input.event_date,
      ...visibilityColumns(input.visibility),
      description: input.description,
      photo_url: null,
      registry_type: input.registry_type,
      event_type: input.event_type,
      honoree_names: null,
      created_at: new Date().toISOString(),
    };
    current().lists.set(id, {
      registry,
      categories: (withBabyCategories ? BABY_CATEGORIES : []).map((name, index) => ({
        id: newId("cat"),
        registry_id: id,
        name,
        sort_order: index,
      })),
      items: [],
      funds: [],
      suggestions: [],
    });
    current().gifts.set(id, []);
    return { id };
  },
  updateRegistry(registryId: string, patch: Partial<Registry>) {
    setList(registryId, (list) => ({ ...list, registry: { ...list.registry, ...patch } }));
  },
  updateSettings(registryId: string, patch: Record<string, unknown>) {
    setList(registryId, (list) => ({
      ...list,
      registry: { ...list.registry, settings: { ...(list.registry.settings ?? {}), ...patch } },
    }));
  },
  registryDeletionSummary(registryId: string): RegistryDeletionSummary {
    const list = listFor(registryId);
    return {
      deletedItems: list.items.length,
      movedItems: 0,
      placedItems: 0,
      funds: list.funds.length,
      gifts: giftsFor(registryId).filter((g) => g.status !== "cancelled").length,
    };
  },
  deleteRegistry(registryId: string) {
    current().lists.delete(registryId);
    current().gifts.delete(registryId);
  },
  createCategory(registryId: string, name: string): Category {
    const list = listFor(registryId);
    const category: Category = { id: newId("cat"), registry_id: registryId, name, sort_order: list.categories.length };
    setList(registryId, (l) => ({ ...l, categories: [...l.categories, category] }));
    return category;
  },
  renameCategory(registryId: string, categoryId: string, name: string) {
    setList(registryId, (l) => ({
      ...l,
      categories: l.categories.map((c) => (c.id === categoryId ? { ...c, name } : c)),
    }));
  },
  deleteCategory(registryId: string, categoryId: string) {
    setList(registryId, (l) => ({
      ...l,
      categories: l.categories.filter((c) => c.id !== categoryId),
      items: l.items.map((i) => (i.category_id === categoryId ? { ...i, category_id: null } : i)),
    }));
  },
  saveFund(registryId: string, fundId: string | null, input: { title: string; description: string; goalAmount: number | null }) {
    const values = {
      title: input.title.trim(),
      description: input.description.trim() || null,
      goal_amount: input.goalAmount && input.goalAmount > 0 ? input.goalAmount : null,
    };
    setList(registryId, (l) => ({
      ...l,
      funds: fundId
        ? l.funds.map((f) => (f.id === fundId ? { ...f, ...values } : f))
        : [...l.funds, { id: newId("fund"), registry_id: registryId, current_amount: 0, ...values }],
    }));
  },
  deleteFund(registryId: string, fundId: string) {
    setList(registryId, (l) => ({ ...l, funds: l.funds.filter((f) => f.id !== fundId) }));
    current().gifts.set(registryId, (current().gifts.get(registryId) ?? []).filter((g) => g.cash_fund_id !== fundId));
  },
  answerSuggestion(registryId: string, suggestionId: string, action: "add" | "accept" | "decline") {
    const list = listFor(registryId);
    const suggestion = list.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;
    const status = ({ add: "added", accept: "accepted", decline: "declined" } as const)[action];
    setList(registryId, (l) => ({
      ...l,
      suggestions: l.suggestions.map((s) => (s.id === suggestionId ? { ...s, status } : s)),
    }));
    if (action === "add") {
      demo.addItem(registryId, {
        title: suggestion.title,
        external_url: suggestion.external_url,
        image_url: null,
        price: suggestion.price,
        quantity_needed: 1,
        quantity_fulfilled: 0,
        category_id: null,
        is_essential: false,
        is_parent_purchased: false,
        is_open_to_used: false,
        minimum_condition: null,
        notes: suggestion.notes,
      });
    }
  },
};

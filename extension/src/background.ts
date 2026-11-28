// The extension's background worker. It holds the session, makes every call
// to Regibee, and decides what happens when a store registry page loads.

import {
  CONNECT_PATH,
  extensionCanReadLink,
  itemMatchKey,
  parseReadProduct,
  type AddProductResponse,
  type AddResponse,
  type CategoryResponse,
  type CheckResponse,
  type ExtensionRegistry,
  type ExtensionSession,
  type IdeaResponse,
  type ImportCheckResponse,
  type WishlistSyncResponse,
  type ImportItem,
  type ImportResponse,
  type LinkResponse,
  MAX_ITEMS_PER_REQUEST,
  type MeResponse,
  type ReadProduct,
  type StoreItem,
  type TaxResponse,
  type UndoResponse,
  isUuid,
} from "@/lib/extension";
import { classifyStoreLink, extensionStoreForPage, storeItemKey, type StoreId } from "@/lib/retailers";
import {
  ELFSTER_ORIGINS,
  ELFSTER_SYNC_EVERY_MS,
  ELFSTER_SYNC_PAGE,
  isElfsterUrl,
  MAX_SYNC_ITEMS,
} from "@/lib/wishlist-import";
import { api, NotConnectedError } from "./api";
import { REGIBEE_URL } from "./config";
import { readElfsterWishlist, type WishlistPage } from "./elfster-reader";
import { readProductPage, type ProductPage } from "./product-reader";
import type {
  AutoImportResult,
  BackgroundRequest,
  CheckResult,
  MenuClick,
  PopupState,
  RegistriesResult,
  Result,
} from "./messages";
import { clearAccount, load, markSeen, save, seenKeys } from "./storage";

// Registry names rarely change, so the list is reused for a while.
const REGISTRIES_MAX_AGE_MS = 10 * 60 * 1000;
const BADGE_COLOR = "#004659";

function keysOf(items: { url: string }[]): string[] {
  return items.map((item) => storeItemKey(item.url)).filter((key): key is string => Boolean(key));
}

async function registries(refresh = false): Promise<RegistriesResult> {
  const stored = await load("registries", "registriesFetchedAt", "user", "registryId", "ideaRecipients");
  let list = stored.registries;
  let user = stored.user;
  let ideaRecipients = stored.ideaRecipients ?? [];
  const fresh =
    stored.registriesFetchedAt &&
    Date.now() - stored.registriesFetchedAt < REGISTRIES_MAX_AGE_MS &&
    // Lists saved by an older version have no categories.
    stored.registries?.every((r) => Array.isArray(r.categories));
  if (refresh || !list || !user || !fresh) {
    const me = await api<MeResponse>("/api/extension/me");
    list = me.registries;
    user = me.user;
    ideaRecipients = me.ideaRecipients ?? [];
    await save({ registries: list, user, ideaRecipients, registriesFetchedAt: Date.now() });
  }
  // Keep the chosen registry if it's still there; otherwise use the newest.
  let registryId = stored.registryId && list.some((r) => r.id === stored.registryId) ? stored.registryId : null;
  if (!registryId && list.length > 0) {
    registryId = list[0].id;
    await save({ registryId });
  }
  return { user, registries: list, registryId, ideaRecipients };
}

/** Puts who an idea was just saved for first in the names the form offers. */
async function rememberRecipient(name: string): Promise<void> {
  // An idea saved without saying who it's for has no name to offer.
  if (!name.trim()) return;
  const { ideaRecipients = [] } = await load("ideaRecipients");
  const key = name.toLowerCase();
  await save({ ideaRecipients: [name, ...ideaRecipients.filter((n) => n.toLowerCase() !== key)].slice(0, 8) });
}

/** Adds a category the form just made to the saved lists, so the form offers it next time. */
async function rememberCategory(registryId: string, category: CategoryResponse["category"]): Promise<void> {
  const { registries: list } = await load("registries");
  if (!list) return;
  await save({
    registries: list.map((r) =>
      r.id === registryId && !r.categories.some((c) => c.id === category.id)
        ? { ...r, categories: [...r.categories, category] }
        : r
    ),
  });
}

async function currentRegistry(): Promise<ExtensionRegistry | null> {
  const { registries: list, registryId } = await registries();
  return list.find((r) => r.id === registryId) ?? null;
}

/**
 * Gives items already on Regibee with a plain store link the registry link
 * from the store's page. It only makes gifts count toward the store
 * registry, so it happens in both modes without asking.
 */
async function link(registryId: string, items: StoreItem[]): Promise<LinkResponse["linked"]> {
  if (items.length === 0) return [];
  const { linked } = await api<LinkResponse>("/api/extension/items", {
    method: "PATCH",
    body: { registryId, items },
  });
  // The home screen counts plain links, so read the registries again next time.
  if (linked.length > 0) await save({ registriesFetchedAt: 0 });
  return linked;
}

/**
 * Which items are already on the registry. Those on it with a plain store
 * link get their registry link now.
 */
async function check(registryId: string, items: StoreItem[]): Promise<CheckResult> {
  const { existing, plain = [] } = await api<CheckResponse>("/api/extension/items/check", {
    method: "POST",
    body: { registryId, urls: items.map((i) => i.url) },
  });
  await markSeen(registryId, existing);
  const plainKeys = new Set(plain);
  let linked: LinkResponse["linked"] = [];
  try {
    linked = await link(registryId, items.filter((i) => plainKeys.has(storeItemKey(i.url) ?? "")));
  } catch (error) {
    if (error instanceof NotConnectedError) throw error;
    // The check still stands. The next visit tries the swap again.
    console.warn("Regibee: couldn't swap in registry links.", error);
  }
  return { existing, linked };
}

async function add(registryId: string, items: StoreItem[], listed: string[]): Promise<AddResponse> {
  const result = await api<AddResponse>("/api/extension/items", {
    method: "POST",
    body: { registryId, items },
  });
  // Everything the owner saw in the popup counts as seen, added or not, so
  // automatic mode won't add an item they chose to leave out.
  await markSeen(registryId, [...listed, ...keysOf(items)]);
  return result;
}

// ── Importing a wishlist from another site ──────────────────────────────
// The popup reads an Elfster wishlist and sends its items here. A long
// wishlist goes to Regibee a few requests at a time.

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let at = 0; at < items.length; at += MAX_ITEMS_PER_REQUEST) result.push(items.slice(at, at + MAX_ITEMS_PER_REQUEST));
  return result;
}

/**
 * What's been bought on Elfster goes only to the sync route, which keeps it
 * for guests. Checking and importing don't need it.
 */
function withoutGiven(items: ImportItem[]): ImportItem[] {
  return items.map((item) => ({ ...item, given: 0 }));
}

/** Which of a wishlist's items are already on the registry, and whether it's kept in sync. */
async function importCheck(registryId: string, items: ImportItem[], wishlistId?: string): Promise<ImportCheckResponse> {
  const existing = new Set<string>();
  let synced: boolean | undefined;
  for (const part of chunks(withoutGiven(items))) {
    const result = await api<ImportCheckResponse>("/api/extension/import/check", {
      method: "POST",
      body: { registryId, items: part, wishlistId },
    });
    for (const key of result.existing) existing.add(key);
    synced = synced || result.synced;
  }
  // A wishlist with no items still asks, to learn whether it's synced.
  if (items.length === 0 && wishlistId) {
    const result = await api<ImportCheckResponse>("/api/extension/import/check", {
      method: "POST",
      body: { registryId, items: [], wishlistId },
    });
    synced = result.synced;
  }
  return { existing: [...existing], synced };
}

async function importItems(registryId: string, items: ImportItem[]): Promise<ImportResponse> {
  const total: ImportResponse = { added: [], skipped: 0 };
  for (const part of chunks(withoutGiven(items))) {
    const result = await api<ImportResponse>("/api/extension/import", {
      method: "POST",
      body: { registryId, items: part },
    });
    total.added.push(...result.added);
    total.skipped += result.skipped;
  }
  // Automatic mode shouldn't add these again from a store's registry page.
  await markSeen(registryId, keysOf(items.flatMap((item) => (item.url ? [{ url: item.url }] : []))));
  // The home screen counts plain store links, so read the registries again next time.
  if (total.added.length > 0) await save({ registriesFetchedAt: 0 });
  return total;
}

async function recordChecked(store: StoreId, count: number) {
  const { lastChecked = {} } = await load("lastChecked");
  lastChecked[store] = { at: Date.now(), count };
  await save({ lastChecked });
}

function setBadge(tabId: number | undefined, count: number) {
  if (tabId === undefined) return;
  void chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
  void chrome.action.setBadgeText({ tabId, text: count > 0 ? String(Math.min(count, 99)) : "" });
}

/**
 * A store registry page finished loading. Ask first: show how many new items
 * there are on the toolbar button. Automatic: add the new items now, and the
 * content script shows a notice with Undo.
 */
async function onPageItems(store: StoreId, items: StoreItem[], tabId?: number): Promise<AutoImportResult> {
  const none: AutoImportResult = { added: [], linked: [], registry: null };
  await recordChecked(store, items.length);
  const { session, mode = "ask" } = await load("session", "mode");
  if (!session || items.length === 0) return none;

  const registry = await currentRegistry();
  if (!registry) return none;

  const { existing, linked } = await check(registry.id, items);
  const result: AutoImportResult = { added: [], linked, registry: { id: registry.id, title: registry.title } };
  const onRegistry = new Set(existing);
  const fresh = items.filter((item) => {
    const key = storeItemKey(item.url);
    return key && !onRegistry.has(key);
  });

  if (mode !== "auto") {
    setBadge(tabId, fresh.length);
    return result;
  }

  const seen = await seenKeys(registry.id);
  const unseen = fresh.filter((item) => !seen.has(storeItemKey(item.url)!));
  setBadge(tabId, 0);
  if (unseen.length === 0) return result;
  const { added } = await add(registry.id, unseen, []);
  return { ...result, added };
}

async function onConnectSession(session: ExtensionSession) {
  await clearAccount();
  await save({ session });
  // Check the session works before telling the page it's connected.
  await registries(true);
}

async function disconnect() {
  try {
    await api("/api/extension/disconnect", { method: "POST" });
  } catch {
    // Forget the session either way. If the call failed, it expires on its own.
  }
  await clearAccount();
}

async function popupState(): Promise<PopupState> {
  const { session, user, mode = "ask", productMode = "list", registryId, lastChecked = {} } = await load(
    "session",
    "user",
    "mode",
    "productMode",
    "registryId",
    "lastChecked"
  );
  return {
    connected: Boolean(session),
    user: user ?? null,
    mode,
    productMode,
    registryId: registryId ?? null,
    lastChecked,
  };
}

/**
 * True for a content script on the Regibee site. Only the origin can be
 * checked: when the site moves to the Connect page without a full load,
 * Chrome still reports the page it loaded on. The content script checks the
 * current path itself.
 */
function isRegibeeSite(sender: chrome.runtime.MessageSender): boolean {
  const from = sender.origin ?? sender.url;
  if (!from) return false;
  try {
    const parsed = new URL(from);
    const site = new URL(REGIBEE_URL);
    // regibee.com redirects to www.regibee.com, so accept both.
    return (
      parsed.protocol === site.protocol &&
      parsed.port === site.port &&
      parsed.hostname.replace(/^www\./, "") === site.hostname.replace(/^www\./, "")
    );
  } catch {
    return false;
  }
}

// ── Reading a product link for the site ─────────────────────────────────
// The add and edit item dialogs on regibee.com ask for this when the owner
// pastes a link at a store that blocks the server's fetch, like Amazon. The
// page opens in a background tab next to the owner's, the product reader
// reads it there, and the tab closes again.

// Store pages keep loading ads long after the product is on the page. Read
// whatever is there by then.
const READ_LOAD_TIMEOUT_MS = 15_000;
/** Tabs opened to read a product. A store page in one doesn't count as a visit. */
const readingTabs = new Set<number>();

/** The tab once its page has loaded, or when time runs out, whichever comes first. */
function waitForLoad(tabId: number, timeoutMs: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (settle: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      settle();
    };
    const onUpdated = (id: number, info: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (id === tabId && info.status === "complete") finish(() => resolve(tab));
    };
    const onRemoved = (id: number) => {
      if (id === tabId) finish(() => reject(new Error("The tab closed before the page loaded.")));
    };
    const timer = setTimeout(() => finish(() => void chrome.tabs.get(tabId).then(resolve, reject)), timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    // In case it finished before the listeners were in place.
    void chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete" && tab.url && tab.url !== "about:blank") finish(() => resolve(tab));
    }, () => {});
  });
}

/** Opens a store product link in a background tab and reads the product. Null when it couldn't. */
async function readProductTab(url: string, from: chrome.tabs.Tab | undefined): Promise<ReadProduct | null> {
  let tabId: number | undefined;
  try {
    const tab = await chrome.tabs.create({
      url,
      active: false,
      // Right next to the owner's tab, so it's clear where it came from.
      ...(from?.id !== undefined ? { windowId: from.windowId, index: from.index + 1 } : {}),
    });
    tabId = tab.id;
    if (tabId === undefined) return null;
    readingTabs.add(tabId);
    const loaded = await waitForLoad(tabId, READ_LOAD_TIMEOUT_MS);
    // A short link can lead anywhere, and a store can show a robot check
    // instead. Read only the store's product pages.
    const kind = classifyStoreLink(loaded.url)?.kind;
    if (kind !== "plain" && kind !== "registry") return null;
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: readProductPage });
    const page = injection?.result as ProductPage | undefined;
    return page?.isProduct ? parseReadProduct(page) : null;
  } finally {
    if (tabId !== undefined) {
      readingTabs.delete(tabId);
      await chrome.tabs.remove(tabId).catch(() => {});
    }
  }
}

// One read at a time, so a row of store tabs never opens at once. Every
// Regibee tab shares this worker, and two of them can ask at the same
// moment. Each read starts when the one before it ends, whichever tab asked.
// Refusing the second one made the site fall back to its own server, which
// Amazon blocks.
let lastRead: Promise<unknown> = Promise.resolve();

/** Reads a store product link for a Regibee page, after any read already under way. */
function readProductLink(url: string, from: chrome.tabs.Tab | undefined): Promise<ReadProduct | null> {
  if (!extensionCanReadLink(url)) return Promise.reject(new Error("The extension can't read that link."));
  const read = lastRead.then(async () => {
    // The Regibee tab that asked may have closed while this read waited.
    // Nothing is listening for the answer then, so don't open the store.
    if (from?.id !== undefined && !(await chrome.tabs.get(from.id).catch(() => null))) return null;
    return readProductTab(url, from);
  });
  // A failed read mustn't stop the ones after it.
  lastRead = read.catch(() => {});
  return read;
}

// ── Syncing an Elfster wishlist in the background ───────────────────────
// A list kept in sync with an Elfster wishlist (see "Keeping a list in sync"
// in extension/README.md) syncs each time the owner opens the extension on
// the wishlist. When the owner has also allowed the extension to read
// Elfster, their list's page on Regibee asks it to sync too, at most once an
// hour (src/components/elfster-sync.tsx). It opens a small page on Elfster in
// a background tab next to the list's, reads the wishlist there as whoever is
// signed in to Elfster, sends it to the sync route and closes the tab.
//
// Anything that stops it, such as no access to Elfster or nobody signed in
// there, stops it quietly. The page only learns whether it synced, never
// what the wishlist holds: what's been bought on Elfster goes only to the
// server, which keeps it for guests.

/** True when the owner allowed the extension to read Elfster. */
async function canReadElfster(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: ELFSTER_ORIGINS });
  } catch {
    return false;
  }
}

function elfsterTryKey(registryId: string, wishlistId: string): string {
  return `${registryId}:${wishlistId}`;
}

/** Whether the extension can sync the wishlist in the background now. */
async function elfsterSyncReady(registryId: string, wishlistId: string): Promise<boolean> {
  if (!isUuid(registryId) || !isUuid(wishlistId)) return false;
  const { session, elfsterTries = {} } = await load("session", "elfsterTries");
  if (!session) return false;
  const last = elfsterTries[elfsterTryKey(registryId, wishlistId)];
  if (last && Date.now() - last < ELFSTER_SYNC_EVERY_MS) return false;
  return canReadElfster();
}

/** Opens a page on Elfster in a background tab and reads the wishlist there. Null when it couldn't. */
async function readElfsterTab(wishlistId: string, from: chrome.tabs.Tab | undefined): Promise<WishlistPage | null> {
  let tabId: number | undefined;
  try {
    const tab = await chrome.tabs.create({
      url: ELFSTER_SYNC_PAGE,
      active: false,
      ...(from?.id !== undefined ? { windowId: from.windowId, index: from.index + 1 } : {}),
    });
    tabId = tab.id;
    if (tabId === undefined) return null;
    readingTabs.add(tabId);
    const loaded = await waitForLoad(tabId, READ_LOAD_TIMEOUT_MS);
    // Only on Elfster's own site, where the reader can ask its API.
    if (!isElfsterUrl(loaded.url)) return null;
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: readElfsterWishlist, args: [wishlistId] });
    return (injection?.result as WishlistPage | undefined) ?? null;
  } finally {
    if (tabId !== undefined) {
      readingTabs.delete(tabId);
      await chrome.tabs.remove(tabId).catch(() => {});
    }
  }
}

/** Syncs a list with its Elfster wishlist for the list's page. True when it did. */
async function syncElfsterInBackground(registryId: string, wishlistId: string, from: chrome.tabs.Tab | undefined): Promise<boolean> {
  if (!(await elfsterSyncReady(registryId, wishlistId))) return false;
  const { elfsterTries = {} } = await load("elfsterTries");
  // Old tries are no use: the hour has passed for them.
  const now = Date.now();
  const kept = Object.fromEntries(Object.entries(elfsterTries).filter(([, at]) => now - at < ELFSTER_SYNC_EVERY_MS));
  await save({ elfsterTries: { ...kept, [elfsterTryKey(registryId, wishlistId)]: now } });

  // Takes its turn with the product reads, so only one tab opens at a time.
  const read = lastRead.then(() => readElfsterTab(wishlistId, from));
  lastRead = read.catch(() => {});
  const page = await read.catch(() => null);
  // Not signed in to Elfster, or Elfster didn't answer. An empty wishlist
  // has nothing to sync, and an empty answer could be a session that can't
  // see the wishlist.
  if (!page || page.failed || !page.isWishlist || page.wishlistId !== wishlistId || page.wishes.length === 0) return false;
  try {
    await api<WishlistSyncResponse>("/api/extension/import/sync", {
      method: "POST",
      body: { registryId, wishlistId, items: page.wishes.slice(0, MAX_SYNC_ITEMS), background: true },
    });
    return true;
  } catch (error) {
    console.warn("Regibee: couldn't sync the Elfster wishlist.", error);
    return false;
  }
}

async function handle(request: BackgroundRequest, sender: chrome.runtime.MessageSender): Promise<unknown> {
  // Only this extension's own pages and content scripts can message it, but
  // check the content-script messages came from the pages they belong to.
  if (sender.id !== chrome.runtime.id) throw new Error("Unknown sender");

  switch (request.type) {
    case "state":
      return popupState();
    case "open-connect":
      await chrome.tabs.create({ url: `${REGIBEE_URL}${CONNECT_PATH}` });
      return null;
    case "disconnect":
      await disconnect();
      return null;
    case "registries":
      return registries(request.refresh);
    case "set-registry":
      await save({ registryId: request.registryId });
      return null;
    case "set-mode":
      await save({ mode: request.mode === "auto" ? "auto" : "ask" });
      return null;
    case "set-product-mode":
      await save({ productMode: request.mode === "idea" ? "idea" : "list" });
      return null;
    case "check":
      await recordChecked(request.store, request.items.length);
      return check(request.registryId, request.items);
    case "add":
      return add(request.registryId, request.items, request.listed);
    case "undo": {
      const result = await api<UndoResponse>("/api/extension/items", {
        method: "DELETE",
        body: { registryId: request.registryId, itemIds: request.itemIds },
      });
      return result;
    }
    case "check-url": {
      const key = itemMatchKey(request.url);
      if (!key) return { exists: false, plain: false };
      const { existing, plain = [] } = await api<CheckResponse>("/api/extension/items/check", {
        method: "POST",
        body: { registryId: request.registryId, urls: [request.url] },
      });
      return { exists: existing.includes(key), plain: plain.includes(key) };
    }
    case "import-check":
      return importCheck(request.registryId, request.items, request.wishlistId);
    case "import":
      return importItems(request.registryId, request.items);
    case "import-sync":
      return api<WishlistSyncResponse>("/api/extension/import/sync", {
        method: "POST",
        body: { registryId: request.registryId, wishlistId: request.wishlistId, items: request.items },
      });
    case "import-stop":
      return api<{ stopped: boolean }>("/api/extension/import/stop", {
        method: "POST",
        body: { registryId: request.registryId, wishlistId: request.wishlistId },
      });
    case "link":
      return { linked: await link(request.registryId, request.items) } satisfies LinkResponse;
    case "menu-click": {
      // Only the popup that the click just opened gets it.
      const click = lastMenuClick && Date.now() - lastMenuClick.at < MENU_CLICK_MAX_AGE_MS ? lastMenuClick : null;
      lastMenuClick = null;
      return click ? ({ tabId: click.tabId, imageUrl: click.imageUrl } satisfies MenuClick) : null;
    }
    case "add-product": {
      const result = await api<AddProductResponse>("/api/extension/product", {
        method: "POST",
        body: { registryId: request.registryId, item: request.item },
      });
      // Automatic mode shouldn't add it again from the store's registry page.
      const key = storeItemKey(request.item.url);
      if (key) await markSeen(request.registryId, [key]);
      return result;
    }
    case "add-category": {
      const result = await api<CategoryResponse>("/api/extension/categories", {
        method: "POST",
        body: { registryId: request.registryId, name: request.name },
      });
      await rememberCategory(request.registryId, result.category);
      return result;
    }
    case "estimate-tax":
      return api<TaxResponse>("/api/extension/tax", {
        method: "POST",
        body: { registryId: request.registryId, price: request.price },
      });
    case "add-idea": {
      const result = await api<IdeaResponse>("/api/extension/ideas", { method: "POST", body: { idea: request.idea } });
      await rememberRecipient(result.added.recipient);
      return result;
    }
    case "page-items": {
      // A tab the extension opened to read a product link isn't the owner's visit.
      if (sender.tab?.id !== undefined && readingTabs.has(sender.tab.id)) {
        return { added: [], linked: [], registry: null } satisfies AutoImportResult;
      }
      const store = extensionStoreForPage(sender.url);
      if (!store || store.id !== request.store) throw new Error("Not a store registry page");
      return onPageItems(store.id, request.items, sender.tab?.id);
    }
    case "connect-session":
      if (!isRegibeeSite(sender)) throw new Error("Not the Regibee site");
      await onConnectSession(request.session);
      return null;
    case "connect-cancel":
      if (isRegibeeSite(sender) && sender.tab?.id !== undefined) {
        await chrome.tabs.remove(sender.tab.id);
      }
      return null;
    case "read-product":
      if (!isRegibeeSite(sender)) throw new Error("Not the Regibee site");
      return readProductLink(request.url, sender.tab);
    case "can-sync-elfster":
      if (!isRegibeeSite(sender)) throw new Error("Not the Regibee site");
      return elfsterSyncReady(request.registryId, request.wishlistId);
    case "sync-elfster":
      if (!isRegibeeSite(sender)) throw new Error("Not the Regibee site");
      return syncElfsterInBackground(request.registryId, request.wishlistId, sender.tab);
  }
}

chrome.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
  handle(request, sender)
    .then((data) => sendResponse({ ok: true, data } satisfies Result<unknown>))
    .catch((error: unknown) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        notConnected: error instanceof NotConnectedError,
      } satisfies Result<unknown>)
    );
  // Keep the channel open for the async answer.
  return true;
});

// ── Right-click menu ─────────────────────────────────────────────────────
// "Add to Regibee" on any web page opens the popup, the same as the toolbar
// button. Chrome gives the extension the same one-time access to the page
// for a menu click as for a button click, so the popup can read it.

const MENU_ID = "add-to-regibee";
const MENU_CLICK_MAX_AGE_MS = 15_000;
let lastMenuClick: (MenuClick & { at: number }) | null = null;

function createMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Add to Regibee",
      // Not links: the item would be the page the link goes to, which the
      // extension can't read without opening it.
      contexts: ["page", "image", "selection"],
      documentUrlPatterns: ["https://*/*", "http://*/*"],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id === undefined) return;
  const imageUrl = info.mediaType === "image" && info.srcUrl?.startsWith("https:") ? info.srcUrl : null;
  lastMenuClick = { tabId: tab.id, imageUrl, at: Date.now() };
  // Chrome before 127, and some other Chromium browsers, can't open the
  // popup from here. Open it in a small window about the same tab instead.
  const openWindow = () =>
    void chrome.windows.create({
      url: chrome.runtime.getURL(`popup.html?tab=${tab.id}`),
      type: "popup",
      width: 400,
      height: 640,
    });
  // Open the popup straight away, before anything else awaits. Before Chrome
  // 118 openPopup doesn't exist at all.
  if (typeof chrome.action.openPopup !== "function") openWindow();
  else chrome.action.openPopup({ windowId: tab.windowId }).catch(openWindow);
});

chrome.runtime.onInstalled.addListener((details) => {
  createMenu();
  // First install: open the Connect page so the owner can sign in right away.
  if (details.reason === "install") {
    void chrome.tabs.create({ url: `${REGIBEE_URL}${CONNECT_PATH}` });
  }
});

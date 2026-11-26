// The toolbar popup. On a store registry page it lists the items that aren't
// on Regibee yet; on an Elfster wishlist it does the same for its wishes; on
// a product page it offers to add that item; anywhere else it shows the
// stores and settings.

import {
  importItemKey,
  USED_CONDITIONS,
  type AddProductResponse,
  type AddResponse,
  type CategoryResponse,
  type ExtensionRegistry,
  type IdeaRequest,
  type IdeaResponse,
  type ImportCheckResponse,
  type ImportItem,
  type ImportResponse,
  type LinkResponse,
  type ProductItem,
  type StoreItem,
} from "@/lib/extension";
import { categoryName, MAX_CATEGORY_NAME_LENGTH } from "@/lib/item-categories";
import { classifyStoreLink, EXTENSION_STORES, getStore, storeItemKey, type StoreId, type StoreInfo } from "@/lib/retailers";
import { ELFSTER_WISHLISTS_URL, isElfsterWishlistUrl } from "@/lib/wishlist-import";
import { REGIBEE_URL, VERSION_NAME } from "../config";
import { readElfsterWishlist, type WishlistPage } from "../elfster-reader";
import { readProductPage, type ProductPage } from "../product-reader";
import {
  ask,
  type CheckResult,
  type ContentRequest,
  type MenuClick,
  type Mode,
  type PopupState,
  type ProductMode,
  type ReadResult,
  type RegistriesResult,
  type Result,
} from "../messages";

// ── Tiny DOM helpers ─────────────────────────────────────────────────────

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === "function") el.addEventListener(name.replace(/^on/, "").toLowerCase(), value);
    else if (name === "className") el.className = String(value);
    else if (value === true) el.setAttribute(name, "");
    else el.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return el;
}

function icon(paths: string, size = 16): SVGElement {
  const wrapper = document.createElement("span");
  wrapper.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  return wrapper.firstElementChild as SVGElement;
}

const CHECK = '<path d="M20 6 9 17l-5-5"/>';
const CHEVRON = '<path d="m6 9 6 6 6-6"/>';
const EXTERNAL = '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>';
const CIRCLE_CHECK = '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>';

const app = document.getElementById("app")!;

function render(...children: Child[]) {
  app.replaceChildren(...children.filter((c): c is Node | string => Boolean(c)));
}

// ── Formatting ───────────────────────────────────────────────────────────

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function ago(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  return `${Math.round(days / 7)} weeks ago`;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function initialOf(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function openTab(url: string) {
  void chrome.tabs.create({ url });
  window.close();
}

// ── Shared pieces ────────────────────────────────────────────────────────

function header(user: { name: string } | null) {
  return h(
    "header",
    { className: "header" },
    h(
      "span",
      { className: "brand" },
      h("img", { src: "logo.svg", alt: "" }),
      h("span", { className: "wordmark" }, "Regibee")
    ),
    user && h("span", { className: "avatar", role: "img", "aria-label": `Signed in as ${user.name}` }, initialOf(user.name))
  );
}

function storeRow(store: StoreInfo, detail: string) {
  return h(
    "div",
    { className: "store-row" },
    h("span", { className: "initial", "aria-hidden": "true" }, initialOf(store.name)),
    h(
      "div",
      { className: "stack" },
      h("h1", { className: "name" }, `Your ${store.name} registry`),
      h("span", { className: "muted" }, detail)
    )
  );
}

function registrySelect(registries: ExtensionRegistry[], selected: string, label: string, onChange: (id: string) => void) {
  const select = h(
    "select",
    { id: "registry", onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
    ...registries.map((r) => h("option", { value: r.id, selected: r.id === selected }, r.title))
  );
  return h("div", { className: "field" }, h("label", { for: "registry" }, label), select);
}

function showError(user: { name: string } | null, message: string, retry: () => void) {
  render(
    header(user),
    h(
      "main",
      { className: "body" },
      h("p", { className: "error", role: "alert" }, message),
      h("div", { className: "footer-actions" }, h("button", { type: "button", className: "button secondary", onclick: retry }, "Try again"))
    )
  );
}

// ── Views ────────────────────────────────────────────────────────────────

function showConnect(signedOut = false) {
  render(
    header(null),
    h(
      "main",
      { className: "body" },
      h("h1", { className: "title" }, "Connect Regibee"),
      h(
        "p",
        { className: "lead" },
        "Sign in once on regibee.com. Then the extension can bring the items on your store registries into Regibee, with their registry links."
      ),
      signedOut && h("p", { className: "note" }, "The extension was signed out. Connect it again to keep going."),
      h(
        "div",
        { className: "footer-actions" },
        h(
          "button",
          {
            type: "button",
            className: "button primary",
            onclick: async () => {
              await ask({ type: "open-connect" });
              window.close();
            },
          },
          "Connect"
        )
      )
    )
  );
}

function showNoRegistries(user: { name: string }) {
  render(
    header(user),
    h(
      "main",
      { className: "body" },
      h("p", { className: "lead" }, "You don't manage any registries on Regibee yet. Make one, then come back to add your store items."),
      h(
        "div",
        { className: "footer-actions" },
        h("button", { type: "button", className: "button primary", onclick: () => openTab(`${REGIBEE_URL}/dashboard/registry/new`) }, "Make a registry")
      )
    )
  );
}

function showCouldntRead(user: { name: string }, store: StoreInfo, retry: () => void) {
  render(
    header(user),
    h(
      "main",
      { className: "body" },
      storeRow(store, "No items found on this page"),
      h("p", { className: "lead" }, "We couldn't find any registry items on this page."),
      h(
        "p",
        { className: "muted" },
        store.openRegistryStep ??
          "Make sure the page lists your registry's items. If the store changed its page, you can still paste each item's registry link on Regibee."
      ),
      h("div", { className: "footer-actions" }, h("button", { type: "button", className: "button secondary", onclick: retry }, "Try again"))
    )
  );
}

interface ImportContext {
  user: { name: string };
  store: StoreInfo;
  items: StoreItem[];
  registries: ExtensionRegistry[];
  registryId: string;
  mode: Mode;
  reload: () => void;
}

async function showImport(ctx: ImportContext) {
  const { user, store, items, registries } = ctx;
  let registryId = ctx.registryId;
  const registryTitle = () => registries.find((r) => r.id === registryId)?.title ?? "your registry";

  render(header(user), h("main", { className: "body" }, storeRow(store, `${plural(items.length, "item")} found`), h("p", { className: "muted" }, "Checking Regibee…")));

  const checked = await ask<CheckResult>({ type: "check", registryId, store: store.id, items });
  if (!checked.ok) return handleFailure(checked, user, ctx.reload);
  const existing = new Set(checked.data.existing);
  const linkedNote = linkedItemsNote(store, checked.data.linked.length);
  const fresh = items.filter((i) => !existing.has(storeItemKey(i.url)!));
  const already = items.filter((i) => existing.has(storeItemKey(i.url)!));
  const listed = items.map((i) => storeItemKey(i.url)!).filter(Boolean);
  const picked = new Set(fresh.map((i) => storeItemKey(i.url)!));
  let auto = ctx.mode === "auto";

  const onRegistryChange = async (id: string) => {
    registryId = id;
    await ask({ type: "set-registry", registryId: id });
    await showImport({ ...ctx, registryId: id, mode: auto ? "auto" : "ask" });
  };

  const summary = `${plural(items.length, "item")} found · ${
    fresh.length === 0 ? "all on Regibee" : `${fresh.length} not on Regibee yet`
  }`;

  const button = h("button", { type: "button", className: "button primary" }) as HTMLButtonElement;
  const updateButton = () => {
    button.disabled = picked.size === 0;
    button.textContent = picked.size === 0 ? "Pick items to add" : `Add ${plural(picked.size, "item")} to Regibee`;
  };
  updateButton();

  const itemRows = fresh.map((item) => {
    const key = storeItemKey(item.url)!;
    const box = h("input", {
      type: "checkbox",
      checked: true,
      onchange: (e: Event) => {
        if ((e.target as HTMLInputElement).checked) picked.add(key);
        else picked.delete(key);
        updateButton();
      },
    });
    return h(
      "li",
      {},
      h(
        "label",
        { className: "item" },
        box,
        item.imageUrl
          ? h("img", { className: "thumb", src: item.imageUrl, alt: "", loading: "lazy", referrerpolicy: "no-referrer" })
          : h("span", { className: "thumb", "aria-hidden": "true" }),
        h(
          "span",
          { className: "stack" },
          h("span", { className: "item-title", title: item.title }, item.title),
          h(
            "span",
            { className: "meta" },
            item.price !== null && h("span", { className: "price" }, money.format(item.price)),
            h("span", { className: "ok" }, icon(CHECK, 12), "Registry link")
          )
        )
      )
    );
  });

  let alreadyRow: HTMLElement | null = null;
  if (already.length > 0) {
    const list = h("ul", { className: "existing", id: "already", hidden: true }, ...already.map((i) => h("li", { title: i.title }, i.title)));
    const toggle = h(
      "button",
      {
        type: "button",
        className: "toggle",
        "aria-expanded": "false",
        "aria-controls": "already",
        onclick: () => {
          const open = toggle.getAttribute("aria-expanded") === "true";
          toggle.setAttribute("aria-expanded", String(!open));
          list.hidden = open;
        },
      },
      `${already.length} already on Regibee`,
      icon(CHEVRON)
    );
    alreadyRow = h("div", { className: "already" }, toggle, list);
  }

  const autoBox = h("input", {
    type: "checkbox",
    checked: auto,
    onchange: (e: Event) => {
      auto = (e.target as HTMLInputElement).checked;
    },
  });

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Adding…";
    const chosen = fresh.filter((i) => picked.has(storeItemKey(i.url)!));
    await ask({ type: "set-mode", mode: auto ? "auto" : "ask" });
    const added = await ask<AddResponse>({ type: "add", registryId, items: chosen, listed });
    if (!added.ok) return handleFailure(added, user, ctx.reload);
    showAdded(user, store, registryId, registryTitle(), added.data);
  });

  // Nothing new: say so, and still offer automatic mode for next time.
  if (fresh.length === 0) {
    render(
      header(user),
      h(
        "main",
        { className: "body" },
        storeRow(store, summary),
        registries.length > 1 && registrySelect(registries, registryId, "Add to", onRegistryChange),
        h("p", { className: "lead" }, `Everything on your ${store.name} registry is already on ${registryTitle()}.`),
        linkedNote,
        h(
          "div",
          { className: "footer-actions" },
          h(
            "button",
            { type: "button", className: "button secondary", onclick: () => openTab(`${REGIBEE_URL}/dashboard/registry/${registryId}`) },
            "Review on Regibee"
          )
        )
      )
    );
    return;
  }

  render(
    header(user),
    h(
      "main",
      { className: "body" },
      storeRow(store, summary),
      linkedNote,
      !store.registryPage?.verified &&
        h("p", { className: "note" }, `Reading ${store.name} registries is new. Check the items look right before you add them.`),
      registrySelect(registries, registryId, "Add to", onRegistryChange),
      h("div", { className: "picker" }, h("ul", { className: "items" }, ...itemRows), alreadyRow),
      h("label", { className: "check" }, autoBox, "Add new items automatically next time"),
      h(
        "div",
        { className: "footer-actions" },
        button,
        h("p", { className: "footnote" }, `We save each item's registry link, so gifts still count toward your ${store.name} registry.`)
      )
    )
  );
}

/** Says how many items already on Regibee just got their registry link in place of a plain one. */
function linkedItemsNote(store: StoreInfo, count: number) {
  if (count === 0) return null;
  return h(
    "p",
    { className: "ok-note", role: "status" },
    icon(CHECK, 14),
    h(
      "span",
      {},
      count === 1
        ? `1 item already on Regibee now has its ${store.name} registry link.`
        : `${count} items already on Regibee now have their ${store.name} registry links.`
    )
  );
}

function showAdded(user: { name: string }, store: StoreInfo, registryId: string, registryTitle: string, result: AddResponse) {
  const count = result.added.length;
  render(
    header(user),
    h(
      "main",
      { className: "body" },
      h(
        "div",
        { className: "done", role: "status" },
        icon(CIRCLE_CHECK, 36),
        h("h1", {}, count === 0 ? "Nothing new to add" : `Added ${plural(count, "item")} to Regibee`),
        h(
          "p",
          { className: "lead" },
          count === 0
            ? `Those items are already on ${registryTitle}.`
            : count === 1
              ? `It's on ${registryTitle}, with its ${store.name} registry link.`
              : `They're on ${registryTitle}, with their ${store.name} registry links.`
        ),
        result.skipped > 0 && count > 0 && h("p", { className: "muted" }, `${plural(result.skipped, "item was", "items were")} already there.`)
      ),
      h(
        "div",
        { className: "footer-actions" },
        h(
          "button",
          { type: "button", className: "button primary", onclick: () => openTab(`${REGIBEE_URL}/dashboard/registry/${registryId}`) },
          "Review on Regibee"
        )
      )
    )
  );
}

// ── An Elfster wishlist ──────────────────────────────────────────────────

function wishlistRow(title: string | null, detail: string) {
  return h(
    "div",
    { className: "store-row" },
    h("span", { className: "initial", "aria-hidden": "true" }, "E"),
    h(
      "div",
      { className: "stack" },
      h("h1", { className: "name" }, title ? `${title} on Elfster` : "Elfster wishlist"),
      h("span", { className: "muted" }, detail)
    )
  );
}

function showCouldntReadWishlist(user: { name: string }, wishlist: WishlistPage, retry: () => void) {
  render(
    header(user),
    h(
      "main",
      { className: "body" },
      wishlistRow(wishlist.title, wishlist.failed ? "Couldn't read this wishlist" : "No items found"),
      h(
        "p",
        { className: "lead" },
        wishlist.failed
          ? "We couldn't read this wishlist. Reload the page, then try again."
          : wishlist.received > 0
            ? "Everything on this wishlist is marked as received on Elfster, so there's nothing to add."
            : "This wishlist has no items yet."
      ),
      h("div", { className: "footer-actions" }, h("button", { type: "button", className: "button secondary", onclick: retry }, "Try again"))
    )
  );
}

/** The shop an item's link goes to, such as "etsy.com". */
function shopOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

interface WishlistContext {
  user: { name: string };
  wishlist: WishlistPage;
  registries: ExtensionRegistry[];
  registryId: string;
  reload: () => void;
}

/**
 * The wishes on the Elfster wishlist the owner has open, with the ones that
 * aren't on Regibee yet ticked. Always asks first: there's no automatic mode
 * here, since the owner may be looking at someone else's wishlist.
 */
async function showWishlist(ctx: WishlistContext) {
  const { user, wishlist, registries } = ctx;
  let registryId = ctx.registryId;
  const registryTitle = () => registries.find((r) => r.id === registryId)?.title ?? "your registry";

  // One row for each item: Elfster lets the same wish be added twice.
  const byKey = new Map<string, ImportItem>();
  for (const item of wishlist.items) {
    const key = importItemKey(item);
    if (key && !byKey.has(key)) byKey.set(key, item);
  }
  const items = [...byKey].map(([key, item]) => ({ key, item }));
  const found = `${plural(items.length, "item")} found`;

  render(header(user), h("main", { className: "body" }, wishlistRow(wishlist.title, found), h("p", { className: "muted" }, "Checking Regibee…")));

  const checked = await ask<ImportCheckResponse>({ type: "import-check", registryId, items: items.map((i) => i.item) });
  if (!checked.ok) return handleFailure(checked, user, ctx.reload);
  const existing = new Set(checked.data.existing);
  const fresh = items.filter((i) => !existing.has(i.key));
  const already = items.filter((i) => existing.has(i.key));
  const picked = new Set(fresh.map((i) => i.key));
  const summary = `${found} · ${fresh.length === 0 ? "all on Regibee" : `${fresh.length} not on Regibee yet`}`;

  const onRegistryChange = async (id: string) => {
    registryId = id;
    await ask({ type: "set-registry", registryId: id });
    await showWishlist({ ...ctx, registryId: id });
  };
  const receivedNote =
    wishlist.received > 0 &&
    h(
      "p",
      { className: "muted" },
      wishlist.received === 1
        ? "1 item you marked as received on Elfster is left out."
        : `${wishlist.received} items you marked as received on Elfster are left out.`
    );

  if (fresh.length === 0) {
    render(
      header(user),
      h(
        "main",
        { className: "body" },
        wishlistRow(wishlist.title, summary),
        registries.length > 1 && registrySelect(registries, registryId, "Add to", onRegistryChange),
        h("p", { className: "lead" }, `Everything on this wishlist is already on ${registryTitle()}.`),
        receivedNote,
        h(
          "div",
          { className: "footer-actions" },
          h(
            "button",
            { type: "button", className: "button secondary", onclick: () => openTab(`${REGIBEE_URL}/dashboard/registry/${registryId}`) },
            "Review on Regibee"
          )
        )
      )
    );
    return;
  }

  const button = h("button", { type: "button", className: "button primary" }) as HTMLButtonElement;
  const updateButton = () => {
    button.disabled = picked.size === 0;
    button.textContent = picked.size === 0 ? "Pick items to add" : `Add ${plural(picked.size, "item")} to Regibee`;
  };
  updateButton();

  const itemRows = fresh.map(({ key, item }) => {
    const box = h("input", {
      type: "checkbox",
      checked: true,
      onchange: (e: Event) => {
        if ((e.target as HTMLInputElement).checked) picked.add(key);
        else picked.delete(key);
        updateButton();
      },
    });
    return h(
      "li",
      {},
      h(
        "label",
        { className: "item" },
        box,
        item.imageUrl
          ? h("img", { className: "thumb", src: item.imageUrl, alt: "", loading: "lazy", referrerpolicy: "no-referrer" })
          : h("span", { className: "thumb", "aria-hidden": "true" }),
        h(
          "span",
          { className: "stack" },
          h("span", { className: "item-title", title: item.title }, item.title),
          h(
            "span",
            { className: "meta" },
            item.price !== null && h("span", { className: "price" }, money.format(item.price)),
            h("span", { className: "muted" }, item.url ? shopOf(item.url) : "No link")
          )
        )
      )
    );
  });

  let alreadyRow: HTMLElement | null = null;
  if (already.length > 0) {
    const list = h(
      "ul",
      { className: "existing", id: "already", hidden: true },
      ...already.map((i) => h("li", { title: i.item.title }, i.item.title))
    );
    const toggle = h(
      "button",
      {
        type: "button",
        className: "toggle",
        "aria-expanded": "false",
        "aria-controls": "already",
        onclick: () => {
          const open = toggle.getAttribute("aria-expanded") === "true";
          toggle.setAttribute("aria-expanded", String(!open));
          list.hidden = open;
        },
      },
      `${already.length} already on Regibee`,
      icon(CHEVRON)
    );
    alreadyRow = h("div", { className: "already" }, toggle, list);
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Adding…";
    const chosen = fresh.filter((i) => picked.has(i.key)).map((i) => i.item);
    const added = await ask<ImportResponse>({ type: "import", registryId, items: chosen });
    if (!added.ok) return handleFailure(added, user, ctx.reload);
    showImported(user, registryId, registryTitle(), added.data);
  });

  render(
    header(user),
    h(
      "main",
      { className: "body" },
      wishlistRow(wishlist.title, summary),
      registrySelect(registries, registryId, "Add to", onRegistryChange),
      h("div", { className: "picker" }, h("ul", { className: "items" }, ...itemRows), alreadyRow),
      receivedNote,
      h(
        "div",
        { className: "footer-actions" },
        button,
        h("p", { className: "footnote" }, "Each item comes with its name, price, picture, note and the link to its shop.")
      )
    )
  );
}

function showImported(user: { name: string }, registryId: string, registryTitle: string, result: ImportResponse) {
  const count = result.added.length;
  render(
    header(user),
    h(
      "main",
      { className: "body" },
      h(
        "div",
        { className: "done", role: "status" },
        icon(CIRCLE_CHECK, 36),
        h("h1", {}, count === 0 ? "Nothing new to add" : `Added ${plural(count, "item")} to Regibee`),
        h(
          "p",
          { className: "lead" },
          count === 0
            ? `Those items are already on ${registryTitle}.`
            : count === 1
              ? `It's on ${registryTitle}.`
              : `They're on ${registryTitle}.`
        ),
        result.skipped > 0 && count > 0 && h("p", { className: "muted" }, `${plural(result.skipped, "item was", "items were")} already there.`)
      ),
      h(
        "div",
        { className: "footer-actions" },
        h(
          "button",
          { type: "button", className: "button primary", onclick: () => openTab(`${REGIBEE_URL}/dashboard/registry/${registryId}`) },
          "Review on Regibee"
        )
      )
    )
  );
}

function showHome(state: PopupState, user: { name: string }, data: RegistriesResult, page: ProductPage | null = null) {
  const registryId = data.registryId!;
  const registry = data.registries.find((r) => r.id === registryId);
  const storeItems = EXTENSION_STORES.map((store) => {
    const last = state.lastChecked[store.id as StoreId];
    const status = last ? `Checked ${ago(last.at)} · ${plural(last.count, "item")}` : "Not checked yet";
    // Items added from a product page with a plain link. Opening the store's
    // registry swaps in their registry links.
    const plainCount = registry?.plainLinks?.[store.id] ?? 0;
    return h(
      "li",
      {},
      h("span", { className: "initial", "aria-hidden": "true" }, initialOf(store.name)),
      h(
        "span",
        { className: "stack" },
        h("span", { className: "name", style: "font-weight: 600" }, store.name),
        h("span", { className: "muted" }, status),
        plainCount > 0 &&
          h(
            "span",
            { className: "warn" },
            plainCount === 1 ? "1 item has a plain link. Open to fix it." : `${plainCount} items have plain links. Open to fix them.`
          )
      ),
      h(
        "a",
        {
          className: "open",
          href: store.registryPage!.openUrl,
          "aria-label": `Open your ${store.name} registry`,
          onclick: (e: Event) => {
            e.preventDefault();
            openTab(store.registryPage!.openUrl);
          },
        },
        "Open",
        icon(EXTERNAL, 14)
      )
    );
  });

  // Elfster isn't a store: there's nothing to check on its own, so the row
  // only says how to bring a wishlist over.
  const elfsterItem = h(
    "li",
    {},
    h("span", { className: "initial", "aria-hidden": "true" }, "E"),
    h(
      "span",
      { className: "stack" },
      h("span", { className: "name", style: "font-weight: 600" }, "Elfster"),
      h("span", { className: "muted" }, "Open a wishlist, then click the Regibee button")
    ),
    h(
      "a",
      {
        className: "open",
        href: ELFSTER_WISHLISTS_URL,
        "aria-label": "Open your Elfster wishlists",
        onclick: (e: Event) => {
          e.preventDefault();
          openTab(ELFSTER_WISHLISTS_URL);
        },
      },
      "Open",
      icon(EXTERNAL, 14)
    )
  );

  const modeRadio = (mode: Mode, label: string) =>
    h(
      "label",
      { className: "check" },
      h("input", {
        type: "radio",
        name: "mode",
        value: mode,
        checked: state.mode === mode,
        onchange: () => void ask({ type: "set-mode", mode }),
      }),
      label
    );

  render(
    header(user),
    h(
      "main",
      { className: "body" },
      h("h1", { className: "sr-only" }, "Your store registries"),
      // Nothing on the page says it's a product, but the owner may still want it.
      page &&
        h(
          "button",
          {
            type: "button",
            className: "button secondary",
            onclick: () =>
              showProduct({
                user,
                product: page,
                registries: data.registries,
                registryId,
                mode: state.productMode ?? "list",
                ideaRecipients: data.ideaRecipients ?? [],
                storesWithRegistries: storesWithRegistries(state, registry),
              }),
          },
          "Add this page to Regibee"
        ),
      h(
        "p",
        { className: "lead" },
        "Open one of your store registries and we'll find items to add to Regibee. On a product page, click the Regibee button, or right-click and choose Add to Regibee."
      ),
      h("ul", { className: "stores" }, ...storeItems, elfsterItem),
      data.registries.length > 1 &&
        registrySelect(data.registries, registryId, "New items go to", async (id) => {
          await ask({ type: "set-registry", registryId: id });
          showHome(state, user, { ...data, registryId: id }, page);
        }),
      h("fieldset", {}, h("legend", {}, "When new items show up"), modeRadio("ask", "Ask me first"), modeRadio("auto", "Add them automatically")),
      h(
        "div",
        { className: "bottom-bar" },
        h(
          "a",
          {
            href: `${REGIBEE_URL}/dashboard/registry/${registryId}/settings#store-registries`,
            onclick: (e: Event) => {
              e.preventDefault();
              openTab(`${REGIBEE_URL}/dashboard/registry/${registryId}/settings#store-registries`);
            },
          },
          "Manage store registries"
        ),
        // So testers can say which build they're on, such as "0.2.0.57 (#212)".
        h("span", { className: "muted", title: "This version of the extension" }, VERSION_NAME),
        h(
          "button",
          {
            type: "button",
            className: "link-button",
            onclick: async () => {
              await ask({ type: "disconnect" });
              showConnect();
            },
          },
          "Disconnect"
        )
      )
    )
  );
}

interface ProductContext {
  user: { name: string };
  product: ProductPage;
  registries: ExtensionRegistry[];
  /** Null when the owner has no registry. The form then only saves gift ideas. */
  registryId: string | null;
  /** Whether the form opens on adding to a registry or on a gift idea. */
  mode: ProductMode;
  /** The people the owner saved gift ideas for, most recent first. */
  ideaRecipients: string[];
  /** Stores the owner has a registry at: linked in Settings or read by the extension. */
  storesWithRegistries: Set<StoreId>;
  /** The picture the owner right-clicked to open the form, shown first. */
  preferredImage?: string | null;
}

const PREV = '<path d="m15 18-6-6 6-6"/>';
const NEXT = '<path d="m9 18 6-6-6-6"/>';
const MINUS = '<path d="M5 12h14"/>';
const PLUS = '<path d="M5 12h14"/><path d="M12 5v14"/>';
const LOCK = '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
const IDEAS_URL = `${REGIBEE_URL}/dashboard/saved/ideas`;
/** The "Add to" picker's value for gift ideas. Registry ids are uuids, so it can't clash. */
const IDEAS_CHOICE = "ideas";

/**
 * The "Add to Regibee" form for the product on the page, like the site's
 * add-item dialog. The "Add to" picker at the top lists the owner's
 * registries and, last, their gift ideas for other people, which only the
 * owner can see. Picking Gift ideas swaps in who it's for and a private note.
 */
function showProduct(ctx: ProductContext) {
  const { user, product, registries } = ctx;
  // Someone with no registry can still save the product as a gift idea.
  const canAddToList = ctx.registryId !== null && registries.length > 0;
  let mode: ProductMode = canAddToList ? ctx.mode : "idea";
  let registryId = ctx.registryId ?? "";
  let imageIndex = 0;
  let quantity = 1;
  const registry = () => registries.find((r) => r.id === registryId)!;
  const link = classifyStoreLink(product.url);
  // A store registry this owner has, where the extension can read the
  // registry page and swap in the registry link later.
  const plainStore =
    link?.kind === "plain" && ctx.storesWithRegistries.has(link.store.id) ? link.store : null;
  const images = [...product.images];
  if (ctx.preferredImage) {
    const at = images.indexOf(ctx.preferredImage);
    if (at !== 0) {
      if (at > 0) images.splice(at, 1);
      images.unshift(ctx.preferredImage);
    }
  }

  // ── Picture ──
  const picture = h("img", { className: "product-image", alt: "", referrerpolicy: "no-referrer" }) as HTMLImageElement;
  const counter = h("span", { className: "muted", "aria-live": "polite" });
  const showImage = () => {
    if (images.length === 0) {
      picture.removeAttribute("src");
      return;
    }
    picture.src = images[imageIndex];
    counter.textContent = `${imageIndex + 1} of ${images.length}`;
  };
  const step = (by: number) => () => {
    imageIndex = (imageIndex + by + images.length) % images.length;
    showImage();
  };
  const gallery = h(
    "div",
    { className: "gallery" },
    images.length > 0 ? picture : h("span", { className: "product-image", "aria-hidden": "true" }),
    images.length > 1 &&
      h(
        "div",
        { className: "gallery-controls" },
        h("button", { type: "button", className: "icon-button", "aria-label": "Previous picture", onclick: step(-1) }, icon(PREV)),
        counter,
        h("button", { type: "button", className: "icon-button", "aria-label": "Next picture", onclick: step(1) }, icon(NEXT))
      )
  );
  showImage();

  // ── Fields ──
  const title = h("textarea", { id: "title", rows: 3, maxlength: 300, required: true }) as HTMLTextAreaElement;
  title.value = product.title;
  const price = h("input", { id: "price", type: "text", inputmode: "decimal", placeholder: "0.00", autocomplete: "off" }) as HTMLInputElement;
  if (product.price !== null) price.value = product.price.toFixed(2);
  const qty = h("input", { id: "quantity", type: "number", min: 1, max: 99, value: 1, className: "stepper-value" }) as HTMLInputElement;
  const setQuantity = (value: number) => {
    quantity = Math.min(Math.max(Math.round(value) || 1, 1), 99);
    qty.value = String(quantity);
  };
  qty.addEventListener("change", () => setQuantity(Number(qty.value)));

  const category = h("select", { id: "category" }) as HTMLSelectElement;
  const fillCategories = () => {
    category.replaceChildren(
      h("option", { value: "" }, "No category"),
      ...(registry()?.categories ?? []).map((c) => h("option", { value: c.id }, c.name))
    );
  };
  fillCategories();

  // "+ New category", as on the site's add-item dialog: it makes the
  // category on the registry and picks it.
  const newCategory = h("input", {
    id: "new-category",
    type: "text",
    maxlength: MAX_CATEGORY_NAME_LENGTH,
    autocomplete: "off",
    placeholder: "e.g., Kitchen",
  }) as HTMLInputElement;
  const addCategoryButton = h("button", { type: "button", className: "button primary small", disabled: true }, "Add") as HTMLButtonElement;
  const categoryError = h("p", { className: "error", role: "alert", hidden: true });
  const categoryPicker = h(
    "div",
    { className: "field" },
    h("label", { for: "category" }, "Category"),
    category,
    h("button", { type: "button", className: "link-button new-category", onclick: () => openNewCategory() }, "+ New category")
  );
  const newCategoryForm = h(
    "div",
    { className: "field", hidden: true },
    h("label", { for: "new-category" }, "New category"),
    h(
      "div",
      { className: "inline-form" },
      newCategory,
      addCategoryButton,
      h("button", { type: "button", className: "button secondary small", onclick: () => closeNewCategory() }, "Cancel")
    ),
    categoryError
  );
  let addingCategory = false;
  const openNewCategory = () => {
    categoryPicker.hidden = true;
    newCategoryForm.hidden = false;
    newCategory.focus();
  };
  const closeNewCategory = () => {
    newCategoryForm.hidden = true;
    categoryPicker.hidden = false;
    newCategory.value = "";
    addCategoryButton.disabled = true;
    categoryError.hidden = true;
  };
  newCategory.addEventListener("input", () => {
    addCategoryButton.disabled = addingCategory || !categoryName(newCategory.value);
  });
  newCategory.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void addCategory();
  });
  addCategoryButton.addEventListener("click", () => void addCategory());

  /** Makes the typed category on the registry and picks it. False when it wasn't made. */
  async function addCategory(): Promise<boolean> {
    const name = categoryName(newCategory.value);
    if (!name || addingCategory) return false;
    addingCategory = true;
    categoryError.hidden = true;
    addCategoryButton.disabled = true;
    addCategoryButton.textContent = "Adding…";
    const result = await ask<CategoryResponse>({ type: "add-category", registryId, name });
    addingCategory = false;
    addCategoryButton.textContent = "Add";
    if (!result.ok) {
      if (result.notConnected) {
        showConnect(true);
        return false;
      }
      categoryError.textContent = result.error;
      categoryError.hidden = false;
      addCategoryButton.disabled = false;
      newCategory.focus();
      return false;
    }
    // A category with that name already on the registry comes back instead of a new one.
    const added = result.data.category;
    const list = registry();
    if (!list.categories.some((c) => c.id === added.id)) list.categories = [...list.categories, added];
    fillCategories();
    category.value = added.id;
    closeNewCategory();
    return true;
  }

  const essential = h("input", { type: "checkbox", id: "essential" }) as HTMLInputElement;
  const openToUsed = h("input", { type: "checkbox", id: "used" }) as HTMLInputElement;
  const condition = h(
    "select",
    { id: "condition" },
    ...USED_CONDITIONS.map((c) => h("option", { value: c.id }, c.label))
  ) as HTMLSelectElement;
  const conditionField = h("div", { className: "field", hidden: true }, h("label", { for: "condition" }, "Minimum condition"), condition);
  openToUsed.addEventListener("change", () => {
    conditionField.hidden = !openToUsed.checked;
  });
  const notes = h("textarea", {
    id: "notes",
    rows: 2,
    maxlength: 1000,
    placeholder: "For example, which size or color you'd like.",
  }) as HTMLTextAreaElement;

  // ── Gift idea: who it's for (optional), and a note only the owner sees ──
  const recipient = h("input", {
    id: "recipient",
    type: "text",
    maxlength: 80,
    autocomplete: "off",
    placeholder: "Mom, Sam, my brother…",
  }) as HTMLInputElement;
  const chips = ctx.ideaRecipients.slice(0, 6).map((name) =>
    h(
      "button",
      {
        type: "button",
        className: "chip",
        "aria-pressed": "false",
        onclick: () => {
          // Clicking the chosen name again takes it off.
          const chosen = recipient.value.replace(/\s+/g, " ").trim().toLowerCase() === name.toLowerCase();
          recipient.value = chosen ? "" : name;
          syncChips();
        },
      },
      name
    )
  );
  const syncChips = () => {
    const typed = recipient.value.replace(/\s+/g, " ").trim().toLowerCase();
    for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.textContent?.toLowerCase() === typed));
  };
  recipient.addEventListener("input", syncChips);
  const ideaNotes = h("textarea", {
    id: "idea-notes",
    rows: 2,
    maxlength: 1000,
    placeholder: "Their size, the color they liked, when to get it…",
  }) as HTMLTextAreaElement;

  // ── Notices: the registry link, and whether it's already on Regibee ──
  let linkNote: HTMLElement | null = null;
  if (link?.kind === "registry") {
    linkNote = h(
      "p",
      { className: "ok-note" },
      icon(CHECK, 14),
      h("span", {}, `${link.store.name} registry link. Gifts bought through it count toward your ${link.store.name} registry.`)
    );
  } else if (plainStore) {
    const name = plainStore.name;
    linkNote = h(
      "p",
      { className: "note" },
      plainStore.registryPage
        ? `This is a plain ${name} link, so gifts bought through it won't count toward your ${name} registry yet. Add it here, then add it to your ${name} registry on this page. The next time you open your ${name} registry, we'll swap in its registry link.`
        : `This is a plain ${name} link, so gifts bought through it won't count toward your ${name} registry. Add it to your ${name} registry first, then open it from there and add it to Regibee.`
    );
  }
  const duplicateNote = h("p", { className: "note", hidden: true });
  const error = h("p", { className: "error", role: "alert", hidden: true });
  const button = h("button", { type: "button", className: "button primary" }, "Add to Regibee") as HTMLButtonElement;
  const ideaButton = h("button", { type: "button", className: "button primary" }, "Save gift idea") as HTMLButtonElement;

  // Already on Regibee with a plain link, and this page has the registry
  // link: the button swaps it in instead of adding the item again.
  let swapLink = false;

  const checkDuplicate = async () => {
    duplicateNote.hidden = true;
    swapLink = false;
    button.disabled = false;
    button.textContent = "Add to Regibee";
    const result = await ask<{ exists: boolean; plain?: boolean }>({ type: "check-url", registryId, url: product.url });
    if (result.ok && result.data.exists && result.data.plain && link?.kind === "registry") {
      duplicateNote.textContent = `This item is already on ${registry().title} with a plain ${link.store.name} link. Use this registry link instead, so gifts bought through it count toward your ${link.store.name} registry.`;
      duplicateNote.hidden = false;
      swapLink = true;
      button.textContent = "Use this registry link";
      return;
    }
    if (result.ok && result.data.exists) {
      duplicateNote.replaceChildren(
        `This item is already on ${registry().title}. `,
        h(
          "a",
          {
            href: `${REGIBEE_URL}/dashboard/registry/${registryId}`,
            onclick: (e: Event) => {
              e.preventDefault();
              openTab(`${REGIBEE_URL}/dashboard/registry/${registryId}`);
            },
          },
          "View it on Regibee"
        )
      );
      duplicateNote.hidden = false;
      button.disabled = true;
      button.textContent = "Already on this registry";
    }
  };

  // Where it goes: one of the owner's registries, or their gift ideas, which
  // the picker offers like one more list.
  const listSelect = h(
    "select",
    {
      id: "list",
      onchange: (e: Event) => void chooseList((e.target as HTMLSelectElement).value),
    },
    canAddToList &&
      h(
        "optgroup",
        { label: "For you" },
        ...registries.map((r) => h("option", { value: r.id, selected: mode === "list" && r.id === registryId }, r.title))
      ),
    h("optgroup", { label: "For someone else" }, h("option", { value: IDEAS_CHOICE, selected: mode === "idea" }, "Gift ideas"))
  ) as HTMLSelectElement;

  async function chooseList(value: string) {
    if (value === IDEAS_CHOICE) {
      setMode("idea");
      return;
    }
    registryId = value;
    fillCategories();
    closeNewCategory();
    setMode("list");
    await ask({ type: "set-registry", registryId: value });
    await checkDuplicate();
  }

  button.addEventListener("click", async () => {
    error.hidden = true;
    if (swapLink && link) {
      button.disabled = true;
      button.textContent = "Saving…";
      const item: StoreItem = { url: product.url, title: title.value.trim() || product.title, price: null, imageUrl: null, quantity: 1 };
      const result = await ask<LinkResponse>({ type: "link", registryId, items: [item] });
      if (!result.ok) {
        if (result.notConnected) return showConnect(true);
        error.textContent = result.error;
        error.hidden = false;
        button.disabled = false;
        button.textContent = "Use this registry link";
        return;
      }
      if (result.data.linked.length === 0) {
        // The link changed on Regibee since the check. Check again.
        await checkDuplicate();
        return;
      }
      showLinked(user, registryId, registry().title, link.store);
      return;
    }
    const name = title.value.replace(/\s+/g, " ").trim();
    if (!name) {
      error.textContent = "Give the item a name.";
      error.hidden = false;
      title.focus();
      return;
    }
    const priceValue = readPrice();
    if (priceValue === undefined) return;
    button.disabled = true;
    button.textContent = "Adding…";
    // A new category typed but not added yet: make it first, so the item goes in it.
    if (!newCategoryForm.hidden && categoryName(newCategory.value) && !(await addCategory())) {
      button.disabled = false;
      button.textContent = "Add to Regibee";
      return;
    }
    const item: ProductItem = {
      url: product.url,
      title: name,
      price: priceValue,
      imageUrl: images[imageIndex] ?? null,
      quantity,
      categoryId: category.value || null,
      isEssential: essential.checked,
      isOpenToUsed: openToUsed.checked,
      minimumCondition: openToUsed.checked ? (condition.value as ProductItem["minimumCondition"]) : null,
      notes: notes.value.trim() || null,
      gtin: product.gtin ?? null,
    };
    const result = await ask<AddProductResponse>({ type: "add-product", registryId, item });
    if (!result.ok) {
      if (result.notConnected) return showConnect(true);
      error.textContent = result.error;
      error.hidden = false;
      button.disabled = false;
      button.textContent = "Add to Regibee";
      return;
    }
    if ("duplicate" in result.data) {
      await checkDuplicate();
      return;
    }
    showProductAdded(user, registryId, registry().title, link?.kind === "registry" ? link.store.name : null, plainStore);
  });

  /** The price as a number, null when it's empty, or undefined after showing an error. */
  const readPrice = (): number | null | undefined => {
    const priceText = price.value.replace(/[$,\s]/g, "");
    const priceValue = priceText ? Number(priceText) : null;
    if (priceValue !== null && (!Number.isFinite(priceValue) || priceValue < 0)) {
      error.textContent = "Enter the price as a number, like 24.99.";
      error.hidden = false;
      price.focus();
      return undefined;
    }
    return priceValue;
  };

  ideaButton.addEventListener("click", async () => {
    error.hidden = true;
    const who = recipient.value.replace(/\s+/g, " ").trim();
    const name = title.value.replace(/\s+/g, " ").trim();
    if (!name) {
      error.textContent = "Give the idea a name.";
      error.hidden = false;
      title.focus();
      return;
    }
    const priceValue = readPrice();
    if (priceValue === undefined) return;
    const idea: IdeaRequest["idea"] = {
      recipient: who,
      title: name,
      url: product.url,
      imageUrl: images[imageIndex] ?? null,
      price: priceValue,
      notes: ideaNotes.value.trim() || null,
      gtin: product.gtin ?? null,
    };
    ideaButton.disabled = true;
    ideaButton.textContent = "Saving…";
    const result = await ask<IdeaResponse>({ type: "add-idea", idea });
    if (!result.ok) {
      if (result.notConnected) return showConnect(true);
      error.textContent = result.error;
      error.hidden = false;
      ideaButton.disabled = false;
      ideaButton.textContent = "Save gift idea";
      return;
    }
    showIdeaSaved(user, result.data.added.recipient);
  });

  const field = (id: string, label: string, control: Node, extra?: string) =>
    h("div", { className: `field${extra ? ` ${extra}` : ""}` }, h("label", { for: id }, label), control);

  // ── The fields that go with each kind of list ──
  const heading = h("h1", { className: "sr-only" });
  const listField = field("list", "Add to", listSelect);

  const quantityField = field(
    "quantity",
    "Quantity",
    h(
      "div",
      { className: "stepper" },
      h("button", { type: "button", className: "icon-button", "aria-label": "Fewer", onclick: () => setQuantity(quantity - 1) }, icon(MINUS)),
      qty,
      h("button", { type: "button", className: "icon-button", "aria-label": "More", onclick: () => setQuantity(quantity + 1) }, icon(PLUS))
    )
  );
  const ideaTop = h(
    "div",
    { className: "group" },
    h(
      "p",
      { className: "private-note" },
      icon(LOCK, 14),
      h("span", {}, "Only you can see gift ideas. The person they're for never does.")
    ),
    h(
      "div",
      { className: "field" },
      h("label", { for: "recipient" }, "Who's it for? (optional)"),
      recipient,
      chips.length > 0 && h("div", { className: "chips", role: "group", "aria-label": "People you've saved ideas for" }, ...chips)
    )
  );
  const listTop = h("div", { className: "group" }, linkNote, duplicateNote);
  const listBottom = h(
    "div",
    { className: "group" },
    canAddToList && categoryPicker,
    canAddToList && newCategoryForm,
    h(
      "div",
      { className: "checks" },
      h("label", { className: "check" }, essential, "Most wanted"),
      h("label", { className: "check" }, openToUsed, "Open to hand-me-downs")
    ),
    conditionField,
    field("notes", "Note for friends and family (optional)", notes)
  );
  const ideaBottom = h("div", { className: "group" }, field("idea-notes", "Note (optional, only you see it)", ideaNotes));

  function setMode(next: ProductMode) {
    mode = next;
    const idea = mode === "idea";
    heading.textContent = idea ? "Save this as a gift idea" : "Add this item to Regibee";
    ideaTop.hidden = !idea;
    ideaBottom.hidden = !idea;
    ideaButton.hidden = !idea;
    listTop.hidden = idea;
    listBottom.hidden = idea;
    quantityField.hidden = idea;
    button.hidden = idea;
    error.hidden = true;
    if (canAddToList) void ask({ type: "set-product-mode", mode });
  }

  render(
    header(user),
    h(
      "main",
      { className: "body product" },
      heading,
      h(
        "div",
        { className: "form-scroll" },
        listField,
        h("div", { className: "product-top" }, gallery, field("title", "Name", title, "grow")),
        ideaTop,
        listTop,
        h(
          "div",
          { className: "row" },
          field("price", "Price", h("div", { className: "money" }, h("span", { "aria-hidden": "true" }, "$"), price)),
          quantityField
        ),
        listBottom,
        ideaBottom
      ),
      h("div", { className: "footer-actions" }, error, button, ideaButton)
    )
  );
  // Show the right fields without saving the choice again.
  const idea = mode === "idea";
  heading.textContent = idea ? "Save this as a gift idea" : "Add this item to Regibee";
  ideaTop.hidden = ideaBottom.hidden = ideaButton.hidden = !idea;
  listTop.hidden = listBottom.hidden = quantityField.hidden = button.hidden = idea;
  if (canAddToList) void checkDuplicate();
}

/** The gift idea was saved. `recipient` is empty when the owner didn't say who it's for. */
function showIdeaSaved(user: { name: string }, recipient: string) {
  render(
    header(user),
    h(
      "main",
      { className: "body" },
      h(
        "div",
        { className: "done", role: "status" },
        icon(CIRCLE_CHECK, 36),
        h("h1", {}, recipient ? `Saved for ${recipient}` : "Saved as a gift idea"),
        h("p", { className: "lead" }, "It's in your gift ideas on Regibee. Only you can see it.")
      ),
      h(
        "div",
        { className: "footer-actions" },
        h("button", { type: "button", className: "button primary", onclick: () => window.close() }, "Done"),
        h("button", { type: "button", className: "button secondary", onclick: () => openTab(IDEAS_URL) }, "See your gift ideas")
      )
    )
  );
}

function showProductAdded(
  user: { name: string },
  registryId: string,
  registryTitle: string,
  registryStore: string | null,
  /** Set when it went on with a plain link at a store where the owner has a registry. */
  plainStore: StoreInfo | null = null
) {
  const review = () => openTab(`${REGIBEE_URL}/dashboard/registry/${registryId}`);
  // Next, the owner adds it to their store registry on the same page. The
  // extension swaps in the registry link when they next open that registry.
  if (plainStore?.registryPage) {
    render(
      header(user),
      h(
        "main",
        { className: "body" },
        h(
          "div",
          { className: "done", role: "status" },
          icon(CIRCLE_CHECK, 36),
          h("h1", {}, "Added to Regibee"),
          h("p", { className: "lead" }, `It's on ${registryTitle}. Now add it to your ${plainStore.name} registry on this page.`),
          h(
            "p",
            { className: "muted" },
            `The next time you open your ${plainStore.name} registry, we'll swap in its registry link, so gifts bought through Regibee count toward your ${plainStore.name} registry.`
          )
        ),
        h(
          "div",
          { className: "footer-actions" },
          h("button", { type: "button", className: "button primary", onclick: () => window.close() }, "Done"),
          h("button", { type: "button", className: "button secondary", onclick: review }, "Review on Regibee")
        )
      )
    );
    return;
  }
  render(
    header(user),
    h(
      "main",
      { className: "body" },
      h(
        "div",
        { className: "done", role: "status" },
        icon(CIRCLE_CHECK, 36),
        h("h1", {}, "Added to Regibee"),
        h(
          "p",
          { className: "lead" },
          registryStore
            ? `It's on ${registryTitle}, with its ${registryStore} registry link.`
            : `It's on ${registryTitle}.`
        )
      ),
      h(
        "div",
        { className: "footer-actions" },
        h("button", { type: "button", className: "button primary", onclick: review }, "Review on Regibee")
      )
    )
  );
}

/** The item was already on Regibee with a plain link, and now has its registry link. */
function showLinked(user: { name: string }, registryId: string, registryTitle: string, store: StoreInfo) {
  render(
    header(user),
    h(
      "main",
      { className: "body" },
      h(
        "div",
        { className: "done", role: "status" },
        icon(CIRCLE_CHECK, 36),
        h("h1", {}, "Registry link saved"),
        h(
          "p",
          { className: "lead" },
          `The item on ${registryTitle} now has its ${store.name} registry link, so gifts bought through it count toward your ${store.name} registry.`
        )
      ),
      h(
        "div",
        { className: "footer-actions" },
        h(
          "button",
          { type: "button", className: "button primary", onclick: () => openTab(`${REGIBEE_URL}/dashboard/registry/${registryId}`) },
          "Review on Regibee"
        )
      )
    )
  );
}

function handleFailure(result: Extract<Result<unknown>, { ok: false }>, user: { name: string } | null, retry: () => void) {
  if (result.notConnected) showConnect(true);
  else showError(user, result.error || "Something went wrong.", retry);
}

// ── Start ────────────────────────────────────────────────────────────────

/** The tab the popup is about. Tests open the popup as a page with ?tab=<id>. */
async function targetTab(): Promise<chrome.tabs.Tab | null> {
  const fromQuery = Number(new URLSearchParams(location.search).get("tab"));
  if (fromQuery) return chrome.tabs.get(fromQuery).catch(() => null);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function readTab(tab: chrome.tabs.Tab | null): Promise<ReadResult | null> {
  if (tab?.id === undefined) return null;
  try {
    const result = (await chrome.tabs.sendMessage(tab.id, { type: "read" } satisfies ContentRequest)) as ReadResult | undefined;
    return result ?? null;
  } catch {
    // No content script there: not a store page, or it loaded before the extension.
    return null;
  }
}

/** The product on the tab, read in the page. Works on any site because the owner clicked the button. */
async function readProduct(tab: chrome.tabs.Tab | null): Promise<ProductPage | null> {
  if (tab?.id === undefined) return null;
  try {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readProductPage });
    const page = injection?.result as ProductPage | undefined;
    return page?.title && /^https?:/i.test(page.url) ? page : null;
  } catch {
    // Pages the extension can't run on: chrome:// pages, the Web Store, PDFs.
    return null;
  }
}

/**
 * The Elfster wishlist on the tab, or null on any other page. Like the
 * product reader, it runs in the page only because the owner clicked the
 * button.
 */
async function readWishlist(tab: chrome.tabs.Tab | null): Promise<WishlistPage | null> {
  if (tab?.id === undefined || !isElfsterWishlistUrl(tab.url)) return null;
  try {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readElfsterWishlist });
    const page = injection?.result as WishlistPage | undefined;
    return page?.isWishlist ? page : null;
  } catch {
    return null;
  }
}

function storesWithRegistries(state: PopupState, registry: ExtensionRegistry | undefined): Set<StoreId> {
  return new Set<StoreId>([
    ...(registry?.storeRegistries ?? []).map((r) => r.store),
    ...(Object.keys(state.lastChecked) as StoreId[]),
  ]);
}

async function start() {
  render(header(null), h("main", { className: "body" }, h("p", { className: "muted" }, "Loading…")));

  const stateResult = await ask<PopupState>({ type: "state" });
  if (!stateResult.ok) return showError(null, stateResult.error, start);
  const state = stateResult.data;
  if (!state.connected) return showConnect();

  const tab = await targetTab();
  const [registriesResult, read, menu] = await Promise.all([
    ask<RegistriesResult>({ type: "registries" }),
    readTab(tab),
    ask<MenuClick | null>({ type: "menu-click" }),
  ]);
  // Opened from the right-click menu on this tab.
  const menuClick = menu.ok && menu.data && menu.data.tabId === tab?.id ? menu.data : null;
  if (!registriesResult.ok) return handleFailure(registriesResult, state.user, start);
  const data = registriesResult.data;
  const user = data.user;
  const noRegistries = data.registries.length === 0 || !data.registryId;

  // Without a registry, a product page can still be saved as a gift idea.
  if (noRegistries && !read?.store) {
    const page = await readProduct(tab);
    if (page && (page.isProduct || menuClick)) {
      return showProduct({
        user,
        product: page,
        registries: [],
        registryId: null,
        mode: "idea",
        ideaRecipients: data.ideaRecipients ?? [],
        storesWithRegistries: new Set(),
        preferredImage: menuClick?.imageUrl,
      });
    }
  }
  if (noRegistries || !data.registryId) return showNoRegistries(user);

  if (read?.store) {
    const store = getStore(read.store);
    if (read.items.length === 0) return showCouldntRead(user, store, start);
    return showImport({
      user,
      store,
      items: read.items,
      registries: data.registries,
      registryId: data.registryId,
      mode: state.mode,
      reload: start,
    });
  }

  // An Elfster wishlist, unless the owner right-clicked to add the page itself.
  const wishlist = menuClick ? null : await readWishlist(tab);
  if (wishlist) {
    if (wishlist.failed || wishlist.items.length === 0) return showCouldntReadWishlist(user, wishlist, start);
    return showWishlist({ user, wishlist, registries: data.registries, registryId: data.registryId, reload: start });
  }

  const page = await readProduct(tab);
  // From the right-click menu the owner asked to add this page, so show the
  // form even when nothing on it says it's a product.
  if (page && (page.isProduct || menuClick)) {
    return showProduct({
      user,
      product: page,
      registries: data.registries,
      registryId: data.registryId,
      mode: state.productMode ?? "list",
      ideaRecipients: data.ideaRecipients ?? [],
      storesWithRegistries: storesWithRegistries(state, data.registries.find((r) => r.id === data.registryId)),
      preferredImage: menuClick?.imageUrl,
    });
  }
  showHome(state, user, data, page);
}

void start();

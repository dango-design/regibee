// Syncing an Elfster wishlist in the background. A list's page on Regibee
// asks the extension to sync one of the list's wishlists. When the owner has
// allowed the extension to read Elfster, it opens a page on Elfster in a
// background tab, reads the wishlist there and sends it to the sync route.
// These use a made-up wishlist and made-up answers from Elfster and Regibee.
//
// Playwright can't answer Chrome's permission prompt, so the tests where the
// owner allowed it load extension/dist-granted, a copy built with access to
// Elfster from the start (build.mjs --grant-elfster).

import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page, Worker } from "@playwright/test";
import type { ImportCheckResponse, WishlistSyncRequest, WishlistSyncResponse } from "../../src/lib/extension";
import { importItemKey } from "../../src/lib/extension";
import { ELFSTER_ORIGINS, ELFSTER_SYNC_PAGE } from "../../src/lib/wishlist-import";
import { readElfsterWishlist } from "../src/elfster-reader";
import { connect, expect, openTabsBlankFirst, REGISTRY, test, type ApiCall } from "./extension";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const LIST_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const WISHLIST_URL = `https://www.elfster.com/profile/${USER_ID}/wish-lists/${LIST_ID}`;
const LIST_PAGE = `https://www.regibee.com/dashboard/registry/${REGISTRY.id}`;

function wish(index: number, fields: Record<string, unknown> = {}) {
  return {
    wishId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    wishlistId: LIST_ID,
    quantityPurchased: 0,
    quantityReceived: 0,
    title: `Wish ${index}`,
    sourceUrl: `https://shop.example.com/p/${index}`,
    quantity: 1,
    price: { currency: "USD", amount: 10 + index },
    ...fields,
  };
}

// The second one has been bought by someone in the owner's family.
const WISHES = [wish(1), wish(2, { title: "Board game", quantityPurchased: 1 }), wish(3)];

interface Elfster {
  /** The paths each Elfster page and API call asked for. */
  asked: string[];
}

/** Answers Elfster's site: the small page the extension opens, the wishlist page, and the API. */
async function serveElfster(context: BrowserContext, { status = 200, wishes = WISHES } = {}): Promise<Elfster> {
  const elfster: Elfster = { asked: [] };
  await context.route(
    (url) => url.hostname === "www.elfster.com",
    (route) => {
      const url = new URL(route.request().url());
      elfster.asked.push(`${url.pathname}${url.search}`);
      if (url.href === ELFSTER_SYNC_PAGE) return route.fulfill({ contentType: "text/plain", body: "User-agent: *\n" });
      if (url.href === WISHLIST_URL) {
        return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Elfster</title><h1>My Wish List</h1>" });
      }
      // Signed out of Elfster, its API refuses.
      if (status !== 200) return route.fulfill({ status, json: { error: "no" } });
      if (url.pathname === `/v1/wishlists/${LIST_ID}`) return route.fulfill({ json: { wishlistId: LIST_ID, title: "My Wish List" } });
      if (url.pathname === `/v1/wishlists/${LIST_ID}/wishes`) {
        const limit = Number(url.searchParams.get("limit"));
        const offset = Number(url.searchParams.get("offset"));
        return route.fulfill({ json: wishes.slice(offset, offset + limit) });
      }
      return route.fulfill({ status: 404, json: {} });
    }
  );
  return elfster;
}

/** Answers Regibee's import routes: the list is kept in sync with the wishlist. */
async function serveImport(context: BrowserContext, calls: ApiCall[]) {
  await context.route("https://www.regibee.com/api/extension/import**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({ method: request.method(), path, body: request.postDataJSON() });
    if (path.endsWith("/check")) {
      const check: ImportCheckResponse = { existing: WISHES.map((w) => importItemKey({ url: w.sourceUrl, title: w.title })!), synced: true };
      return route.fulfill({ json: check });
    }
    if (path.endsWith("/sync")) {
      const sync: WishlistSyncResponse = { gone: [] };
      return route.fulfill({ json: sync });
    }
    return route.fulfill({ status: 404, json: {} });
  });
}

/** The list's page on Regibee, with the extension's content script ready. */
async function openListPage(context: BrowserContext): Promise<Page> {
  await context.route(
    (url) => url.href === LIST_PAGE,
    (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Regibee</title><h1>My list</h1>" })
  );
  const tab = await context.newPage();
  await tab.goto(LIST_PAGE);
  await expect.poll(() => hello(tab)).toEqual(expect.arrayContaining(["sync-elfster"]));
  return tab;
}

/** The features the extension says it has, the way the website asks. */
function hello(tab: Page): Promise<string[] | null> {
  return tab.evaluate(
    () =>
      new Promise<string[] | null>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          if (event.data?.source !== "regibee-extension" || event.data.type !== "ready") return;
          window.removeEventListener("message", onMessage);
          resolve(event.data.features ?? []);
        };
        window.addEventListener("message", onMessage);
        window.postMessage({ source: "regibee-page", type: "hello" }, location.origin);
        setTimeout(() => resolve(null), 300);
      })
  );
}

/**
 * Asks the extension the way the list's page does (src/lib/elfster-sync-client.ts)
 * and returns its whole answer, so tests can check it holds nothing else.
 */
function askExtension(tab: Page, type: "can-sync-elfster" | "sync-elfster", wishlistId = LIST_ID): Promise<Record<string, unknown>> {
  return tab.evaluate(
    ({ type, registryId, wishlistId }) =>
      new Promise<Record<string, unknown>>((resolve) => {
        const id = crypto.randomUUID();
        const answerType = type === "can-sync-elfster" ? "elfster-sync-ready" : "elfster-synced";
        const onMessage = (event: MessageEvent) => {
          const data = event.data;
          if (data?.source !== "regibee-extension" || data.type !== answerType || data.id !== id) return;
          window.removeEventListener("message", onMessage);
          resolve(data);
        };
        window.addEventListener("message", onMessage);
        window.postMessage({ source: "regibee-page", type, id, registryId, wishlistId }, location.origin);
      }),
    { type, registryId: REGISTRY.id, wishlistId }
  );
}

async function openTabs(worker: Worker): Promise<string[]> {
  return worker.evaluate(async () => (await chrome.tabs.query({})).map((tab) => tab.url ?? ""));
}

/** Opens the popup on the made-up wishlist, as the toolbar button would. */
async function openPopup(context: BrowserContext, worker: Worker, extensionId: string) {
  const tab = await context.newPage();
  await tab.goto(WISHLIST_URL);
  const wishlist = await tab.evaluate(readElfsterWishlist);
  const tabId = await worker.evaluate(async () => Math.max(...(await chrome.tabs.query({})).map((t) => t.id ?? 0)));
  const popup = await context.newPage();
  await popup.addInitScript(
    ({ url, wishlist }) => {
      const get = chrome.tabs.get.bind(chrome.tabs);
      chrome.tabs.get = (async (id: number) => ({ ...(await get(id)), url })) as typeof chrome.tabs.get;
      chrome.scripting.executeScript = (async () => [{ result: wishlist }]) as unknown as typeof chrome.scripting.executeScript;
    },
    { url: WISHLIST_URL, wishlist }
  );
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  return popup;
}

test.describe.configure({ mode: "parallel" });

test("the published extension can read Elfster only once the owner allows it", () => {
  const manifest = JSON.parse(readFileSync(path.resolve(__dirname, "../dist/manifest.json"), "utf8"));
  expect(manifest.optional_host_permissions).toEqual(ELFSTER_ORIGINS);
  expect(JSON.stringify(manifest.host_permissions)).not.toContain("elfster");
  expect(JSON.stringify(manifest.content_scripts)).not.toContain("elfster");
});

test.describe("not allowed to read Elfster", () => {
  test("does nothing, quietly", async ({ context, worker }) => {
    const calls = await connect(context, worker);
    await serveImport(context, calls);
    const elfster = await serveElfster(context);
    const tab = await openListPage(context);

    expect(await askExtension(tab, "can-sync-elfster")).toMatchObject({ ready: false });
    expect(await askExtension(tab, "sync-elfster")).toMatchObject({ synced: false });
    expect(elfster.asked).toEqual([]);
    expect(calls.filter((call) => call.path.startsWith("/api/extension/import"))).toEqual([]);
  });

  test("the popup offers to sync in the background on a synced wishlist", async ({ context, worker, extensionId }) => {
    const calls = await connect(context, worker);
    await serveImport(context, calls);
    await serveElfster(context);
    const popup = await openPopup(context, worker, extensionId);

    await expect(popup.getByText("Synced with this wishlist")).toBeVisible();
    await expect(popup.getByRole("button", { name: "Sync in the background" })).toBeVisible();
    await expect(popup.getByText("Syncs when you open your list on Regibee, if you're signed in to Elfster.")).toBeVisible();
    // Nothing on the screen says what's been bought.
    await expect(popup.getByText(/bought|purchased/i)).toHaveCount(0);
  });
});

test.describe("allowed to read Elfster", () => {
  test.use({ grantElfster: true });
  test.beforeEach(({ worker }) => openTabsBlankFirst(worker));

  test("reads the wishlist in a background tab and sends it to the sync route", async ({ context, worker }) => {
    const calls = await connect(context, worker);
    await serveImport(context, calls);
    const elfster = await serveElfster(context);
    const tab = await openListPage(context);

    const ready = await askExtension(tab, "can-sync-elfster");
    expect(ready).toEqual({ source: "regibee-extension", type: "elfster-sync-ready", id: ready.id, ready: true });
    const synced = await askExtension(tab, "sync-elfster");
    // The page learns only that it synced, never what the wishlist holds.
    expect(synced).toEqual({ source: "regibee-extension", type: "elfster-synced", id: synced.id, synced: true });

    expect(elfster.asked).toEqual([
      "/robots.txt",
      `/v1/wishlists/${LIST_ID}`,
      `/v1/wishlists/${LIST_ID}/wishes?limit=100&offset=0`,
    ]);
    // Every wish goes to the sync, with what's been given, marked as a background sync.
    const syncs = calls.filter((call) => call.path === "/api/extension/import/sync");
    expect(syncs).toHaveLength(1);
    const body = syncs[0].body as WishlistSyncRequest;
    expect(body).toMatchObject({ registryId: REGISTRY.id, wishlistId: LIST_ID, background: true });
    expect(body.items.map((item) => [item.title, item.given])).toEqual([
      ["Wish 1", 0],
      ["Board game", 1],
      ["Wish 3", 0],
    ]);
    // The tab on Elfster is closed again.
    await expect.poll(() => openTabs(worker)).not.toContainEqual(ELFSTER_SYNC_PAGE);

    // Opening the page again within the hour doesn't open Elfster again.
    expect(await askExtension(tab, "can-sync-elfster")).toMatchObject({ ready: false });
    expect(await askExtension(tab, "sync-elfster")).toMatchObject({ synced: false });
    expect(calls.filter((call) => call.path === "/api/extension/import/sync")).toHaveLength(1);
  });

  test("sends nothing when the owner isn't signed in to Elfster", async ({ context, worker }) => {
    const calls = await connect(context, worker);
    await serveImport(context, calls);
    const elfster = await serveElfster(context, { status: 401 });
    const tab = await openListPage(context);

    expect(await askExtension(tab, "sync-elfster")).toMatchObject({ synced: false });
    expect(elfster.asked).toContain(`/v1/wishlists/${LIST_ID}/wishes?limit=100&offset=0`);
    expect(calls.filter((call) => call.path === "/api/extension/import/sync")).toEqual([]);
    await expect.poll(() => openTabs(worker)).not.toContainEqual(ELFSTER_SYNC_PAGE);
  });

  test("does nothing when the extension isn't connected to Regibee", async ({ context }) => {
    const elfster = await serveElfster(context);
    const tab = await openListPage(context);

    expect(await askExtension(tab, "can-sync-elfster")).toMatchObject({ ready: false });
    expect(await askExtension(tab, "sync-elfster")).toMatchObject({ synced: false });
    expect(elfster.asked).toEqual([]);
  });

  test("refuses a wishlist id that isn't one", async ({ context, worker }) => {
    const calls = await connect(context, worker);
    await serveImport(context, calls);
    const elfster = await serveElfster(context);
    const tab = await openListPage(context);

    expect(await askExtension(tab, "sync-elfster", "../../account")).toMatchObject({ synced: false });
    expect(elfster.asked).toEqual([]);
  });

  test("the popup doesn't offer it again", async ({ context, worker, extensionId }) => {
    const calls = await connect(context, worker);
    await serveImport(context, calls);
    await serveElfster(context);
    const popup = await openPopup(context, worker, extensionId);

    await expect(popup.getByText("Synced with this wishlist")).toBeVisible();
    await expect(popup.getByRole("button", { name: "Sync in the background" })).toHaveCount(0);
  });
});

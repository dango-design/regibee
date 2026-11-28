// Importing an Elfster wishlist: the reader (src/elfster-reader.ts) asks
// Elfster's API for the wishes on the page, and the popup lists the ones that
// aren't on Regibee yet. These use a made-up wishlist and made-up answers
// from Elfster, so they run on any computer and hold nobody's real wishes.

import type { BrowserContext, Worker } from "@playwright/test";
import type {
  ImportCheckRequest,
  ImportCheckResponse,
  ImportRequest,
  ImportResponse,
  WishlistStopRequest,
  WishlistSyncRequest,
  WishlistSyncResponse,
} from "../../src/lib/extension";
import { importItemKey } from "../../src/lib/extension";
import { readElfsterWishlist, type WishlistPage } from "../src/elfster-reader";
import { connect, expect, REGISTRY, test } from "./extension";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const LIST_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const WISHLIST_URL = `https://www.elfster.com/profile/${USER_ID}/wish-lists/${LIST_ID}`;
const PICTURE = "https://cdn.elfster.example/wishes/scarf.png";

function wishId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function wish(index: number, fields: Record<string, unknown> = {}) {
  return {
    wishId: wishId(index),
    wishlistId: LIST_ID,
    owner: USER_ID,
    quantityPurchased: 0,
    quantityReceived: 0,
    // Elfster's tracking link. The reader must never use it.
    url: `https://www.elfster.com/v1/links/click/?url=tracked-${index}`,
    imageUrlIsDefault: false,
    title: `Wish ${index}`,
    description: "",
    sourceUrl: `https://shop.example.com/p/${index}`,
    imageUrl: PICTURE,
    quantity: 1,
    price: { currency: "USD", amount: 10 + index },
    isMostWanted: false,
    ...fields,
  };
}

/** A wishlist of five wishes that each show one thing the reader handles. */
const FIVE = [
  wish(1, { title: "  Wool   Scarf ", description: " The red one. ", isMostWanted: true, quantity: 2, price: { currency: "USD", amount: 24.99 } }),
  // No link, no price, and Elfster's placeholder picture.
  wish(2, { title: "A surprise", sourceUrl: null, price: undefined, imageUrlIsDefault: true }),
  // A price in another currency is left out.
  wish(3, { title: "Tea set", price: { currency: "GBP", amount: 30 } }),
  // Marked as received: left out of the import.
  wish(4, { title: "Already have it", quantityReceived: 1 }),
  // Bought by someone, not received yet: offered like any other, so nothing gives the gift away.
  wish(5, { title: "Board game", quantityPurchased: 1 }),
];

/** Serves a made-up wishlist page and answers Elfster's API for it. */
async function openWishlist(context: BrowserContext, wishes: unknown[], { status = 200 } = {}) {
  const asked: string[] = [];
  await context.route(
    (url) => url.hostname === "www.elfster.com",
    (route) => {
      const url = new URL(route.request().url());
      if (url.href === WISHLIST_URL) {
        return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Elfster</title><h1>My Wish List</h1>" });
      }
      asked.push(`${url.pathname}${url.search}`);
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
  const tab = await context.newPage();
  await tab.goto(WISHLIST_URL);
  return { tab, asked };
}

test.describe.configure({ mode: "parallel" });

test("reads each wish with its shop link, price, picture, quantity and note", async ({ context }) => {
  const { tab } = await openWishlist(context, FIVE);
  // Chrome copies the reader into the page by its source text, the same way
  // the popup's chrome.scripting.executeScript does.
  const page = await tab.evaluate(readElfsterWishlist);

  const scarf = { url: "https://shop.example.com/p/1", title: "Wool Scarf", price: 24.99, imageUrl: PICTURE, quantity: 2, notes: "The red one.", isEssential: true, wishId: wishId(1), received: 0, given: 0 };
  const surprise = { url: null, title: "A surprise", price: null, imageUrl: null, quantity: 1, notes: null, isEssential: false, wishId: wishId(2), received: 0, given: 0 };
  const teaSet = { url: "https://shop.example.com/p/3", title: "Tea set", price: null, imageUrl: PICTURE, quantity: 1, notes: null, isEssential: false, wishId: wishId(3), received: 0, given: 0 };
  const received = { url: "https://shop.example.com/p/4", title: "Already have it", price: 14, imageUrl: PICTURE, quantity: 1, notes: null, isEssential: false, wishId: wishId(4), received: 1, given: 1 };
  // Bought, not received: offered like any other, and only `given` says so.
  const boardGame = { url: "https://shop.example.com/p/5", title: "Board game", price: 15, imageUrl: PICTURE, quantity: 1, notes: null, isEssential: false, wishId: wishId(5), received: 0, given: 1 };
  expect(page).toEqual({
    isWishlist: true,
    wishlistId: LIST_ID,
    title: "My Wish List",
    received: 1,
    failed: false,
    items: [scarf, surprise, teaSet, boardGame],
    wishes: [scarf, surprise, teaSet, received, boardGame],
  } satisfies WishlistPage);
});

test("reads a long wishlist a page at a time", async ({ context }) => {
  const { tab, asked } = await openWishlist(context, Array.from({ length: 230 }, (_, index) => wish(index + 1)));
  const page = await tab.evaluate(readElfsterWishlist);

  expect(page.items).toHaveLength(230);
  expect(page.items[229].url).toBe("https://shop.example.com/p/230");
  expect(asked.filter((path) => path.includes("/wishes"))).toEqual([
    `/v1/wishlists/${LIST_ID}/wishes?limit=100&offset=0`,
    `/v1/wishlists/${LIST_ID}/wishes?limit=100&offset=100`,
    `/v1/wishlists/${LIST_ID}/wishes?limit=100&offset=200`,
  ]);
});

test("says so when Elfster doesn't answer", async ({ context }) => {
  const { tab } = await openWishlist(context, FIVE, { status: 403 });
  const page = await tab.evaluate(readElfsterWishlist);
  expect(page).toMatchObject({ isWishlist: true, failed: true, items: [] });
});

test("reads nothing on other pages", async ({ context }) => {
  const url = `https://www.elfster.com/profile/${USER_ID}/wish-lists/`;
  await context.route(
    (requested) => requested.href === url,
    (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Elfster</title>" })
  );
  const tab = await context.newPage();
  await tab.goto(url);
  expect(await tab.evaluate(readElfsterWishlist)).toMatchObject({ isWishlist: false, items: [] });
});

test("the popup lists the wishes that aren't on Regibee yet and adds the ones picked", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker);
  // The made-up Regibee answers: the board game is on the registry already.
  await context.route("https://www.regibee.com/api/extension/import**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({ method: request.method(), path, body: request.postDataJSON() });
    if (path.endsWith("/check")) {
      const { items } = request.postDataJSON() as ImportCheckRequest;
      const check: ImportCheckResponse = { existing: [importItemKey(items.find((item) => item.title === "Board game")!)!], synced: false };
      return route.fulfill({ json: check });
    }
    if (path.endsWith("/sync")) {
      const sync: WishlistSyncResponse = { gone: [] };
      return route.fulfill({ json: sync });
    }
    const { items } = request.postDataJSON() as ImportRequest;
    const added: ImportResponse = {
      added: items.map((item, index) => ({ id: `00000000-0000-4000-8000-0000000000d${index}`, title: item.title, key: importItemKey(item)! })),
      skipped: 0,
    };
    return route.fulfill({ json: added });
  });

  const { tab } = await openWishlist(context, FIVE);
  const wishlist = await tab.evaluate(readElfsterWishlist);
  // The extension can't see an Elfster tab's address, so find the tab as the newest one.
  const tabId = await worker.evaluate(async () => Math.max(...(await chrome.tabs.query({})).map((t) => t.id ?? 0)));

  // The popup, opened as a page about that tab. A click on the real toolbar
  // button lets the extension see the tab's address and read the page; a
  // test can't click it, so the popup is handed both here.
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

  await expect(popup.getByRole("heading", { name: "My Wish List on Elfster" })).toBeVisible();
  await expect(popup.getByText("4 items found · 3 not on Regibee yet")).toBeVisible();
  await expect(popup.locator(".items li")).toHaveText([/Wool Scarf\$24\.99shop\.example\.com/, /A surpriseNo link/, /Tea setshop\.example\.com/]);
  await expect(popup.getByRole("button", { name: "1 already on Regibee" })).toBeVisible();
  await expect(popup.getByText("1 item you marked as received on Elfster is left out.")).toBeVisible();

  // Leave the tea set out.
  await popup.locator(".items li", { hasText: "Tea set" }).getByRole("checkbox").uncheck();
  await popup.getByRole("button", { name: "Add 2 items to Regibee" }).click();
  await expect(popup.getByRole("heading", { name: "Added 2 items to Regibee" })).toBeVisible();
  await expect(popup.getByText(`They're on ${REGISTRY.title}.`)).toBeVisible();

  // Checking and importing never send what's been bought on Elfster.
  const checks = calls.filter((call) => call.path === "/api/extension/import/check");
  expect(checks).toHaveLength(1);
  expect((checks[0].body as ImportCheckRequest).wishlistId).toBe(LIST_ID);
  expect((checks[0].body as ImportCheckRequest).items.map((item) => item.given)).toEqual([0, 0, 0, 0]);
  const imports = calls.filter((call) => call.path === "/api/extension/import");
  expect(imports).toHaveLength(1);
  expect(imports[0].body).toEqual({
    registryId: REGISTRY.id,
    items: [
      { url: "https://shop.example.com/p/1", title: "Wool Scarf", price: 24.99, imageUrl: PICTURE, quantity: 2, notes: "The red one.", isEssential: true, wishId: wishId(1), received: 0, given: 0 },
      { url: null, title: "A surprise", price: null, imageUrl: null, quantity: 1, notes: null, isEssential: false, wishId: wishId(2), received: 0, given: 0 },
    ],
  } satisfies ImportRequest);

  // "Keep in sync" was ticked, so every wish goes to the sync, with what's been given.
  const syncs = calls.filter((call) => call.path === "/api/extension/import/sync");
  expect(syncs).toHaveLength(1);
  const sync = syncs[0].body as WishlistSyncRequest;
  expect(sync.registryId).toBe(REGISTRY.id);
  expect(sync.wishlistId).toBe(LIST_ID);
  expect(sync.items.map((item) => [item.title, item.given])).toEqual([
    ["Wool Scarf", 0],
    ["A surprise", 0],
    ["Tea set", 0],
    ["Already have it", 1],
    ["Board game", 1],
  ]);
});

/** Opens the popup on the made-up wishlist, as the toolbar button would. */
async function openPopup(context: BrowserContext, worker: Worker, extensionId: string) {
  const { tab } = await openWishlist(context, FIVE);
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

test("a registry kept in sync syncs each time, lists wishes that left, and can stop", async ({ context, worker, extensionId }) => {
  const calls = await connect(context, worker);
  let synced = true;
  await context.route("https://www.regibee.com/api/extension/import**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({ method: request.method(), path, body: request.postDataJSON() });
    if (path.endsWith("/check")) {
      const { items } = request.postDataJSON() as ImportCheckRequest;
      const check: ImportCheckResponse = { existing: items.map((item) => importItemKey(item)!), synced };
      return route.fulfill({ json: check });
    }
    if (path.endsWith("/sync")) {
      const sync: WishlistSyncResponse = { gone: [{ id: "00000000-0000-4000-8000-0000000000e1", title: "Old slippers" }] };
      return route.fulfill({ json: sync });
    }
    if (path.endsWith("/stop")) {
      synced = false;
      return route.fulfill({ json: { stopped: true } });
    }
    return route.fulfill({ status: 404, json: {} });
  });

  const popup = await openPopup(context, worker, extensionId);
  await expect(popup.getByText(`Everything on this wishlist is already on ${REGISTRY.title}.`)).toBeVisible();
  await expect(popup.getByText("Synced with this wishlist")).toBeVisible();
  await expect(popup.getByText(`"Old slippers" is no longer on this Elfster wishlist. It's still on ${REGISTRY.title}.`)).toBeVisible();
  // Nothing on the screen says what's been bought.
  await expect(popup.getByText(/bought|purchased/i)).toHaveCount(0);

  const syncs = calls.filter((call) => call.path === "/api/extension/import/sync");
  expect(syncs).toHaveLength(1);
  expect((syncs[0].body as WishlistSyncRequest).items).toHaveLength(5);

  // Stopping asks first.
  await popup.getByRole("button", { name: "Stop syncing" }).click();
  await expect(popup.getByText("Your guests could then choose gifts already bought on Elfster.")).toBeVisible();
  await popup.getByRole("button", { name: "Stop syncing" }).click();
  await expect(popup.getByRole("button", { name: "Keep in sync with Elfster" })).toBeVisible();
  const stops = calls.filter((call) => call.path === "/api/extension/import/stop");
  expect(stops.map((call) => call.body)).toEqual([{ registryId: REGISTRY.id, wishlistId: LIST_ID } satisfies WishlistStopRequest]);

  // And starts again from the button.
  synced = true;
  await popup.getByRole("button", { name: "Keep in sync with Elfster" }).click();
  await expect(popup.getByText("Synced with this wishlist")).toBeVisible();
});

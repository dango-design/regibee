// Importing an Elfster wishlist: the reader (src/elfster-reader.ts) asks
// Elfster's API for the wishes on the page, and the popup lists the ones that
// aren't on Regibee yet. These use a made-up wishlist and made-up answers
// from Elfster, so they run on any computer and hold nobody's real wishes.

import type { BrowserContext } from "@playwright/test";
import type { ImportCheckRequest, ImportCheckResponse, ImportRequest, ImportResponse } from "../../src/lib/extension";
import { importItemKey } from "../../src/lib/extension";
import { readElfsterWishlist, type WishlistPage } from "../src/elfster-reader";
import { connect, expect, REGISTRY, test } from "./extension";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const LIST_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const WISHLIST_URL = `https://www.elfster.com/profile/${USER_ID}/wish-lists/${LIST_ID}`;
const PICTURE = "https://cdn.elfster.example/wishes/scarf.png";

function wish(index: number, fields: Record<string, unknown> = {}) {
  return {
    wishId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
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
  // Bought by someone, not received yet: imported like any other, so nothing gives the gift away.
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

  expect(page).toEqual({
    isWishlist: true,
    title: "My Wish List",
    received: 1,
    failed: false,
    items: [
      { url: "https://shop.example.com/p/1", title: "Wool Scarf", price: 24.99, imageUrl: PICTURE, quantity: 2, notes: "The red one.", isEssential: true },
      { url: null, title: "A surprise", price: null, imageUrl: null, quantity: 1, notes: null, isEssential: false },
      { url: "https://shop.example.com/p/3", title: "Tea set", price: null, imageUrl: PICTURE, quantity: 1, notes: null, isEssential: false },
      { url: "https://shop.example.com/p/5", title: "Board game", price: 15, imageUrl: PICTURE, quantity: 1, notes: null, isEssential: false },
    ],
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
      const check: ImportCheckResponse = { existing: [importItemKey(items.find((item) => item.title === "Board game")!)!] };
      return route.fulfill({ json: check });
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

  const imports = calls.filter((call) => call.path === "/api/extension/import");
  expect(imports).toHaveLength(1);
  expect(imports[0].body).toEqual({
    registryId: REGISTRY.id,
    items: [
      { url: "https://shop.example.com/p/1", title: "Wool Scarf", price: 24.99, imageUrl: PICTURE, quantity: 2, notes: "The red one.", isEssential: true },
      { url: null, title: "A surprise", price: null, imageUrl: null, quantity: 1, notes: null, isEssential: false },
    ],
  } satisfies ImportRequest);
});

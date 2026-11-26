// Run with: node --test src/lib/retailers.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyStoreLink, storeItemKey } from "./retailers.ts";

test("an Amazon /clp/ page is a plain product link for the same product as /dp/", () => {
  const clp = "https://www.amazon.com/clp/B0EXAMPLE1?lv=shuf&channelId=500";
  assert.equal(classifyStoreLink(clp)?.kind, "plain");
  assert.equal(storeItemKey(clp), "amazon:B0EXAMPLE1");
  assert.equal(storeItemKey("https://www.amazon.com/dp/B0EXAMPLE1?th=1"), "amazon:B0EXAMPLE1");
});

test("an Amazon registry link is still a registry link", () => {
  const link = "https://www.amazon.com/dp/B0EXAMPLE1?colid=ABC&coliid=DEF&psc=1";
  assert.equal(classifyStoreLink(link)?.kind, "registry");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { appScreenForPath, isWebViewPath, safeAppPath } from "./in-app.ts";

test("safeAppPath keeps paths on this site and drops everything else", () => {
  assert.equal(safeAppPath("/r/some-list?x=1"), "/r/some-list?x=1");
  assert.equal(safeAppPath("https://example.com/r/x"), "/");
  assert.equal(safeAppPath("//example.com"), "/");
  assert.equal(safeAppPath("/\\example.com"), "/");
  assert.equal(safeAppPath(null), "/");
  assert.equal(safeAppPath(""), "/");
});

test("isWebViewPath names the pages guests and followers use", () => {
  assert.equal(isWebViewPath("/r/a-list"), true);
  assert.equal(isWebViewPath("/e/a-party"), true);
  assert.equal(isWebViewPath("/group-gift/token"), true);
  assert.equal(isWebViewPath("/dashboard"), false);
  assert.equal(isWebViewPath("/support"), false);
});

test("appScreenForPath sends manage pages to the app's own screens", () => {
  assert.deepEqual(appScreenForPath("/dashboard/registry/abc?highlight=1"), { screen: "registry", id: "abc" });
  assert.deepEqual(appScreenForPath("/dashboard/registry/abc/settings"), { screen: "registry", id: "abc" });
  assert.deepEqual(appScreenForPath("/dashboard/events/ev1/edit"), { screen: "event", id: "ev1" });
  assert.deepEqual(appScreenForPath("/dashboard/groups/g1"), { screen: "group", id: "g1" });
  assert.deepEqual(appScreenForPath("/dashboard/registry/new"), { screen: "home" });
  assert.deepEqual(appScreenForPath("/login"), { screen: "home" });
  assert.equal(appScreenForPath("/r/a-list"), null);
});

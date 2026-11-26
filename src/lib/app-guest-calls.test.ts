import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appCallRefusal, GUEST_ACTIONS, GUEST_LOADERS } from "./app-guest-calls.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

/** The loader names in APP_LOADERS (src/lib/app-loaders.ts). */
function loaderNames(): string[] {
  const source = read("src/lib/app-loaders.ts");
  const body = source.slice(source.indexOf("export const APP_LOADERS = {"));
  const block = body.slice(0, body.indexOf("\n};"));
  return [...block.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1]);
}

/** Every "<module>.<name>" the action route can run: each export of each module it lists. */
function actionNames(): string[] {
  const route = read("src/app/api/app/action/route.ts");
  const modules = [...route.matchAll(/import \* as (\w+) from "@\/lib\/actions\/([\w-]+)";/g)];
  return modules.flatMap(([, name, file]) => {
    const source = read(`src/lib/actions/${file}.ts`);
    return [...source.matchAll(/^export (?:async )?function (\w+)/gm)].map((match) => `${name}.${match[1]}`);
  });
}

test("the routes' loaders and actions are found, so the checks below cover them", () => {
  const loaders = loaderNames();
  const actions = actionNames();
  assert.ok(loaders.length >= 10, `only ${loaders.length} loaders found`);
  assert.ok(actions.length >= 100, `only ${actions.length} actions found`);
  for (const name of GUEST_LOADERS) assert.ok(loaders.includes(name), `${name} isn't a loader`);
  for (const name of GUEST_ACTIONS) assert.ok(actions.includes(name), `${name} isn't an action`);
});

test("a signed-in account may call every loader and action", () => {
  for (const loader of loaderNames()) assert.equal(appCallRefusal("account", { loader }), null);
  for (const action of actionNames()) assert.equal(appCallRefusal("account", { action }), null);
});

test("without a token, only the guest loaders run", () => {
  for (const loader of loaderNames()) {
    const refusal = appCallRefusal("nobody", { loader });
    if (GUEST_LOADERS.includes(loader)) assert.equal(refusal, null, loader);
    else assert.deepEqual(refusal, { error: "Sign in first.", status: 401 }, loader);
  }
  // A guest action needs a session, even one on the list.
  for (const action of actionNames()) {
    assert.deepEqual(appCallRefusal("nobody", { action }), { error: "Sign in first.", status: 401 }, action);
  }
});

test("a guest's anonymous session runs the guest loaders and actions, and nothing else", () => {
  for (const loader of loaderNames()) {
    const refusal = appCallRefusal("guest", { loader });
    if (GUEST_LOADERS.includes(loader)) assert.equal(refusal, null, loader);
    else assert.deepEqual(refusal, { error: "Guests don't have an account.", status: 403 }, loader);
  }
  for (const action of actionNames()) {
    const refusal = appCallRefusal("guest", { action });
    if (GUEST_ACTIONS.includes(action)) assert.equal(refusal, null, action);
    else assert.deepEqual(refusal, { error: "Guests don't have an account.", status: 403 }, action);
  }
});

test("the guest list holds only what the website's guest pages call", () => {
  assert.deepEqual([...GUEST_LOADERS].sort(), ["invitationPage", "publicList"]);
  assert.deepEqual([...GUEST_ACTIONS].sort(), [
    "events.submitRsvp",
    "registry.confirmGift",
    "registry.contributeToCashFund",
    "registry.coverParentPurchasedItem",
    "registry.releaseGift",
    "registry.reserveItem",
    "registry.suggestItem",
  ]);
  // The website asks for an account to start a group gift, so a guest can't.
  assert.equal(GUEST_ACTIONS.includes("groupGifts.startGroupGift"), false);
});

test("names that only look like guest calls are refused", () => {
  for (const caller of ["guest", "nobody"] as const) {
    for (const loader of ["", "constructor", "__proto__", "toString", "publicList ", "PublicList"]) {
      assert.notEqual(appCallRefusal(caller, { loader }), null, `${caller} ${loader}`);
    }
    for (const action of ["", "registry", "registry.reserveItem.extra", "registry.constructor", "Registry.reserveItem"]) {
      assert.notEqual(appCallRefusal(caller, { action }), null, `${caller} ${action}`);
    }
  }
});

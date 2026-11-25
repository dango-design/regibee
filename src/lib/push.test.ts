// Run with: node --test src/lib/push.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPO_PUSH_BATCH, expoMessages, isExpoPushToken, pushPath, unregisteredTokens } from "./push.ts";

const token = (n: number) => `ExponentPushToken[token-${n}]`;

test("isExpoPushToken takes Expo's two token formats and nothing else", () => {
  assert.equal(isExpoPushToken("ExponentPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("ExponentPushToken[]"), false);
  assert.equal(isExpoPushToken("abc123"), false);
  assert.equal(isExpoPushToken(`ExponentPushToken[${"a".repeat(300)}]`), false);
});

test("expoMessages sends one message per token, once each, in batches of 100", () => {
  const tokens = [...Array.from({ length: 150 }, (_, i) => token(i)), token(0), "not a token"];
  const batches = expoMessages(tokens, { title: "Glinda is going to Shower", path: "/events/e1" });
  assert.equal(batches.length, 2);
  assert.equal(batches[0].length, EXPO_PUSH_BATCH);
  assert.equal(batches[1].length, 50);
  assert.deepEqual(batches[0][0], {
    to: token(0),
    title: "Glinda is going to Shower",
    data: { path: "/events/e1" },
    sound: "default",
    channelId: "default",
  });
});

test("expoMessages shortens long text and leaves out an empty body", () => {
  const [[message]] = expoMessages([token(1)], { title: `A ${"very ".repeat(60)}long title`, body: "  ", path: "/registry/r1" });
  assert.equal(message.title.length, 120);
  assert.ok(message.title.endsWith("…"));
  assert.equal("body" in message, false);
});

test("expoMessages sends nothing without a token", () => {
  assert.deepEqual(expoMessages([], { title: "Hi", path: "/" }), []);
});

test("unregisteredTokens finds the tokens Expo says no longer reach a phone", () => {
  const [batch] = expoMessages([token(1), token(2), token(3)], { title: "Hi", path: "/" });
  const gone = unregisteredTokens(batch, [
    { status: "ok", id: "a" },
    { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
    { status: "error", message: "slow down", details: { error: "MessageRateExceeded" } },
  ]);
  assert.deepEqual(gone, [token(2)]);
});

test("pushPath only opens a path inside the app", () => {
  assert.equal(pushPath({ path: "/events/abc-123" }), "/events/abc-123");
  assert.equal(pushPath({ path: "https://example.com" }), null);
  assert.equal(pushPath({ path: "//example.com" }), null);
  assert.equal(pushPath({ path: "/r/x?next=y" }), null);
  assert.equal(pushPath(null), null);
  assert.equal(pushPath({}), null);
});

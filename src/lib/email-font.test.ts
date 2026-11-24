// Run with: node --test src/lib/email-font.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authEmailAlert } from "./auth-email-alert.ts";
import { AUTH_EMAILS } from "./auth-email-templates.ts";
import { EMAIL_FONT_FAMILY, withEmailFont } from "./email-font.ts";
import { coHostInviteHtml } from "./event-email-templates.ts";
import { groupGiftCalledOffHtml } from "./group-gift-email-templates.ts";

const FONT = `font-family:${EMAIL_FONT_FAMILY};`;

test("withEmailFont puts the email in a div that sets the font", () => {
  assert.equal(withEmailFont("<p>Hi</p>"), `<div style="${FONT}"><p>Hi</p></div>`);
});

test("the emails set the font", () => {
  const emails = {
    "co-host invite": coHostInviteHtml({ inviterName: "Maya", eventTitle: "Game night", inviteUrl: "https://example.com/i" }),
    "group gift called off": groupGiftCalledOffHtml({
      pledgerName: "Ann",
      organizerName: "Maya",
      itemTitle: "Stroller",
      recipientName: "Cara",
      paid: false,
    }),
    "account email alert": authEmailAlert({ kind: "auth-emails-limit", emails: 30, limit: 30, rateLimitsUrl: null }).html,
    "confirm your email": AUTH_EMAILS.confirmation.html("https://example.com/c"),
    "reset your password": AUTH_EMAILS.recovery.html("https://example.com/r"),
  };
  for (const [name, html] of Object.entries(emails)) {
    assert.ok(html.includes(FONT), `${name} sets no font`);
  }
});

// email-templates.ts imports server code, so Node can't run its templates
// here. This reads the files instead: each template returns its HTML through
// withEmailFont.
test("every template returns its HTML through withEmailFont", () => {
  for (const file of ["email-templates.ts", "event-email-templates.ts", "group-gift-email-templates.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const templates = source.match(/^export function \w+Html\(/gm) ?? [];
    const wrapped = source.match(/^  return withEmailFont\(/gm) ?? [];
    assert.ok(templates.length > 0, `${file} has no templates`);
    assert.equal(
      wrapped.length,
      templates.length,
      `${file} has ${templates.length} templates, and ${wrapped.length} return through withEmailFont`,
    );
  }
});

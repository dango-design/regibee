// Run with: node --test supabase/auth-emails.test.mts
// Fails when supabase/templates/ or the subjects in config.toml don't match
// src/lib/auth-email-templates.ts. Fix it with `npm run auth-emails`, and copy
// subject changes into config.toml by hand.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTH_EMAILS, SUPABASE_LINK, type AuthEmailName } from "../src/lib/auth-email-templates.ts";
import { templateFile } from "./auth-emails.mts";

const supabaseDir = dirname(fileURLToPath(import.meta.url));
const config = readFileSync(join(supabaseDir, "config.toml"), "utf8");

for (const name of Object.keys(AUTH_EMAILS) as AuthEmailName[]) {
  test(`supabase/templates/${name}.html is up to date`, () => {
    const onDisk = readFileSync(join(supabaseDir, `templates/${name}.html`), "utf8");
    assert.equal(onDisk, templateFile(name), "Run `npm run auth-emails`.");
    assert.ok(onDisk.includes(`href="${SUPABASE_LINK}"`), "The button needs Supabase's link.");
  });

  test(`config.toml uses the ${name} template and subject`, () => {
    const section = config.match(new RegExp(`^\\[auth\\.email\\.template\\.${name}\\]\\n([^\\[]*)`, "m"));
    assert.ok(section, `config.toml has no [auth.email.template.${name}]`);
    assert.match(section[1], new RegExp(`^subject = ${JSON.stringify(AUTH_EMAILS[name].subject)}$`, "m"));
    assert.match(section[1], new RegExp(`^content_path = "\\./supabase/templates/${name}\\.html"$`, "m"));
  });
}

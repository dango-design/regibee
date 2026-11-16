// Writes the account emails from src/lib/auth-email-templates.ts to
// supabase/templates/, where the local Supabase stack reads them.
//
//   npm run auth-emails
//
// Nothing deploys these templates. Production keeps its own copy in its auth
// settings. After changing one, paste it into the Supabase dashboard as
// CLAUDE.md describes under "Account emails".

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTH_EMAILS, SUPABASE_LINK, type AuthEmailName } from "../src/lib/auth-email-templates.ts";

/** The file for one template, as it should be on disk. */
export function templateFile(name: AuthEmailName): string {
  return AUTH_EMAILS[name].html(SUPABASE_LINK);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "templates");
  mkdirSync(templatesDir, { recursive: true });
  for (const name of Object.keys(AUTH_EMAILS) as AuthEmailName[]) {
    writeFileSync(join(templatesDir, `${name}.html`), templateFile(name));
    console.log(`Wrote supabase/templates/${name}.html (subject: ${AUTH_EMAILS[name].subject})`);
  }
}

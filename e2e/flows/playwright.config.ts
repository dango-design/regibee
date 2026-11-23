// Flow captures: scripts that walk a user flow the way the end-to-end tests
// do, and save a screenshot of every step. They use the same local Supabase,
// test server and Mailpit inbox as the tests (see ../README.md), so they
// can't run at the same time as a test run.
//
//   npx playwright test --config e2e/flows/playwright.config.ts
//
// Screenshots and a steps.json land in test-results/flows/<flow>/.

import { defineConfig } from "@playwright/test";
import path from "node:path";
import base from "../playwright.config";
import { REPO_ROOT } from "../local-supabase";

export default defineConfig({
  ...base,
  testDir: __dirname,
  // Named .flow.ts, so the tests' own config never picks them up.
  testMatch: /.*\.flow\.ts$/,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  outputDir: path.join(REPO_ROOT, "test-results", "flows", ".playwright"),
});

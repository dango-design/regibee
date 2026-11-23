// Takes the popup screenshots for the Chrome Web Store listing. See README.md
// in this folder. The extension's tests have their own config in extension/test.

import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  timeout: 60_000,
  reporter: [["list"]],
  outputDir: path.join(os.tmpdir(), "regibee-store-listing-results"),
});

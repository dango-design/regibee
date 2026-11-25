// Screenshot tests of the Storybook stories. See story-screenshots/README.md.

import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "..");
// The built Storybook the tests read (npm run build-storybook).
export const STORYBOOK_DIR = path.join(REPO_ROOT, "storybook-static");
// One PNG for each story, named by the story's id.
export const BASELINES_DIR = path.join(__dirname, "baselines");
export const RESULTS_DIR = path.join(REPO_ROOT, "test-results", "story-screenshots");
// Font files downloaded during a run (see cachedFont in stories.spec.ts).
export const FONT_CACHE_DIR = path.join(RESULTS_DIR, "fonts");
// Written by the json reporter. story-screenshots/collect.mjs reads it.
export const REPORT_FILE = path.join(RESULTS_DIR, "report.json");

// Set by GitHub Actions (.github/workflows/story-screenshots.yml).
const onCI = !!process.env.CI;

export default defineConfig({
  testDir: ".",
  // Each story loads in its own page, so the tests can run side by side.
  fullyParallel: true,
  workers: onCI ? 4 : undefined,
  timeout: 60_000,
  // A test.only left in by mistake would skip every other story.
  forbidOnly: onCI,
  // On GitHub a story that differs gets two more tries, each in a fresh page.
  // Some play functions end a moment before the page settles, and the picture
  // then depends on timing. A real change differs on every try. A story that
  // passes on a later try is reported as flaky, and collect.mjs lists it.
  retries: onCI ? 2 : 0,
  // A missing baseline fails its test, and Playwright saves the new picture in
  // the test's results. Nothing is written to story-screenshots/baselines during a run:
  // npm run screenshots:accept does that.
  updateSnapshots: "none",
  reporter: [
    [onCI ? "dot" : "list"],
    ["json", { outputFile: REPORT_FILE }],
    // Before, after and difference pictures for every failed story.
    ["html", { outputFolder: path.join(REPO_ROOT, "playwright-report", "story-screenshots"), open: "never" }],
  ],
  snapshotPathTemplate: path.join(BASELINES_DIR, "{arg}{ext}"),
  outputDir: path.join(RESULTS_DIR, "output"),
  expect: {
    // Any pixel that differs fails the test.
    toMatchSnapshot: { maxDiffPixels: 0 },
  },
  use: {
    ...devices["Desktop Chrome"],
    // Chromatic's default width. A story that sets a viewport overrides it.
    viewport: { width: 1200, height: 800 },
    // One device pixel for each CSS pixel keeps the PNGs small.
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    reducedMotion: "reduce",
  },
});

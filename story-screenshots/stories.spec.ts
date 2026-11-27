// Takes a screenshot of every Storybook story and compares it with the
// story's baseline in story-screenshots/baselines. See story-screenshots/README.md.

import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BASELINES_DIR, FONT_CACHE_DIR, STORYBOOK_DIR } from "./playwright.config";

type IndexEntry = { type: string; id: string; title: string; name: string };

// A made-up host. Every request to it is answered from storybook-static, so
// the tests need no server and no port.
//
// It must be https. The browser only gives an https page (or localhost)
// navigator.clipboard, and Storybook only gives a play function the
// `userEvent` in its context when navigator.clipboard exists. Over http,
// `async ({ userEvent }) => userEvent.click(...)` throws, and the story was
// pictured as if it had no play function.
const ORIGIN = "https://storybook.test";

// Stories load the site's fonts from here (next/font/google in Storybook).
const FONT_HOST = "fonts.gstatic.com";

// Every story sees this as the current time, so text such as "in 3 days"
// reads the same on every run.
const NOW = new Date("2026-11-25T18:00:00Z");

// Storybook's viewport names (globals: { viewport: { value: "mobile1" } }).
// The sizes are Storybook's own: MINIMAL_VIEWPORTS in storybook/viewport.
const VIEWPORTS: Record<string, { width: number; height: number }> = {
  mobile1: { width: 320, height: 568 },
  mobile2: { width: 414, height: 896 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1280, height: 1024 },
};

// Stories whose picture differs from one run to the next, with the reason.
// They are still opened, and still fail when they don't render, but no
// screenshot is compared. Take a story off this list once it is fixed.
const UNSTABLE: Record<string, string> = {
  "components-sectionnav--phone":
    "The row of section links ends up scrolled to a different place from run to run.",
  "pages-registry-settings--phone":
    "The row of section links ends up scrolled to a different place from run to run.",
  "components-eventform--editing-on-phone":
    "The row of section links ends up scrolled to a different place from run to run.",
  "components-rsvpform--wedding-questions":
    "Its play function ends before focus settles, so the party size field sometimes has the focus ring.",
  "components-edititemdialog--changing-the-photo": "The photo menu opens one pixel higher or lower from run to run.",
  "components-edititemdialog--more-actions": "Its menu differs from run to run, like the photo menu.",
  "components-edititemdialog--picking-a-list": "Its menu differs from run to run, like the photo menu.",
};

// What the page reports about the story once Storybook has finished with it.
type StoryState = {
  phase?: string;
  failed: boolean;
  error: string;
  // Errors thrown by the play function, or left unhandled while it ran.
  playErrors: string[];
  disableSnapshot: boolean;
  viewport?: string;
};

function stories(): IndexEntry[] {
  const indexFile = path.join(STORYBOOK_DIR, "index.json");
  if (!existsSync(indexFile)) {
    throw new Error("storybook-static/index.json is missing. Run npm run build-storybook first.");
  }
  const index = JSON.parse(readFileSync(indexFile, "utf8")) as { entries: Record<string, IndexEntry> };
  return Object.values(index.entries).filter((entry) => entry.type === "story");
}

// Downloads each font file once for a run and keeps it in the results folder.
// Every story after that reads the copy, so a run asks Google for a handful of
// files, not a few for every story. Returns nothing when the download fails.
async function cachedFont(url: URL, download: () => Promise<APIResponse>): Promise<string | undefined> {
  const name = createHash("sha256").update(url.href).digest("hex") + path.extname(url.pathname);
  const file = path.join(FONT_CACHE_DIR, name);
  if (existsSync(file)) return file;
  const response = await download().catch(() => undefined);
  if (!response?.ok()) return undefined;
  mkdirSync(FONT_CACHE_DIR, { recursive: true });
  // Write under another name first: the tests run side by side, and one must
  // never read a file another has half written.
  const partial = `${file}.${process.pid}.part`;
  writeFileSync(partial, await response.body());
  renameSync(partial, file);
  return file;
}

// Applied while a screenshot is taken. canvas-confetti draws on a canvas it
// adds to <body>, with pieces in random places, so no two runs would match.
const SCREENSHOT_STYLE = "body > canvas { visibility: hidden !important; }";

// A play function can end a moment before the page stops changing: focus
// moves back to a button, or a menu finishes opening. Take screenshots until
// two in a row are the same, and use that one.
async function settledScreenshot(page: Page): Promise<Buffer> {
  const shoot = () => page.screenshot({ fullPage: true, animations: "disabled", style: SCREENSHOT_STYLE });
  let previous = await shoot();
  for (let tries = 0; tries < 20; tries += 1) {
    await page.waitForTimeout(150);
    const next = await shoot();
    if (next.equals(previous)) return next;
    previous = next;
  }
  throw new Error("The story kept changing for several seconds, so no screenshot of it would be stable.");
}

// Runs in the page before Storybook loads. When a play function throws,
// Storybook logs the error and goes on to finish the story as usual
// (`throwPlayFunctionExceptions` is off by default), so the render phase ends
// as "finished", not "errored". It does send the error on its channel, so
// catch the channel as Storybook creates it and keep what it sends.
function recordPlayErrors() {
  type Channel = { on: (event: string, listener: (payload: unknown) => void) => void };
  type SentError = { message?: string } | undefined;
  const errors: string[] = [];
  const message = (error: SentError) => error?.message ?? String(error);
  let channel: Channel | undefined;
  Object.assign(window, { __PLAY_ERRORS__: errors });
  Object.defineProperty(window, "__STORYBOOK_ADDONS_CHANNEL__", {
    configurable: true,
    get: () => channel,
    set: (value: Channel) => {
      channel = value;
      value.on("playFunctionThrewException", (error) => errors.push(message(error as SentError)));
      value.on("unhandledErrorsWhilePlaying", (list) => errors.push(...(list as SentError[]).map(message)));
    },
  });
}

// Opens a story and waits until Storybook has rendered it and run its play
// function, or shown an error.
async function openStory(page: Page, id: string): Promise<StoryState> {
  await page.goto(`${ORIGIN}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`);
  const handle = await page.waitForFunction(() => {
    // Storybook's preview keeps the story it is showing here.
    const preview = (window as unknown as { __STORYBOOK_PREVIEW__?: { currentRender?: StoryRender } })
      .__STORYBOOK_PREVIEW__;
    type StoryRender = {
      phase?: string;
      story?: {
        parameters?: { chromatic?: { disableSnapshot?: boolean } };
        storyGlobals?: { viewport?: { value?: string } | string };
      };
    };
    const body = document.body.classList;
    // Storybook shows these in place of the story: an error, or "no preview"
    // when the id matches no story.
    const failed = body.contains("sb-show-errordisplay") || body.contains("sb-show-nopreview");
    const render = preview?.currentRender;
    const done = ["completed", "finished", "errored", "aborted"].includes(render?.phase ?? "");
    if (!failed && !done) return false;
    const viewport = render?.story?.storyGlobals?.viewport;
    return {
      phase: render?.phase,
      failed: failed || render?.phase === "errored",
      error: document.querySelector(".sb-errordisplay")?.textContent?.trim().slice(0, 2000) ?? "",
      playErrors: [...((window as unknown as { __PLAY_ERRORS__?: string[] }).__PLAY_ERRORS__ ?? [])],
      disableSnapshot: render?.story?.parameters?.chromatic?.disableSnapshot === true,
      viewport: typeof viewport === "string" ? viewport : viewport?.value,
    };
  });
  return (await handle.jsonValue()) as StoryState;
}

for (const story of stories()) {
  test(`${story.title} / ${story.name}`, async ({ page }, testInfo) => {
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === ORIGIN) {
        const file = path.join(STORYBOOK_DIR, decodeURIComponent(url.pathname));
        // Stay inside storybook-static, whatever the path says.
        if (!file.startsWith(STORYBOOK_DIR + path.sep) || !existsSync(file)) return route.fulfill({ status: 404 });
        return route.fulfill({ path: file });
      }
      if (url.hostname === FONT_HOST) {
        const file = await cachedFont(url, () => route.fetch());
        if (!file) return route.abort();
        // A page may only use a font from another site that allows it.
        return route.fulfill({ path: file, headers: { "access-control-allow-origin": "*" } });
      }
      // Nothing else leaves the machine. A story's outside image shows as a
      // broken image on every run, so the picture stays the same.
      return route.abort();
    });
    await page.clock.setFixedTime(NOW);
    await page.addInitScript(recordPlayErrors);

    let state = await openStory(page, story.id);

    // The same stories Chromatic skips (see "Visual tests" in CLAUDE.md).
    test.skip(state.disableSnapshot, "The story sets chromatic.disableSnapshot");

    // Storybook's own page resizes the story for a viewport. Here the story
    // is the whole page, so resize the page and load the story again.
    const size = state.viewport ? VIEWPORTS[state.viewport] : undefined;
    if (state.viewport && !size) throw new Error(`Unknown viewport "${state.viewport}". Add it to VIEWPORTS.`);
    if (size) {
      await page.setViewportSize(size);
      state = await openStory(page, story.id);
    }

    expect(state.failed, `The story did not render (${state.phase ?? "no story"}). ${state.error}`).toBe(false);
    expect(state.playErrors, "The story's play function failed, so the picture would not show what it sets up").toEqual(
      [],
    );

    test.skip(story.id in UNSTABLE, UNSTABLE[story.id]);

    // Text drawn before a font arrives, or after it failed to, would use a
    // fallback font.
    const failedFonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts)
        .filter((font) => font.status === "error")
        .map((font) => font.family);
    });
    expect(failedFonts, "A font did not load, so the text would be in the wrong font").toEqual([]);
    // A lazy image below the first screen never loads on its own, and the
    // screenshot covers the whole page. Load them all, then wait for each to
    // load or fail.
    await page.evaluate(() => {
      for (const image of Array.from(document.images)) image.loading = "eager";
    });
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));

    const name = `${story.id}.png`;
    const picture = await settledScreenshot(page);
    if (!existsSync(path.join(BASELINES_DIR, name))) {
      // Playwright keeps no picture for a story with no baseline. Attach one
      // under the name it uses for a changed story, so story-screenshots/collect.mjs
      // picks up both the same way.
      const actual = testInfo.outputPath(`${story.id}-actual.png`);
      writeFileSync(actual, picture);
      await testInfo.attach(`${story.id}-actual.png`, { path: actual, contentType: "image/png" });
      throw new Error(`${name} has no baseline yet. Accept it with npm run screenshots:accept.`);
    }
    expect(picture).toMatchSnapshot(name);
  });
}

// Saves a screenshot of each step of a flow, with a steps.json that says what
// each one is. A flow map page is built from that folder.

import fs from "node:fs";
import path from "node:path";
import type { Browser, Locator, Page } from "@playwright/test";
import { REPO_ROOT } from "../local-supabase";
import type { ReceivedEmail } from "../mailbox";

export interface FlowStep {
  /** Order taken, from 1. */
  n: number;
  id: string;
  /** Who is looking at this screen, or "email" for a message in an inbox. */
  lane: "host" | "guest" | "email";
  /** The person, such as "Maya (host)". */
  who: string;
  title: string;
  note: string;
  file: string;
  width: number;
  height: number;
  /** The page's path, without any token. */
  path?: string;
  /** The phase of the flow this step is in. */
  phase: string;
  /** The steps that lead here, by id. Empty when something else starts it. */
  after: string[];
  /** What takes someone from those steps to this one, such as the button they press. */
  via?: string;
  /** What starts this step when no other step leads to it, such as a daily job. */
  trigger?: string;
  /** Pixels from the top to the part of the page this step is about. */
  focusY?: number;
  /** For emails. */
  subject?: string;
  from?: string;
  to?: string;
}

export interface Shot {
  id: string;
  lane: FlowStep["lane"];
  who: string;
  title: string;
  note: string;
  /** The step or steps that lead here, by id. Left out, it's the step before. */
  after?: string | string[];
  via?: string;
  trigger?: string;
}

export class FlowCapture {
  readonly dir: string;
  private steps: FlowStep[] = [];
  private phases: { title: string; summary: string }[] = [];
  private extra: { notCovered?: string[]; noticed?: string[] } = {};

  constructor(
    private flow: string,
    private title: string,
    private summary: string,
  ) {
    this.dir = path.join(REPO_ROOT, "test-results", "flows", flow);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
  }

  /** What the map leaves out, and anything odd seen along the way. The map lists both under the canvas. */
  notes(notes: { notCovered?: string[]; noticed?: string[] }) {
    this.extra = { ...this.extra, ...notes };
  }

  /** Starts a phase. The steps that follow belong to it. */
  phase(title: string, summary: string) {
    this.phases.push({ title, summary });
  }

  private save(step: Omit<FlowStep, "n" | "phase" | "after"> & Pick<Shot, "after">) {
    const previous = this.steps[this.steps.length - 1];
    const after = step.trigger ? [] : step.after ? [step.after].flat() : previous ? [previous.id] : [];
    const phase = this.phases[this.phases.length - 1]?.title ?? "";
    this.steps.push({ ...step, n: this.steps.length + 1, phase, after });
    // Written after every step, so a run that stops early still leaves its steps.
    const file = { flow: this.flow, title: this.title, summary: this.summary, phases: this.phases, ...this.extra, steps: this.steps };
    fs.writeFileSync(path.join(this.dir, "steps.json"), JSON.stringify(file, null, 2));
  }

  /**
   * A screenshot of the whole page as it is now. The window is made as tall
   * as the page first, so a header that sticks to the top stays at the top
   * and a toast lands at the bottom, instead of in the middle of a long page.
   * `focus` is the part of the page this step is about: the flow map shows
   * that part when it crops a long page.
   */
  async page(page: Page, shot: Shot & { focus?: Locator }) {
    const { focus, ...rest } = shot;
    await settle(page);
    const base = page.viewportSize()!;
    const pageHeight = () => page.evaluate(() => document.documentElement.scrollHeight);
    let height = Math.max(await pageHeight(), base.height);
    if (height > base.height) {
      await page.setViewportSize({ width: base.width, height });
      await page.waitForTimeout(250);
      // Some layouts grow with the window. One more pass settles it.
      const again = Math.max(await pageHeight(), base.height);
      if (again !== height) {
        height = again;
        await page.setViewportSize({ width: base.width, height });
        await page.waitForTimeout(250);
      }
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = focus ? await focus.boundingBox() : null;
    const file = `${String(this.steps.length + 1).padStart(2, "0")}-${rest.id}.jpg`;
    await page.screenshot({ path: path.join(this.dir, file), type: "jpeg", quality: 82 });
    await page.setViewportSize(base);
    const url = new URL(page.url());
    this.save({
      ...rest,
      file,
      width: base.width,
      height,
      path: url.pathname,
      ...(box ? { focusY: Math.round(box.y + box.height / 2) } : {}),
    });
  }

  /**
   * A screenshot of an email, drawn from its HTML. The event emails set no
   * font, so each mail app uses its own. This uses Arial, as Gmail does.
   */
  async email(browser: Browser, email: ReceivedEmail, shot: Omit<Shot, "lane">) {
    const width = 600;
    const context = await browser.newContext({ viewport: { width, height: 200 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.setContent(email.html, { waitUntil: "load" });
    await page.addStyleTag({ content: "html { font-family: Arial, Helvetica, sans-serif; font-size: 14px; } body { margin: 0; padding: 20px; }" });
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width, height });
    const file = `${String(this.steps.length + 1).padStart(2, "0")}-${shot.id}.jpg`;
    await page.screenshot({ path: path.join(this.dir, file), type: "jpeg", quality: 82 });
    await context.close();
    this.save({ ...shot, lane: "email", file, width, height, subject: email.subject, from: email.from, to: email.to.join(", ") });
  }
}

/** Waits for the page to stop loading, and hides Next.js's dev badge. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  // Toasts and transitions finish.
  await page.waitForTimeout(400);
}

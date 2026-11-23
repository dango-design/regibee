// Builds a flow map page from a captured flow: the screenshots laid out in
// lanes (host, email, guest), in order, with an arrow from each step to the
// next. Run a flow first (see playwright.config.ts here), then:
//
//   node e2e/flows/build-map.mjs event-hosting
//
// It writes index.html next to the screenshots, in test-results/flows/<flow>/.
// The page has no <html> or <head> of its own, since it's published as a
// Claude artifact, which adds them. It also opens from a local web server.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const flowName = process.argv[2];
if (!flowName) {
  console.error("Usage: node e2e/flows/build-map.mjs <flow>");
  process.exit(1);
}
const dir = path.join(repoRoot, "test-results", "flows", flowName);
const flow = JSON.parse(fs.readFileSync(path.join(dir, "steps.json"), "utf8"));

const git = (...args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
const commit = git("rev-parse", "--short", "HEAD");
const captured = new Date(fs.statSync(path.join(dir, "steps.json")).mtime).toLocaleDateString("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// Ids, slugs and tokens are different on every run and mean nothing to a
// reader, so paths show the route instead.
function routeOf(step) {
  if (!step.path) return undefined;
  let route = step.path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "[eventId]")
    .replace(/^\/e\/[^/]+/, "/e/[slug]");
  if (step.lane === "guest" && route.startsWith("/e/")) route += "?g=[token]";
  return route;
}

const steps = flow.steps.map((step) => ({
  n: step.n,
  id: step.id,
  lane: step.lane,
  who: step.who,
  title: step.title,
  note: step.note,
  file: step.file,
  width: step.width,
  height: step.height,
  phase: step.phase,
  after: step.after,
  via: step.via,
  trigger: step.trigger,
  focusY: step.focusY,
  route: routeOf(step),
  subject: step.subject,
  from: step.from,
}));

const data = {
  flow: flowName,
  title: flow.title,
  summary: flow.summary,
  phases: flow.phases,
  noticed: flow.noticed ?? [],
  notCovered: flow.notCovered ?? [],
  steps,
  commit,
  captured,
};

const template = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "map-template.html"), "utf8");
const html = template
  .replaceAll("{{TITLE}}", flow.title)
  // "<" is escaped so no text in the data can close the script tag.
  .replace("{{DATA}}", JSON.stringify(data).replaceAll("<", "\\u003c"));
fs.writeFileSync(path.join(dir, "index.html"), html);
console.log(`Wrote ${path.relative(repoRoot, path.join(dir, "index.html"))}: ${steps.length} steps`);

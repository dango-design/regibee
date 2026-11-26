// Run after the screenshot tests. Gathers what would bring story-screenshots/baselines up
// to date into story-screenshots/new-baselines: the new picture of every story that had
// no baseline or differed from it, and a manifest.json that also names the
// baselines whose story is gone. `npm run screenshots:accept` applies that folder.
//
// Exits 1 when there is anything to accept, or when a story failed for another
// reason, such as an error while rendering.

import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const reportFile = path.join(root, "test-results", "story-screenshots", "report.json");
const baselinesDir = path.join(here, "baselines");
const outDir = path.join(here, "new-baselines");

if (!existsSync(reportFile)) {
  console.error("No report at test-results/story-screenshots/report.json. Run npm run test:screenshots first.");
  process.exit(1);
}
const report = JSON.parse(readFileSync(reportFile, "utf8"));

// Every test in the report, whatever file or group it is in.
function allTests(suite) {
  const own = (suite.specs ?? []).flatMap((spec) => spec.tests.map((test) => ({ title: spec.title, test })));
  return own.concat((suite.suites ?? []).flatMap(allTests));
}
const tests = report.suites.flatMap(allTests);

// Each test's title is "<story title> / <story name>". Its story id, and so its
// baseline's file name, comes from storybook-static.
const index = JSON.parse(readFileSync(path.join(root, "storybook-static", "index.json"), "utf8"));
const titles = new Map(Object.values(index.entries).map((e) => [`${e.title} / ${e.name}`, `${e.id}.png`]));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const update = [];
const broken = [];
const flaky = [];
let ran = 0;
for (const { title, test } of tests) {
  if (test.status === "skipped") continue;
  ran += 1;
  if (test.status === "expected") continue;
  // Differed on one try and matched on a later one.
  if (test.status === "flaky") {
    flaky.push(title);
    continue;
  }
  const result = test.results.at(-1);
  // Playwright attaches the new picture as "<story id>-actual.png" when the
  // baseline is missing or different.
  const actual = result?.attachments?.find((a) => a.name.endsWith("-actual.png") && a.path);
  if (!actual) {
    broken.push(title);
    continue;
  }
  // Playwright shortens a long name and adds a hash to it
  // ("components-missingdetailsn-34e5d-…-actual.png"), so take the file name
  // from the story id when the title is known.
  const file = titles.get(title) ?? actual.name.replace(/-actual\.png$/, ".png");
  cpSync(actual.path, path.join(outDir, file));
  update.push(file);
}

// A story id is its baseline's file name. Only a run of every story can tell
// that a baseline's story is gone.
const complete = report.stats?.interrupted !== true && !process.argv.includes("--partial");
const expected = new Set(
  tests
    .filter(({ test }) => test.status !== "skipped")
    .flatMap(({ test }) => test.results.flatMap((r) => r.attachments ?? []))
    .map((a) => a.name.replace(/-(actual|expected|diff)\.png$/, ".png")),
);
const kept = new Set([...expected, ...update]);
const existing = existsSync(baselinesDir) ? readdirSync(baselinesDir).filter((f) => f.endsWith(".png")) : [];
// A passing test attaches nothing, so its baseline is known only by being
// there. Stories that ran are matched through the ids in storybook-static.
for (const { title, test } of tests) {
  if (test.status !== "skipped" && titles.has(title)) kept.add(titles.get(title));
}
const remove = complete ? existing.filter((file) => !kept.has(file)) : [];

update.sort();
remove.sort();
writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ commit: process.env.SCREENSHOTS_COMMIT ?? null, update, remove }, null, 2) + "\n",
);

console.log(`${ran} stories compared.`);
if (update.length) console.log(`\n${update.length} new or changed:\n${update.map((f) => `  ${f}`).join("\n")}`);
if (remove.length) console.log(`\n${remove.length} baselines with no story:\n${remove.map((f) => `  ${f}`).join("\n")}`);
if (broken.length) console.log(`\n${broken.length} failed without a picture:\n${broken.map((t) => `  ${t}`).join("\n")}`);
if (!update.length && !remove.length && !broken.length) console.log("Every story matches its baseline.");
if (flaky.length) console.log(`\n${flaky.length} matched only on a second or third try (unstable):\n${flaky.map((t) => `  ${t}`).join("\n")}`);

// On GitHub Actions, show the same on the run's summary page.
if (process.env.GITHUB_STEP_SUMMARY) {
  const list = (heading, items) => (items.length ? `\n**${items.length} ${heading}**\n\n${items.map((i) => `- \`${i}\``).join("\n")}\n` : "");
  const summary =
    `### Story screenshots\n\n${ran} stories compared.\n` +
    list("new or changed", update) +
    list("baselines with no story", remove) +
    list("failed without a picture", broken) +
    list("matched only on a second or third try (unstable, see the README)", flaky) +
    (update.length || remove.length
      ? "\nLook at the pictures in the `story-screenshots-report` artifact. If the changes are meant, run `npm run screenshots:accept` on the branch, then commit and push.\n"
      : "") +
    (!update.length && !remove.length && !broken.length ? "\nEvery story matches its baseline.\n" : "");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
process.exit(update.length || remove.length || broken.length ? 1 : 0);

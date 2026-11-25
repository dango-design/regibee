// npm run screenshots:accept
//
// Accepts the changes the Story screenshots check found on this branch: it
// downloads the new pictures from the check's run on GitHub and puts them in
// story-screenshots/baselines. You then commit and push them. Needs the gh CLI.
//
//   npm run screenshots:accept              the run for the commit you are on
//   npm run screenshots:accept -- --run ID  a run you name
//
// Baselines only ever come from GitHub's Linux runner. A Mac draws text a
// little differently, so pictures taken here would never match.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const baselinesDir = path.join(here, "baselines");
const WORKFLOW = "story-screenshots.yml";
const ARTIFACT = "story-screenshots-new-baselines";

const run = (command, args) => execFileSync(command, args, { encoding: "utf8" }).trim();
function stop(message) {
  console.error(message);
  process.exit(1);
}

const head = run("git", ["rev-parse", "HEAD"]);
const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

const runFlag = process.argv.indexOf("--run");
let runId = runFlag === -1 ? undefined : process.argv[runFlag + 1];
if (runFlag !== -1 && !/^\d+$/.test(runId ?? "")) stop("--run needs a run id, such as --run 123456789.");

if (!runId) {
  const runs = JSON.parse(
    run("gh", ["run", "list", "--workflow", WORKFLOW, "--branch", branch, "--limit", "20", "--json", "databaseId,headSha,status"]),
  );
  // Only the run for this exact commit: an older run's pictures may be out of date.
  const match = runs.find((r) => r.headSha === head);
  if (!match) {
    stop(
      `No Story screenshots run on GitHub for this commit (${head.slice(0, 7)} on ${branch}).\n` +
        "Push the branch and wait for the check, or name a run with --run.",
    );
  }
  if (match.status !== "completed") stop("The Story screenshots check for this commit is still running. Try again when it finishes.");
  runId = String(match.databaseId);
}

const download = mkdtempSync(path.join(tmpdir(), "story-screenshots-"));
try {
  try {
    execFileSync("gh", ["run", "download", runId, "--name", ARTIFACT, "--dir", download], { stdio: "pipe" });
  } catch {
    stop(`Run ${runId} has no ${ARTIFACT} artifact. Artifacts are kept for 7 days. Run the check again if it is older.`);
  }
  const manifest = JSON.parse(readFileSync(path.join(download, "manifest.json"), "utf8"));
  // The artifact was made by a run of the branch's code. Take only plain PNG
  // names from it, so it can't write or delete anything outside the baselines.
  const isBaseline = (file) => typeof file === "string" && /^[a-z0-9-]+\.png$/.test(file);
  const update = (manifest.update ?? []).filter(isBaseline);
  const remove = (manifest.remove ?? []).filter(isBaseline);

  mkdirSync(baselinesDir, { recursive: true });
  for (const file of update) {
    if (!existsSync(path.join(download, file))) stop(`The artifact names ${file} but doesn't hold it.`);
    cpSync(path.join(download, file), path.join(baselinesDir, file));
  }
  for (const file of remove) rmSync(path.join(baselinesDir, file), { force: true });

  if (!update.length && !remove.length) {
    console.log("Nothing to accept: every story matched its baseline in that run.");
  } else {
    console.log(`Accepted ${update.length} new or changed, removed ${remove.length}.`);
    console.log("Look at them with git status and git diff, then commit and push story-screenshots/baselines.");
  }
} finally {
  rmSync(download, { recursive: true, force: true });
}

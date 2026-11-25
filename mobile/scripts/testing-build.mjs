// Starts a new Android testing build, uploaded to Google Play's internal
// testing track, when the app's native code has changed since the last one.
//
// Over-the-air updates only reach builds whose native code matches (the
// runtime version, a fingerprint of the native code). So after a change to
// native code, testers need a new build from Play. This checks whether a
// testing build already exists for the current fingerprint, on EAS, and starts
// one only if there isn't. A build still running counts, so two merges in a
// row start one build.
//
//   node scripts/testing-build.mjs            # start a build if one is needed
//   node scripts/testing-build.mjs --dry-run  # only say whether one is needed
//
// The Android testing build workflow (.github/workflows/mobile-build.yml) runs
// it on each merge to main. Run it from mobile/, signed in to EAS. iPhone
// builds wait for the Apple Developer account.

import { execFileSync } from "node:child_process";

const dryRun = process.argv.includes("--dry-run");
// GitHub Actions has `eas` installed (expo/expo-github-action). On a computer,
// use the latest EAS CLI, as mobile/README.md does.
const eas = process.env.CI ? ["eas"] : ["npx", "--yes", "eas-cli@latest"];

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function runEas(args) {
  return run(eas[0], [...eas.slice(1), ...args]);
}

const fingerprint = JSON.parse(run("npx", ["expo-updates", "fingerprint:generate", "--platform", "android"])).hash;
if (!/^[0-9a-f]{40}$/.test(fingerprint ?? "")) throw new Error(`Couldn't read the Android fingerprint: ${fingerprint}`);
console.log(`Android fingerprint: ${fingerprint}`);

const builds = JSON.parse(
  runEas([
    "build:list",
    "--platform", "android",
    "--build-profile", "testing",
    "--fingerprint-hash", fingerprint,
    "--limit", "10",
    "--json",
    "--non-interactive",
  ]),
);
// A build that failed or was canceled doesn't count: testers never got it.
const usable = builds.filter((build) => !["ERRORED", "CANCELED"].includes(build.status));

if (usable.length > 0) {
  const build = usable[0];
  console.log(
    `A testing build already has this native code: version code ${build.appBuildVersion}, ${build.status.toLowerCase()}, from ${String(build.gitCommitHash).slice(0, 7)}. No new build needed.`,
  );
  process.exit(0);
}

if (dryRun) {
  console.log("No testing build has this native code. A new build is needed.");
  process.exit(0);
}

console.log("No testing build has this native code. Starting one, uploaded to Play's internal testing track.");
execFileSync(
  eas[0],
  [...eas.slice(1), "build", "--platform", "android", "--profile", "testing", "--auto-submit", "--non-interactive", "--no-wait"],
  { stdio: "inherit" },
);

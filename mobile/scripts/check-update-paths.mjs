// Checks that the App update workflow (.github/workflows/mobile-update.yml)
// runs when a merge to main changes a website file the app runs.
//
// The app imports website files from src/lib through the `@shared/*` path,
// and those files import more of src/lib with relative paths. All of them end
// up in the app's bundle. The workflow only runs for the files named in its
// `on.push.paths`, so a change to a shared file that isn't named there
// publishes no update, and phones keep the old code.
//
// This script finds every website file the app imports, directly or through
// another shared file, and fails when:
// - one isn't covered by the workflow's push paths, or
// - the paths name a src/lib file the app no longer imports.
//
// It needs no packages, so CI runs it without `npm ci`. The App update paths
// workflow (.github/workflows/mobile-update-paths.yml) runs it on pull
// requests, and `npm run check` runs it here. Run it alone with:
//
//   node scripts/check-update-paths.mjs

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(here, "..");
const repoRoot = path.resolve(mobileDir, "..");
const workflowFile = ".github/workflows/mobile-update.yml";

/** Where `@shared/*` points, as in tsconfig.json. */
const SHARED_DIR = path.join(repoRoot, "src/lib");

/** Import specifiers in `from "x"`, `import "x"`, `import("x")` and `require("x")`. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)["']([^"']+)["']/g;

const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** The same order TypeScript and Metro try for a path without an extension. */
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];

const toRepoPath = (file) => path.relative(repoRoot, file).split(path.sep).join("/");
const isFile = (file) => existsSync(file) && statSync(file).isFile();

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return SOURCE_FILE.test(entry.name) ? [file] : [];
  });
}

function specifiers(file) {
  return [...readFileSync(file, "utf8").matchAll(SPECIFIER)].map((match) => match[1]);
}

/** The file an import points at, or null. */
function resolveImport(base) {
  if (isFile(base)) return base;
  // `./x.js` can mean `./x.ts`.
  const withoutJs = base.replace(/\.js$/, "");
  for (const candidate of [base, withoutJs]) {
    for (const ext of EXTENSIONS) {
      if (isFile(candidate + ext)) return candidate + ext;
    }
    for (const ext of EXTENSIONS) {
      const index = path.join(candidate, "index" + ext);
      if (isFile(index)) return index;
    }
  }
  return null;
}

const problems = [];

/** Every file outside mobile/ that the app's code imports, directly or not. */
function websiteFilesTheAppImports() {
  const found = new Set();
  const queue = [];
  const add = (file) => {
    if (!found.has(file)) {
      found.add(file);
      queue.push(file);
    }
  };

  for (const file of sourceFiles(path.join(mobileDir, "src"))) {
    for (const spec of specifiers(file)) {
      let target;
      if (spec.startsWith("@shared/")) target = path.join(SHARED_DIR, spec.slice("@shared/".length));
      else if (spec.startsWith(".")) target = path.resolve(path.dirname(file), spec);
      else continue;
      const resolved = resolveImport(target);
      if (!resolved) {
        if (spec.startsWith("@shared/")) problems.push(`${toRepoPath(file)} imports "${spec}", which isn't a file.`);
        continue;
      }
      if (!resolved.startsWith(mobileDir + path.sep)) add(resolved);
    }
  }

  // Follow the shared files' own imports. They may only use relative paths.
  while (queue.length > 0) {
    const file = queue.shift();
    for (const spec of specifiers(file)) {
      if (!spec.startsWith(".")) continue;
      const resolved = resolveImport(path.resolve(path.dirname(file), spec));
      if (resolved) add(resolved);
      else problems.push(`${toRepoPath(file)} imports "${spec}", which isn't a file.`);
    }
  }

  return [...found].map(toRepoPath).sort();
}

/** The list under `on: push: paths:` in the workflow, as written. */
function pushPaths() {
  const lines = readFileSync(path.join(repoRoot, workflowFile), "utf8").split("\n");
  const indent = (line) => line.match(/^ */)[0].length;
  const push = lines.findIndex((line) => /^\s+push:\s*$/.test(line));
  if (push === -1) return null;
  const pathsLine = lines.findIndex((line, i) => i > push && /^\s+paths:\s*$/.test(line));
  if (pathsLine === -1) return null;
  // `paths:` must belong to `push:`, not to a later trigger.
  for (let i = push + 1; i < pathsLine; i++) {
    if (lines[i].trim() && !lines[i].trim().startsWith("#") && indent(lines[i]) <= indent(lines[push])) return null;
  }
  const paths = [];
  for (const line of lines.slice(pathsLine + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const item = trimmed.match(/^-\s+(.+?)\s*$/);
    if (!item || indent(line) < indent(lines[pathsLine])) break;
    paths.push(item[1].replace(/^(["'])(.*)\1$/, "$2"));
  }
  return paths;
}

/** A GitHub Actions path filter as a regular expression. */
function patternToRegExp(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") {
      source += ".*";
      i++;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

/** Whether a push that changes `file` starts the workflow. The last matching pattern wins, as on GitHub. */
function triggers(paths, file) {
  let result = false;
  for (const raw of paths) {
    const negated = raw.startsWith("!");
    if (patternToRegExp(negated ? raw.slice(1) : raw).test(file)) result = !negated;
  }
  return result;
}

const imported = websiteFilesTheAppImports();
const paths = pushPaths();

if (!paths) {
  problems.push(`Couldn't find the list under on: push: paths: in ${workflowFile}.`);
} else {
  const missing = imported.filter((file) => !triggers(paths, file));
  if (missing.length > 0) {
    problems.push(
      `The app imports these website files, but a merge that changes one wouldn't publish an app update.\n` +
        `Add them under on: push: paths: in ${workflowFile}:\n` +
        missing.map((file) => `      - ${file}`).join("\n"),
    );
  }

  const stale = paths.filter((entry) => entry.startsWith("src/lib/") && !entry.includes("*") && !imported.includes(entry));
  if (stale.length > 0) {
    problems.push(
      `${workflowFile} publishes an app update for these files, but the app doesn't import them.\n` +
        `Take them out of on: push: paths:\n` +
        stale.map((entry) => `      - ${entry}`).join("\n"),
    );
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n\n"));
  process.exit(1);
}

console.log(`The App update workflow runs for all ${imported.length} website files the app imports.`);

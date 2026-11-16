// Builds the Regibee browser extension into extension/dist.
//
//   npm run extension:build   for regibee.com
//   npm run extension:dev     for http://localhost:3000, rebuilding on changes
//
// REGIBEE_URL overrides the site the extension talks to.
//
// .github/workflows/extension-publish.yml also sets EXTENSION_BUILD, the
// version's fourth part, and EXTENSION_PR, the pull request the build comes
// from. See BuildInfo in src/manifest.ts.

import * as esbuild from "esbuild";
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outdir = path.join(here, "dist");

const dev = process.argv.includes("--dev");
const watch = process.argv.includes("--watch");
const siteUrl = (process.env.REGIBEE_URL || (dev ? "http://localhost:3000" : "https://www.regibee.com")).replace(/\/+$/, "");

/** A whole number from an environment variable, or undefined when it isn't set. */
function wholeNumber(name, max) {
  const value = process.env[name];
  if (!value) return undefined;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > max) throw new Error(`${name} must be a whole number from 1 to ${max}, not "${value}".`);
  return Number(value);
}

// Chrome allows at most 65535 in each part of a version.
const buildInfo = { build: wholeNumber("EXTENSION_BUILD", 65535), pr: wholeNumber("EXTENSION_PR", Number.MAX_SAFE_INTEGER) };

const shared = {
  bundle: true,
  target: "chrome120",
  alias: { "@": path.join(root, "src") },
  logLevel: "info",
  // Readable output: Chrome Web Store review asks for code it can read.
  minify: false,
  legalComments: "none",
};

async function manifest() {
  // Bundle manifest.ts on its own and run it, so the manifest uses the same
  // store list as the site.
  const tmp = path.join(outdir, ".manifest.mjs");
  await esbuild.build({ ...shared, entryPoints: [path.join(here, "src/manifest.ts")], outfile: tmp, format: "esm", platform: "node", logLevel: "warning" });
  const { buildManifest, fullVersion, versionName } = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  await rm(tmp);
  await writeFile(path.join(outdir, "manifest.json"), `${JSON.stringify(buildManifest(siteUrl, buildInfo), null, 2)}\n`);
  return { version: fullVersion(buildInfo), versionName: versionName(buildInfo) };
}

async function copyStatic() {
  await mkdir(path.join(outdir, "icons"), { recursive: true });
  await copyFile(path.join(here, "src/popup/popup.html"), path.join(outdir, "popup.html"));
  await copyFile(path.join(here, "src/popup/popup.css"), path.join(outdir, "popup.css"));
  await copyFile(path.join(root, "src/app/icon.svg"), path.join(outdir, "logo.svg"));
  for (const file of await readdir(path.join(here, "icons"))) {
    if (file.endsWith(".png")) await copyFile(path.join(here, "icons", file), path.join(outdir, "icons", file));
  }
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
const { version, versionName } = await manifest();
await copyStatic();

const define = {
  __REGIBEE_URL__: JSON.stringify(siteUrl),
  __EXTENSION_VERSION__: JSON.stringify(version),
  __EXTENSION_VERSION_NAME__: JSON.stringify(versionName),
};

const builds = [
  { entryPoints: { background: path.join(here, "src/background.ts") }, format: "esm" },
  { entryPoints: { store: path.join(here, "src/content/store.ts") }, format: "iife" },
  { entryPoints: { connect: path.join(here, "src/content/connect.ts") }, format: "iife" },
  { entryPoints: { popup: path.join(here, "src/popup/popup.ts") }, format: "iife" },
].map((options) => ({ ...shared, ...options, outdir, define }));

if (watch) {
  for (const options of builds) {
    const context = await esbuild.context(options);
    await context.watch();
  }
  console.log(`Watching. The extension talks to ${siteUrl}. Reload it in chrome://extensions after changes.`);
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
  console.log(`Built extension/dist ${versionName} for ${siteUrl}.`);
}

// What decides whether an over-the-air update fits an installed build. The
// runtime version is a fingerprint of the native code (runtimeVersion in
// app.config.ts). Three things are left out of it, so they don't strand
// installed builds:
//
// - The commit and latest pull request that scripts/build-info.js puts in the
//   config's `extra`. They change with every commit, not the native code, and
//   no update would ever match a build from an earlier commit.
// - The product reader that app.config.ts gives expo-share-intent as
//   `preprocessorInjectJS`. It is native code only in the iPhone share
//   extension, which reads a page shared from Safari. Every edit to the reader
//   used to change the fingerprint on both platforms, so Android testers needed
//   a new build for a change their phones don't run natively. The fingerprint
//   hashes the app config once for both platforms and can't leave it out for
//   Android only. So an iPhone build keeps the reader it was built with for
//   Safari shares until the next native change. Pasted links and shares from
//   other apps use the app's own copy of the reader, which updates over the air.
//
// Expo's default skips stay. To check that a change doesn't touch the native
// code, compare `npx expo-updates fingerprint:generate --platform android`
// before and after.

const { DEFAULT_SOURCE_SKIPS, SourceSkips } = require("expo/fingerprint");

const READER_PLACEHOLDER = "product reader: left out of the fingerprint (fingerprint.config.js)";

/** The app config without the product reader, as the fingerprint hashes it. */
function withoutProductReader(contents) {
  let config;
  try {
    config = JSON.parse(contents);
  } catch {
    return contents;
  }
  let changed = false;
  for (const plugin of config.plugins ?? []) {
    if (Array.isArray(plugin) && plugin[0] === "expo-share-intent" && plugin[1]?.preprocessorInjectJS) {
      plugin[1].preprocessorInjectJS = READER_PLACEHOLDER;
      changed = true;
    }
  }
  return changed ? JSON.stringify(config) : contents;
}

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: DEFAULT_SOURCE_SKIPS | SourceSkips.ExpoConfigExtraSection,
  ignorePaths: ["scripts/build-info.js"],
  fileHookTransform(source, chunk) {
    if (source.type === "contents" && source.id === "expoConfig" && typeof chunk === "string") {
      return withoutProductReader(chunk);
    }
    return chunk;
  },
};

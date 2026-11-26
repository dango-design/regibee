import type { ExpoConfig } from "expo/config";

import { readBuildInfo } from "./scripts/build-info";
import productReader from "./src/generated/product-reader.json";

// The Expo project that runs EAS builds and over-the-air updates.
const EAS_PROJECT_ID = "dbf89b9a-6e9b-4d3f-8e7c-56605aeff72c";

// On iPhone, sharing from Safari runs this inside the page before the app
// opens, so the app gets the product's name, price and pictures straight from
// the page the owner is looking at. It's the same reader the Chrome extension
// uses (extension/src/product-reader.ts). The share extension's preprocessor
// passes everything in `metas` to the app as shareIntent.meta.
const readProductInSafari = `
    try {
      ${productReader.source}
      metas["regibee:product"] = JSON.stringify(__regibeeProductReader.readProductPage());
    } catch (error) {}
`;

// Links to these website pages open the Android app instead of the browser
// (Android App Links), in its in-app page (src/app/web.tsx). They are the
// guest and follower pages in WEB_VIEW_PATHS (src/lib/in-app.ts on the
// website), without the privacy policy. Android checks that the app may claim
// them against https://www.regibee.com/.well-known/assetlinks.json
// (public/.well-known/assetlinks.json on the website), which lists the keys
// the app is signed with. Only www.regibee.com: regibee.com redirects there,
// and Android doesn't follow redirects when it checks.
const APP_LINK_PATHS = ["/r/", "/e/", "/u/", "/group-gift/", "/invite/", "/host-invite/", "/follow-invite/", "/list-request/"];

const config: ExpoConfig = {
  name: "Regibee",
  slug: "regibee",
  // The Expo project (EAS builds and updates) belongs to the team account.
  owner: "deniseangos-team",
  version: "1.0.0",
  // An update reaches only builds with the same native code. See fingerprint.config.js.
  runtimeVersion: { policy: "fingerprint" },
  updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` },
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "regibee",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.regibee.app",
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: "com.regibee.app",
    adaptiveIcon: {
      backgroundColor: "#FAC515",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: APP_LINK_PATHS.map((pathPrefix) => ({ scheme: "https", host: "www.regibee.com", pathPrefix })),
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    // expo-contacts adds both. The app only reads the one contact someone picks.
    blockedPermissions: ["android.permission.WRITE_CONTACTS"],
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FDFAF6",
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
        dark: { backgroundColor: "#110B0A", image: "./assets/images/splash-icon.png" },
      },
    ],
    "expo-sqlite",
    // Added with posthog-react-native (analytics), which reads the phone's language.
    "expo-localization",
    [
      "expo-image-picker",
      {
        // Choosing or taking a photo for an item, a list, an invitation or a profile.
        photosPermission: "Regibee uses the photo you choose as a picture for an item or a list.",
        cameraPermission: "Regibee uses the camera when you take a photo for an item, a list or an invitation.",
        microphonePermission: false,
      },
    ],
    [
      "expo-contacts",
      {
        // On iPhone, the contact picker needs no permission. This text is only
        // there because Apple requires it of any app with the contacts code in it.
        contactsPermission: "Regibee reads the contact you pick to add them as a guest or to a group.",
      },
    ],
    [
      "expo-notifications",
      {
        // Android's small icon must be white on transparent.
        icon: "./assets/images/android-icon-monochrome.png",
        color: "#FAC515",
      },
    ],
    "@react-native-community/datetimepicker",
    // Before expo-share-intent, so it runs after it. See the plugin file.
    ["./plugins/with-share-extension-label", { target: "RegibeeShare", label: "Regibee" }],
    [
      "expo-share-intent",
      {
        // The extension's Xcode target. The share sheet shows "Regibee" (plugin above).
        iosShareExtensionName: "RegibeeShare",
        // Links from any app, and pages from Safari (which runs the reader above).
        iosActivationRules: {
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsWebPageWithMaxCount: 1,
          NSExtensionActivationSupportsText: true,
        },
        preprocessorInjectJS: readProductInSafari,
        // Android shares go through the plugin below instead.
        disableAndroid: true,
      },
    ],
    // Shared text on Android, from any app. See the plugin file.
    "./plugins/with-android-share-receiver",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: { projectId: EAS_PROJECT_ID },
    // The commit and latest pull request, shown in preview builds. See scripts/build-info.js.
    build: readBuildInfo(),
  },
};

export default config;

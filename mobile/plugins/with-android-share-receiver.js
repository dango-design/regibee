// On Android, other apps share to ShareReceiverActivity, a small activity with
// no screen, instead of to MainActivity. It passes the share on to MainActivity
// in Regibee's own task and closes.
//
// Why: some apps, Amazon among them, open the app they share to inside their
// own task, even though MainActivity asks for a single instance (launchMode
// singleTask). If that's MainActivity, React Native starts a second copy of the
// app in the same JavaScript. Expo Router has one router for the whole app,
// and the second copy takes it over. expo-share-intent then closes that copy
// and sends the share to the first one, but the router is left unhooked. The
// share screen doesn't open, and later navigation, like the + button on a
// registry, fails and leaves a blank screen until the app restarts.
//
// ShareReceiverActivity doesn't run React Native, so there's never a second
// copy. It starts MainActivity with FLAG_ACTIVITY_NEW_TASK, which opens it in
// Regibee's own task, and expo-share-intent reads the share there as before.
// expo-share-intent's own Android setup is turned off (disableAndroid in
// app.config.ts), so MainActivity isn't a share target as well.
//
// It also passes any shared text on as a plain String labeled text/plain.
// expo-share-intent drops text sent another way (getStringExtra returns null
// for other kinds of text) and reports other labels as an error.

const fs = require("node:fs");
const path = require("node:path");
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const ACTIVITY = "ShareReceiverActivity";

function activitySource(packageName) {
  return `package ${packageName}

import android.app.Activity
import android.content.Intent
import android.os.Bundle

// Made by plugins/with-android-share-receiver.js, which explains it.
class ${ACTIVITY} : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val shared = intent
    val text = shared.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
    val title = shared.getCharSequenceExtra(Intent.EXTRA_TITLE)?.toString()
    val forward = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_SEND
      if (text != null) {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
        if (title != null) putExtra(Intent.EXTRA_TITLE, title)
      } else {
        // No text, such as a file. expo-share-intent handles it as before: it
        // reports anything not labeled text/plain as an error, which the app shows.
        type = shared.type ?: "text/plain"
      }
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    startActivity(forward)
    finish()
  }
}
`;
}

function withActivityFile(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const packageName = cfg.android?.package;
      if (!packageName) throw new Error("with-android-share-receiver: android.package isn't set in app.config.ts.");
      const dir = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/java", ...packageName.split("."));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${ACTIVITY}.kt`), activitySource(packageName));
      return cfg;
    },
  ]);
}

function withActivityInManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const others = (application.activity ?? []).filter((a) => a.$["android:name"] !== `.${ACTIVITY}`);
    application.activity = [
      ...others,
      {
        $: {
          "android:name": `.${ACTIVITY}`,
          "android:exported": "true",
          // No screen of its own, no entry in recent apps, and never part of
          // Regibee's task, so it can't become that task's first screen.
          "android:theme": "@android:style/Theme.Translucent.NoTitleBar",
          "android:excludeFromRecents": "true",
          "android:noHistory": "true",
          "android:taskAffinity": "",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.intent.action.SEND" } }],
            category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
            data: [{ $: { "android:mimeType": "text/*" } }],
          },
        ],
      },
    ];
    return cfg;
  });
}

module.exports = function withAndroidShareReceiver(config) {
  return withActivityInManifest(withActivityFile(config));
};

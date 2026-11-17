# Regibee for iPhone and Android

The Regibee app, built with Expo (SDK 58) and React Native. It does what an account can do on the website. Guests don't need it: they keep using the registry and event links on the website.

## What it does

- **Share to Regibee from any app.** In the Amazon, Target or Walmart app, in Safari, Chrome or Instagram, tap Share and pick Regibee. The add form opens with the product's name, price and pictures filled in. It picks the registry you used last.
- **Reads products on the phone.** A page shared from Safari arrives already read: the share extension runs the Chrome extension's reader (`extension/src/product-reader.ts`) inside the page. A link shared from another app, or pasted, is opened in a hidden web view on the phone, and the same reader reads it. The page loads over the owner's own connection, so stores that block Regibee's server, Amazon above all, still work.
- **Paste a link.** On iPhone it's Apple's own Paste button, so there's no "Allow Paste" prompt.
- **Store registries.** An item whose link counts toward the owner's Amazon, Target or other store registry says so: "Amazon registry" in the list, and the same notices as the website in the editor, including a warning for a plain store link where the owner has a registry. The linked stores come from the registry's settings. An Open button by the link opens the page.
- **Catches duplicates.** A link already on the registry, matched on the store's product ID the same way as the website and extension, gets a warning first.
- **Registries.** Every registry you own or help manage, with the website's notices: gifts this week, follow requests, and the prompt to put a list on your profile. On a list: items (including ones placed from your other lists), gift funds, gift activity, the Suggestions Inbox, the baby checklist, Store perks, linked events and the plain store links notice. Add, edit and remove items, with photo upload and estimated sales tax. Long-press an item on iPhone for quick actions.
- **List settings.** Photo, details, who can open it and a new link, "Hide what's been reserved from me", a child's gift profile, sharing with groups, categories, location, payment methods, shipping address, store registries, managers and invite links, and deleting the list.
- **Saved.** Every item on your lists in one place, which lists each is on, and putting items on more lists or taking them off. Gift ideas for other people, which only you can see. A product shared from another app can go to a gift idea instead of a list.
- **Events.** Start something new (a list, an event, or both), the event form, and an event's page: invitation picture, gifts, guests and RSVPs, invitations and reminders, gift exchanges, sign-up sheets, messages to guests and co-hosts. Groups of guests, with their yearly gift exchange.
- **Following.** Find people by name or email, invite them, see birthdays coming up and the lists of people who approved your follow.
- **Account.** Your profile and which lists show on it, your gift profile, follow requests, followers, blocked people, birthday emails, and deleting the account (as Apple requires).
- **Fast.** What you last saw is cached on the phone (SQLite), so the app opens straight onto it and refreshes in the background. Most list changes show at once and roll back if they fail.
- **Look around first.** The sign-in screen offers the website's demo registry, kept in memory. Nothing in the demo is saved. Saved, Events and Following need an account.
- Light and dark mode, Regibee's colors and fonts, SF Symbols on iPhone and Material Symbols on Android, native tabs and sheets, and haptics.

Other people's registries, profiles and invitations open on the website, as guests see them.

## How it fits together

- It signs in to the same Supabase project as the website, with email and password, and only has the public anon key. The access rules (RLS) apply exactly as on the website. See "Keys and access rules" in the root [CLAUDE.md](../CLAUDE.md).
- Most screens run the website's own code on the website's server, through `src/lib/api.ts`: `loadPage("listPage", id)` gets what the website's list page loads, and `runAction("registry.updateRegistry", …)` runs the website's server action. The app sends its access token, and the server acts as that user. So the app follows the website's rules, sends the website's emails and counts against the same email limits. See "Mobile app" in the root CLAUDE.md for how the routes work. This needs the website (`EXPO_PUBLIC_SITE_URL`, regibee.com by default) to have the `/api/app` routes deployed.
- Reads and changes are in `src/lib/*-data.ts`, one file per area. A few things still go straight to the database as the user: "Most wanted", cancelling a gift, gift ideas, and photo uploads to storage.
- Deleting the account needs the service-role key, so `src/lib/account.ts` calls the website's `/api/account` with the session's access token. The confirmation's wording comes from `src/lib/account-deletion-summary.ts`, shared with the website.
- Rules and wording the website keeps in `src/lib/` (store links, gift holds, events, sign-ups, the checklist, the loaders' types and more) come straight from the website, through the `@shared/*` path. `metro.config.js` lets Metro read that folder. A shared file may only import other shared files, with relative paths.
- The product reader is built from the extension's source into `src/generated/product-reader.json` by `npm run product-reader`. Run it after changing `extension/src/product-reader.ts`. `npm run check` fails when it's out of date.
- Sharing uses [`expo-share-intent`](https://github.com/achorein/expo-share-intent). On iPhone its share extension opens the app (the extension has no screen of its own), and `src/app/+native-intent.ts` sends that link to the share screen. On Android the app is a share target for text, and comes to the front on whatever screen it was on. `ShareRouter` in `src/app/_layout.tsx` then opens the share screen, once for each share. The library only reads text labeled as plain text and reports anything else as an error, which `ShareRouter` shows instead of doing nothing. `plugins/with-share-extension-label.js` keeps the share sheet label "Regibee".

## Setup

You need Node 22 or later. In this folder:

```bash
npm install
cp .env.local.example .env.local
```

Fill in `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. It's the website's `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from `vercel env pull`). Like the website, the app uses the production database, so anything you do while signed in changes real data. Use the demo to try things.

To try it against a local copy instead, point `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` at local Supabase (`supabase status`), run the website locally against the same database, and set `EXPO_PUBLIC_SITE_URL` to it, such as `http://localhost:3000`. The iPhone simulator reaches your Mac at localhost. Delete `.env.local` when you're done, so a later run doesn't point at a database that's stopped.

## Run it

Sharing and the product reader need native code, so the app doesn't run in Expo Go. Build a development app once, then reload JavaScript changes instantly:

- **iPhone simulator:** install Xcode from the App Store, then `npm run ios`.
- **Android emulator:** install Android Studio, then `npm run android`.
- **A real phone, without Xcode:** build in Expo's cloud. See below.

`npm run web` opens a browser preview of the screens. It can't read other sites' pages or share, so use it for layout only.

### On a real phone

EAS builds the app in Expo's cloud and gives you a link to install it. The Expo project belongs to the account named as `owner` in `app.config.ts`, so your Expo account needs to be in that team. Run every `eas` command in this folder. From the repo root it can't find the project and offers to set up a new one.

The anon key is already in EAS for the development, preview and production builds. To change it, use `npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <key> --visibility plaintext --environment development --environment preview --environment production`.

- **Android:** `npx eas-cli@latest build --profile development --platform android`. Open the link on the phone and allow your browser to install apps.
- **iPhone:** this needs an active Apple Developer Program membership. A paid enrollment that's still pending won't do, so wait for Apple's welcome email. Register each phone once with `npx eas-cli@latest device:create`: open its link on the phone and install the profile. Then run `npx eas-cli@latest build --profile development --platform ios` and let EAS manage the certificates. After installing, turn on Developer Mode in Settings → Privacy & Security and restart the phone.

Then run `npx expo start` with the phone on the same Wi-Fi as your computer, and open Regibee: it lists your computer's server, or scan the QR code. A development build loads its JavaScript from your computer, so it reads your `.env.local`. Rebuild after adding native code or changing `app.config.ts`, which includes the Safari share reader.

## Updates

A preview build has the code built in, so it runs without a computer:

```bash
npx eas-cli@latest build --profile preview --platform android
```

Preview builds get changes over the air. When a merge to main changes the app, the **App update** workflow (`.github/workflows/mobile-update.yml`) publishes an update to the `preview` channel. The app checks each time it opens and uses a downloaded update from the next start.

**Account › This version** says which code the app is running: the newest pull request in it, the commit, and whether it's running an update or the version it was built with. **Check for updates** checks straight away, downloads a newer update, and offers **Restart now**. The section shows in builds on the `preview` channel (preview builds and the Play testing builds below) and while developing, not in the public store version. `scripts/build-info.js` reads the commit and pull request from git when a build or update is made.

An update can't change native code. Adding a package with native code, upgrading Expo, or changing a config plugin or the product reader (it runs in the iPhone share extension) needs a new build. The runtime version is a fingerprint of the native code, so an update only reaches builds that match it, and an older build keeps what it has. "You have the latest" means there's no newer update for that build. `fingerprint.config.js` leaves out the commit and pull request, so they don't count as a native change. To see whether a change needs a new build, compare this before and after:

```bash
npx expo-updates fingerprint:generate --platform android
```

To publish an update by hand, from this folder (it reads `EXPO_PUBLIC_SUPABASE_URL` from `.env.local`, since `eas.json`'s settings are for builds):

```bash
npx eas-cli@latest update --channel preview --environment preview --message "What changed"
```

**Once, to turn it on:**

- Add an Expo access token that can publish to the project as the repo secret `EXPO_TOKEN`. Until then the workflow publishes nothing and says why.
- Make a new preview build. Builds from before updates were set up can't get them.

## Android testers

Testers install Regibee from the Play Store, through Google Play's internal testing track, and Play updates it for them like any other app. The `testing` build profile puts these builds on the `preview` channel, so they also get each merge to main over the air once `EXPO_TOKEN` is set (see "Updates"), and show **Account › This version**.

**Once:**

1. Your Expo account needs to be in the team that owns the project (see "On a real phone").
2. In Play Console, create the app: Regibee, App, Free. A free app can't become paid later.
3. Make a Google service account key, so EAS can upload to Play: https://expo.fyi/creating-google-service-account. Give it to EAS with `npx eas-cli@latest credentials --platform android`, or when `eas submit` asks for it. EAS keeps it on Expo's servers. Never commit the key file.

**Each new build** (the first one, and after a change to native code):

```bash
npx eas-cli@latest build --platform android --profile testing --auto-submit
```

This builds a signed `.aab` in Expo's cloud and uploads it to the internal testing track (`submit.testing` in `eas.json`). Changes that aren't native need no new build: they arrive over the air.

- The first build offers to make an Android keystore. Say yes. EAS keeps it, and Google signs the copy people install with its own key (Play App Signing).
- The version code goes up by itself (`autoIncrement`, stored on EAS). Change `version` in `app.config.ts` when testers should see a new version number.
- Play keeps the app as a draft until the store listing and setup tasks in Play Console are done. Only a public release needs those.
- Don't promote a testing build to production: it would keep taking every merge to main. The public release needs a build from the `production` profile, on the `production` channel.

**Adding testers:** in Play Console, open Testing › Internal testing › Testers, make an email list of each tester's Google account, and copy the join link. A tester opens the link on their Android phone, taps "Become a tester", then installs Regibee from Play. Internal testing takes up to 100 testers, with no review by Google.

## Checks

```bash
npm run typecheck
npm run lint
npm run check   # product reader up to date, types, and a full iOS and Android bundle
npx expo-doctor
```

The root `tsconfig.json` leaves out `mobile/`, so the website's checks don't read the app.

## Before the stores

The privacy policy URL for both store listings is https://www.regibee.com/privacy. Its "The Regibee app" section says what the app reads and keeps on the phone, so update it when that changes. Apple's privacy questions and Google Play's data safety form should match it.

- **Store accounts.** The Google Play developer account is set up. iPhone still needs an Apple Developer account. The bundle id is `com.regibee.app` for both, set in `app.config.ts`. The first upload locks it, so change it before then if you want another.
- **Public release on Play.** A personal Play developer account needs a closed test, with at least 12 testers opted in for 14 days in a row, before Google allows a public release. Internal testing doesn't count. An organization account skips this.
- **Real phones.** Sharing from Amazon, Target, Walmart and Safari, and reading in the hidden web view, have only been checked in code and in a browser so far. Try each on an iPhone and an Android phone.
- **App group.** The iPhone share extension shares data with the app through `group.com.regibee.app`. EAS sets it up when it manages your credentials.

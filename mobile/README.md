# Regibee for iPhone and Android

The Regibee app, built with Expo (SDK 58) and React Native. It does what an account can do on the website. Guests don't need it: they keep using the registry and event links on the website.

## What it does

- **Share to Regibee from any app.** In the Amazon, Target or Walmart app, in Safari, Chrome or Instagram, tap Share and pick Regibee. The add form opens with the product's name, price and pictures filled in. It picks the registry you used last. Its "Add to" row lists your registries, then Gift ideas, which opens the gift idea form with the link instead. Someone with no registry can save it as a gift idea.
- **Reads products on the phone.** A page shared from Safari arrives already read: the share extension runs the Chrome extension's reader (`extension/src/product-reader.ts`) inside the page. A link shared from another app, or pasted, is opened in a hidden web view on the phone, and the same reader reads it. The page loads over the owner's own connection, so stores that block Regibee's server, Amazon above all, still work.
- **Paste a link.** On iPhone it's Apple's own Paste button, so there's no "Allow Paste" prompt.
- **Store registries.** An item whose link counts toward the owner's Amazon, Target or other store registry says so: "Amazon registry" in the list, and the same notices as the website in the editor, including a warning for a plain store link where the owner has a registry. The linked stores come from the registry's settings. An Open button by the link opens the page.
- **Catches duplicates.** A link already on the registry, matched on the store's product ID the same way as the website and extension, gets a warning first.
- **Registries.** Every registry you own or help manage, with the website's notices: gifts this week, follow requests, and the prompt to put a list on your profile. On a list: items (including ones placed from your other lists), gift funds, gift activity, the Suggestions Inbox, the baby checklist, Store perks, linked events and the plain store links notice. Add, edit and remove items, with a photo you take or choose, and estimated sales tax. Long-press an item on iPhone for quick actions.
- **List settings.** Photo, details, who can open it and a new link, "Hide what's been reserved from me", a child's gift profile, sharing with groups, categories, location, payment methods, shipping address, store registries, managers and invite links, and deleting the list.
- **Saved.** Every item on your lists in one place, which lists each is on, and putting items on more lists or taking them off. Gift ideas for other people, which only you can see. A product shared from another app can go to a gift idea instead of a list.
- **Events.** Start something new (a list, an event, or both), the event form with the invitation color, and an event's page: invitation picture, gifts, guests and RSVPs, invitations and reminders, gift exchanges, sign-up sheets, messages to guests and co-hosts. "Add to my calendar" opens the event's calendar file, and "Directions" opens the address in Apple Maps on iPhone and the maps app on Android. Groups of guests, with their yearly gift exchange. On the guest list and a group's page, **Add from contacts** opens the phone's contact picker and puts the person's name and email in the form, with a choice when they have more than one email.
- **Following.** Find people by name or email, invite them, see birthdays coming up and the lists of people who approved your follow. "Got a Regibee link?" opens a pasted link to a list, profile or invitation inside the app.
- **Account.** Your profile, its photo and which lists show on it, your gift profile, follow requests, followers, blocked people, birthday emails, and deleting the account (as Apple requires).
- **Camera.** Wherever you add a photo (an item, a list, an invitation, your profile), the app asks whether to take one or choose one from the library. The camera asks for permission the first time. The iPhone simulator has no camera, so there it says so instead of opening it.
- **Notifications.** A push when someone asks to follow you, replies to your event's invitation, or gives a gift on your list (marks it bought, sends the money for it, or chips in to a gift fund). A plain reservation doesn't notify the owner, the same as the emails, so a hold that runs out never spoils a surprise, and an owner who hides what's been reserved gets no gift pushes. Tapping one opens that list, event or the Follows screen. The app asks for permission once after sign-in. **Account › Notifications on this phone** turns them off. See "Push notifications" below.
- **Fast.** What you last saw is cached on the phone (SQLite), so the app opens straight onto it and refreshes in the background. Most list changes show at once and roll back if they fail.
- **Look around first.** The sign-in screen offers the website's demo registry, kept in memory. Nothing in the demo is saved. Saved, Events and Following need an account.
- Light and dark mode, Regibee's colors and fonts, SF Symbols on iPhone and Material Symbols on Android, native tabs and sheets, and haptics.

Other people's lists and event invitations have their own screens in the app, in light and dark mode. On someone else's list you reserve an item or mark it bought, and later say you bought it or release it, chip in to a gift fund, give the money for an item the owners bought (and undo it), suggest an item, or start a group gift. The app keeps your gifts on the phone so it knows they're yours. A group gift's own page is still the website's. Profiles, group gifts and invite links are the website's own pages, shown inside the app and signed in as you (`src/app/web.tsx`). So following someone from a profile or chipping in to a group gift works as it does for your account on the website. A link on such a page to a list or event you manage opens the app's own screen. A link to a store opens in the browser. A link such as `regibee://r/<slug>` opens the page in the app (`src/app/+native-intent.ts`). On Android, a link to one of those pages on `www.regibee.com`, from a text message, an email or another app, opens it in the app too, signed in or not (Android App Links). On iPhone they still open in the browser until there's an Apple Developer account.

**How Android App Links work.** `intentFilters` in `app.config.ts` claim the guest and follower paths on `www.regibee.com` (`APP_LINK_PATHS`). Android checks the claim against the website's `public/.well-known/assetlinks.json`, which names the app and the SHA-256 fingerprints of the keys it is signed with. That file also lets password managers match the app's logins to the website's. It needs two fingerprints:

- The upload key EAS signs builds with. It's there already. It covers preview and development builds installed straight from EAS.
- Google Play's app signing key. Play re-signs the copies testers install with it, so links from Play installs open the browser until it's added. Find it in Play Console › Test and release › App integrity › Play app signing, "App signing key certificate", SHA-256. Add it to the list. It's a website change only: no new app build.

To check what a phone decided, run `adb shell pm get-app-links com.regibee.app`. `verified` means links open the app.

## How it fits together

- It signs in to the same Supabase project as the website, with email and password, and only has the public anon key. The access rules (RLS) apply exactly as on the website. See "Keys and access rules" in the root [CLAUDE.md](../CLAUDE.md).
- Most screens run the website's own code on the website's server, through `src/lib/api.ts`: `loadPage("listPage", id)` gets what the website's list page loads, and `runAction("registry.updateRegistry", …)` runs the website's server action. The app sends its access token, and the server acts as that user. So the app follows the website's rules, sends the website's emails and counts against the same email limits. See "Mobile app" in the root CLAUDE.md for how the routes work. This needs the website (`EXPO_PUBLIC_SITE_URL`, regibee.com by default) to have the `/api/app` routes deployed.
- Reads and changes are in `src/lib/*-data.ts`, one file per area. A few things still go straight to the database as the user: "Most wanted", cancelling a gift, gift ideas, and photo uploads to storage.
- An event's invitation (`src/app/e/[slug].tsx`) and someone else's list (`src/app/r/[slug].tsx`) are native screens for a signed-in account. A gift link on an invitation (`/e/<event>/gifts?g=<token>&to=<list>`) opens the list's screen with the event and token, so a gift is matched to the guest's RSVP. The gifts given from the list screen (purchase ids, and amounts given to gift funds) are kept on the phone, per account (`src/lib/my-gifts.ts`), in place of the website's `regibee_my_gifts` cookie. The two share item gifts both ways: opening the web view hands the phone's gifts to the website, and gifts given on a page in the web view come back to the phone (see "Mobile app" in the root CLAUDE.md). Profiles, group gifts and invite links still open as website pages in the web view (`src/app/web.tsx`). `nativeRoute` in `src/lib/web.ts` decides which. The plan for moving the rest is in [docs/native-guest-screens.md](docs/native-guest-screens.md).
- The web view signs in through the website's `/api/app/open`, which saves the app's access token as the website's session cookie and goes on to the page. The web view sends the `x-regibee-app` header, and the route ignores requests without it, so a link from another site can't sign anyone in or out. It never gets the refresh token, so the page stays signed in for an hour at most, and the app sends a fresh token each time it opens one (`src/lib/web.ts`). The pages it may show are listed in `src/lib/in-app.ts` on the website.
- Deleting the account needs the service-role key, so `src/lib/account.ts` calls the website's `/api/account` with the session's access token. The confirmation's wording comes from `src/lib/account-deletion-summary.ts`, shared with the website.
- Rules and wording the website keeps in `src/lib/` (store links, gift holds, events, sign-ups, the checklist, the loaders' types and more) come straight from the website, through the `@shared/*` path. `metro.config.js` lets Metro read that folder. A shared file may only import other shared files, with relative paths.
- The product reader is built from the extension's source into `src/generated/product-reader.json` by `npm run product-reader`. Run it after changing `extension/src/product-reader.ts`. `npm run check` fails when it's out of date.
- A screen with a text field scrolls with `KeyboardScrollView` (`src/components/keyboard.tsx`), not `ScrollView`, so the field being typed in stays above the keyboard. A Save button under the form goes in `KeyboardFooter`, which rides on top of the keyboard. They come from [`react-native-keyboard-controller`](https://github.com/kirillzyusko/react-native-keyboard-controller), which Expo's [keyboard handling guide](https://docs.expo.dev/guides/keyboard-handling/) recommends. React Native's own `KeyboardAvoidingView` does nothing on Android, since the app draws edge to edge and Android no longer shrinks the screen for the keyboard.
- Sharing uses [`expo-share-intent`](https://github.com/achorein/expo-share-intent). On iPhone its share extension opens the app (the extension has no screen of its own), and `src/app/+native-intent.ts` sends that link to the share screen. On Android, shared text goes to a small activity with no screen, `ShareReceiverActivity` (`plugins/with-android-share-receiver.js`). It passes the share to the app in Regibee's own task. Some apps, Amazon among them, open the app they share to inside their own task, and if that were the app itself, a second copy of it would take over Expo Router's router and break navigation until a restart. The app comes to the front on whatever screen it was on. `ShareRouter` in `src/app/_layout.tsx` then opens the share screen, once for each share. A share without text, such as a file, can't be added. The library reports most of those as an error, which `ShareRouter` shows instead of doing nothing. `plugins/with-share-extension-label.js` keeps the iPhone share sheet label "Regibee".

## Analytics

- The app sends screen views and app opens to PostHog with `posthog-react-native` (`src/lib/analytics.ts`). What people create and give is counted on the website's server instead. See "Analytics" in the root CLAUDE.md for what may and may not be sent.
- It reads `EXPO_PUBLIC_POSTHOG_KEY` from the build's EAS environment. Set it with `npx eas-cli@latest env:create`: the production PostHog project's token in `production`, the second project's token in `preview` (preview and testing builds), and nothing in `development`. Without it, the app sends nothing.
- `posthog-react-native` brought native modules (`expo-localization`, `expo-file-system`), so it reaches phones in a new build, not an over-the-air update.

## Push notifications

- The app saves each phone's Expo push token in `push_tokens` (`supabase/migrations/20261125083353_push_tokens.sql`) through `register_push_token`, after sign-in and each time it starts signed in (`src/lib/notifications.ts`). Signing out deletes the row, and so does turning the switch off, which also remembers the choice on the phone.
- The website's server sends them with `sendPush` (`src/lib/push-server.ts`), through Expo's push service, next to the matching email: `notifyFollowRequest`, `notifyItemGiven`, `notifyItemCovered` and `notifyCashFundContribution` in `src/lib/email.ts`, and the RSVP action in `src/lib/actions/events.ts`. Each push carries an app path (`/events/<id>`, `/registry/<id>`, `/account/follows`), and `useOpenTappedNotification` opens it. A push to a token Expo says is gone deletes its row. Pushes don't count against the email limits.
- Gift pushes go to the people `getRegistryManagerEmails` picks, so an owner who hides what's been reserved gets none. Never put a gift idea in a push.
- An RSVP push goes to the event's owner even when "Email me when someone RSVPs" is off. That setting is only about the email.
- **iPhone** needs an Apple push key in EAS: once the Apple Developer account exists, `npx eas-cli@latest credentials --platform ios` sets one up. Until then iPhone builds get no token. The iOS simulator can get one with Xcode 14 or later.
- **Android** needs Firebase Cloud Messaging: make a Firebase project for `com.regibee.app`, put its `google-services.json` in this folder and set `android.googleServicesFile` in `app.config.ts`, and upload an FCM V1 service account key to EAS (https://docs.expo.dev/push-notifications/fcm-credentials/). Until then Android gets no token, and the app carries on without notifications.
- If "enhanced push security" is turned on for the Expo project, set `EXPO_ACCESS_TOKEN` in Vercel.

## Setup

You need Node 22 or later. In this folder:

```bash
npm install
cp .env.local.example .env.local
```

Fill in `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. It's the website's `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from `vercel env pull`). Like the website, the app uses the production database, so anything you do while signed in changes real data. Use the demo to try things.

To try it against a local copy instead, point `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` at local Supabase (`supabase status`), run the website locally against the same database, and set `EXPO_PUBLIC_SITE_URL` to it, such as `http://localhost:3000`. The iPhone simulator reaches your Mac at localhost. The Android emulator does too after `adb reverse tcp:3000 tcp:3000` and `adb reverse tcp:54321 tcp:54321` (use your ports), so the same `.env.local` works for both. Use that rather than `10.0.2.2`: the website's pages in the app's web view also call Supabase at the address the website was given. Delete `.env.local` when you're done, so a later run doesn't point at a database that's stopped.

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

The workflow runs when a merge changes `mobile/` or one of the website files the app imports through `@shared/*`, directly or through another shared file. Its `paths` name each of those files. `scripts/check-update-paths.mjs` fails when the list is missing one, or names a file the app no longer imports, and prints the lines to add or remove. `npm run check` runs it, and so does the **App update paths** check on pull requests. So when the app starts importing a new website file, add that file to the workflow's `paths` in the same pull request.

**Account › This version** says which code the app is running: the newest pull request in it, the commit, and whether it's running an update or the version it was built with. **Check for updates** checks straight away, downloads a newer update, and offers **Restart now**. The section shows in builds on the `preview` channel (preview builds and the Play testing builds below) and while developing, not in the public store version. `scripts/build-info.js` reads the commit and pull request from git when a build or update is made.

An update can't change native code. Adding a package with native code, upgrading Expo, or changing a config plugin needs a new build. The runtime version is a fingerprint of the native code, so an update only reaches builds that match it, and an older build keeps what it has. "You have the latest update for this build" means there's no newer update for that build. A newer build may still be waiting on Google Play: see "Newer builds on Google Play" below. For Android testers, the Android testing build workflow makes that new build (see "Android testers"). `fingerprint.config.js` leaves out the commit and pull request, and the product reader the iPhone share extension runs, so they don't count as a native change. An iPhone build keeps the reader it was built with for pages shared from Safari until the next native change; everywhere else the app uses its own copy, which updates over the air. To see whether a change needs a new build, compare this before and after:

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

**New builds start by themselves.** When a merge to main changes native code, the **Android testing build** workflow (`.github/workflows/mobile-build.yml`) starts a new testing build. It builds a signed `.aab` in Expo's cloud and uploads it to the internal testing track (`submit.testing` in `eas.json`), and Play then updates testers' phones. It runs `scripts/testing-build.mjs`, which compares the Android fingerprint with the testing builds on EAS and builds only when none has it, so most merges start nothing. A build that failed doesn't count, so the next merge that touches `mobile/` tries again. Changes that aren't native need no new build: they arrive over the air.

To check or start one by hand, from this folder:

```bash
node scripts/testing-build.mjs --dry-run
```

```bash
node scripts/testing-build.mjs
```

The first says whether a build is needed. The second starts one if it is. To build regardless, use `npx eas-cli@latest build --platform android --profile testing --auto-submit`. Each build counts toward EAS's monthly build limit.

If testers' phones say "You have the latest update for this build" but don't have a recent change, either a newer build is waiting on Play (the app says so, see below), or no build has the new native code's fingerprint: check that workflow's runs.

### Newer builds on Google Play

Play installs a new build by itself, but only when the phone is idle, often overnight. Until then the phone keeps the old build, and updates made after the new build don't reach it. So on Android the app asks Play whether it has a newer build, when it opens and when it comes back to the front (at most every 10 minutes). It uses Play's in-app updates API, through `expo-in-app-updates` (`src/lib/play-update.ts`).

- When Play has one, the Registries tab shows "A new version of Regibee is ready" with **Update** and **Not now**. Update opens Play's own update screen, which downloads the build, installs it and restarts the app. If that screen won't open, the app opens its Play Store page instead. Not now hides the banner until Play has a build newer than that one.
- **Account › This version** shows the build number, whether Play has a newer build, and a button to update or check again.
- This works in every build installed from Play, the public one included. A copy installed some other way, like a preview build from an EAS link, can't ask Play: the Account tab says so, and the banner never shows.
- Play can take a while after an upload before it offers the new build, so the banner may show some minutes after the build reaches the testing track.
- This check is only in builds made after it was added. An older build can't show it, so testers on one still need to update from the Play Store by hand once.
- iPhone has no such check. TestFlight and the App Store update the app there.

- The first build offers to make an Android keystore. Say yes. EAS keeps it, and Google signs the copy people install with its own key (Play App Signing).
- The version code goes up by itself (`autoIncrement`, stored on EAS). Change `version` in `app.config.ts` when testers should see a new version number.
- Play keeps the app as a draft until the store listing and setup tasks in Play Console are done. Only a public release needs those.
- Don't promote a testing build to production: it would keep taking every merge to main. The public release needs a build from the `production` profile, on the `production` channel.

**Adding testers:** in Play Console, open Testing › Internal testing › Testers, make an email list of each tester's Google account, and copy the join link. A tester opens the link on their Android phone, taps "Become a tester", then installs Regibee from Play. Internal testing takes up to 100 testers, with no review by Google.

## Checks

```bash
npm run typecheck
npm run lint
npm run check   # App update paths, product reader up to date, types, and a full iOS and Android bundle
npx expo-doctor
```

The root `tsconfig.json` leaves out `mobile/`, so the website's checks don't read the app.

## Before the stores

The privacy policy URL for both store listings is https://www.regibee.com/privacy. Its "The Regibee app" section says what the app reads and keeps on the phone, so update it when that changes. Apple's privacy questions and Google Play's data safety form should match it.

- **Store accounts.** The Google Play developer account is set up. iPhone still needs an Apple Developer account. The bundle id is `com.regibee.app` for both, set in `app.config.ts`. The first upload locks it, so change it before then if you want another.
- **Public release on Play.** A personal Play developer account needs a closed test, with at least 12 testers opted in for 14 days in a row, before Google allows a public release. Internal testing doesn't count. An organization account skips this.
- **Real phones.** On an Android phone, sharing from the Amazon and Target apps opens the add form, and a Target product filled in from the hidden web view (checked 19 Nov 2026 on the testing build, version code 3). Someone else's list and its gift sheet were checked on the Android 14 emulator against local Supabase on 26 Nov 2026: light and dark mode, the back button, the keyboard, reserving, the store and back, the reservation banner, releasing, and an invitation gift link opened from outside the app. Not yet tried on a phone: sharing from Walmart and Safari, whether an Amazon product fills in, and anything on an iPhone.
- **Notifications.** Push needs the Apple push key and Firebase set up (see "Push notifications"). Not yet tried on a real phone.
- **App group.** The iPhone share extension shares data with the app through `group.com.regibee.app`. EAS sets it up when it manages your credentials.

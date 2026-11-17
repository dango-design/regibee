# Running Regibee

These notes are for anyone changing or running the live app, people and Claude alike. The [README](README.md) covers local setup.

## Where each part runs

| Service | What it does | What to know |
| --- | --- | --- |
| GitHub `dango-design/regibee` | Code, pull requests, CI | CI reads the `CHROMATIC_PROJECT_TOKEN`, `EXPO_TOKEN`, `CWS_SERVICE_ACCOUNT_KEY`, `CWS_PUBLISHER_ID` and `CWS_ITEM_ID` repo secrets. |
| Vercel | Builds and hosts the site | `main` deploys to regibee.com and www.regibee.com. Every other branch gets a preview URL. Every deployment URL except regibee.com needs a Vercel login. |
| Supabase `regibee` (ref `ibfvmgpfwhhyrhnxaxig`) | Database and sign-in | This is the only database. Preview deploys and `vercel env pull` use it too, so anything you do on a preview or locally with those keys changes real data. Database changes are run by hand. See below. |
| Resend | Sends every email, from `notifications@regibee.com` | The site sends through Resend's API with `RESEND_API_KEY`. Supabase sends its account emails through Resend's SMTP server, with a second key kept in Supabase's settings. Both need the DNS records for regibee.com. |
| Porkbun | Registrar and DNS for regibee.com | The DNS records point the site at Vercel and verify the domain for Resend. |
| Expo (EAS) | Builds the phone app, uploads Android builds to Google Play, and sends preview builds over-the-air updates | The project and its id are in `mobile/app.config.ts`. It also holds the Android signing keystore and the Google service account key. Builds are run by hand. See "Updates" and "Android testers" in [mobile/README.md](mobile/README.md). |
| Google Play Console | The Android app's listing and testing tracks | Testers install from the internal testing track. `eas build --profile testing --auto-submit` uploads to it. |
| Chrome Web Store | The browser extension's listing. Chrome installs and updates the extension from it | One listing, private to testers for now. `.github/workflows/extension-publish.yml` sends each merge to main that changes the extension for review, with the `CWS_*` secrets. Google reviews every version, which usually takes a few days. See "Publishing" in [extension/README.md](extension/README.md). |
| Chromatic | Visual tests of the Storybook stories | The project is in the `dango-design` Chromatic account, on the free plan. Its id is in `chromatic.config.json`. |

Vercel holds these env vars for production, preview and development: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `NEXT_PUBLIC_SITE_URL`. Run `vercel env pull .env.local` to copy them to your machine.

## Database changes

- Changes live in `supabase/migrations`. Nothing runs them on deploy. Someone runs each new file by hand.
- Production has no migration history table, so the Supabase CLI can't tell which files have run. Look at the database before running a file.
- Make a new file with `supabase migration new <name>`. It names the file with the current time in UTC, like `20261110113500_<name>.sql`, so two branches working at once won't pick the same name. It needs no login or link. Don't pick a number by hand.
- The older files are numbered `001` to `017`. Two pairs share a number, `009` and `015`, from when each branch took the next number after the highest. Run files in name order: that order is right for both pairs, and timestamped files come after `017`.
- The `Migration names` check (`.github/workflows/migrations.yml`) fails a pull request that adds another numbered file or reuses a version. `npm run check:migrations` runs the same check locally.
- There's no staging database, so read a new file closely before running it on production. Use the SQL Editor in the Supabase dashboard, or the Supabase CLI (version 3 or later, `brew install supabase/tap/supabase`):

  ```bash
  supabase login
  supabase link --project-ref ibfvmgpfwhhyrhnxaxig
  supabase db query --remote -f supabase/migrations/<file>.sql
  ```

  `--remote` runs the file on the linked project, and the CLI asks you to confirm first. Without it, `db query` runs against a local database. The older `--linked` flag still works in CLI 3 but is deprecated and goes away in v4.

- If a migration takes away access that the live code still uses, deploy the code first and run the migration after. Run the other way round, and the live site breaks until the code is deployed. `009_restrict_registry_reads.sql` was one of these.
- A new table with foreign keys to two tables that already link to each other gives Supabase's API a second route between them. It then refuses any query that joins the two without naming the link (error `PGRST201`), and pages that use one show nothing. `20261112062733_item_placements.sql` did this to `registries` and `registry_items`, and the dashboard showed "No registries yet" until each join named its link, as in `registry_items!registry_items_registry_id_fkey(...)`. `exchange_exclusions` (in `20261111103947_event_hosts_lists_and_gift_exchanges.sql`) did the same to `events` and `event_guests`, and hosts' Events tab came back empty. The end-to-end tests passed with both in place. They now check that the dashboard lists an owner's registries and the Events tab lists a host's events, but a join on another page can still break unnoticed. Before running such a migration, name the link in every join between those tables, in the website and in `mobile/src/lib/data.ts`.
- To test access rules (RLS) on production without saving anything, put the test in a `DO` block. Set `local role` and `request.jwt.claims` inside it, run the queries, and end the block with `raise exception` so everything rolls back.

## Keys and access rules

- The anon key ships in the browser, so anyone can use it. The table access rules (RLS) are the only thing protecting data the anon key can reach.
- `SUPABASE_SERVICE_ROLE_KEY` skips every access rule. Use the service-role client only in server code, and filter by an id or slug the user is allowed to see. The public registry page (`src/app/r/[slug]/page.tsx`) works this way.

## List links

- A list is private, link-only or public (`src/lib/list-access.ts`). The database keeps this as `is_private` and `is_public`; both can't be set. New lists start link-only.
- A private list opens only for its owner and co-managers. `src/app/r/[slug]/page.tsx` shows everyone else the not-found page. The database takes a list off its events, groups and Secret Santa wish lists when it becomes private, refuses to add it back, and refuses guests' gifts on it (`20261115084541_private_lists.sql`). Any new place that shows a list to people who don't manage it must skip private lists.
- Anyone with a link-only or public list's link (`/r/<slug>`) can open it. The 12 random characters at the end of the slug are what keep a list to the people it was sent to. Make new slugs with `generateRegistrySlug` (`src/lib/registry-create.ts`), or `new_registry_slug` in the database, never with `Math.random`.
- A list's link can change: its managers can get a new one on its Settings page (`replaceRegistryLink`). Store a list's id, not its link, and build `/r/<slug>` when you show it. Only the server can change a slug; the database refuses a change from a signed-in session.
- Old links are kept in `registry_old_links`, only so guests' gift emails still work (`src/lib/list-links.ts`). Don't use them to send anyone else to the new link.

## Items on several lists

- An item's home list is `registry_items.registry_id`. `registry_item_placements` puts it on more of the same owner's lists, each with its own category. Gifts belong to the item, so they show on every list it's on.
- Only the server reads placements. To list a list's items, use `src/lib/list-items.ts`, not `registry_items` filtered by `registry_id`, or placed items go missing.
- Taking an item off its home list moves it to the next list it's on. Only an item on no other list is deleted. A database trigger does this for direct deletes too, so the phone app and the extension follow the same rule.
- Deleting an item or a gift fund deletes guests' gifts on it, with their names, emails and messages. Database triggers do this on every path, a list's deletion included (`20261116012811_delete_gifts_with_items.sql`). A group gift's reservation stays until its group gift goes, since the group gift page reads its status from it. So never delete and re-add an item to move or change it: its gifts go with the delete.
- An owner who hides what's been reserved on any list an item is on doesn't see that item's gifts on any of them (`itemsHiddenFromOwner`).

## Gift ideas

- A gift idea (`gift_ideas`) is something an owner might give someone else, like their mom, and the point is that she never finds out. Only the account that saved it can read it.
- Never show a gift idea, or that one exists, to anyone but its owner: not on a list, a profile, an event, in an email or to co-managers. Don't put gift ideas on a registry or give them a link.
- The table has access rules for the signed-in owner, so the website, the extension and the phone app can read and write it as that user. Prefer that over the service-role client. Checks and grouping are in `src/lib/gift-ideas.ts`, which has no imports.
- Wherever someone picks a list to add a product to, offer Gift ideas too, after their registries: the extension's "Add to" picker, the phone app's "Add to" row (`onChooseGiftIdea` in `mobile/src/components/item-editor.tsx`, which opens `mobile/src/app/idea.tsx` with the link), and the website's share page. Someone with no registry can still save a gift idea.

## Account levels

- Every account is basic unless its email address is in `star_emails`. Then it's star. Star is for people we know, like testers. Nobody can buy it, and the site never shows anyone their level. Keep it that way: a level people pay for would bring the app stores' in-app purchase rules into the phone app.
- Both levels can do everything. Star only gets higher limits on what costs money or reaches people who never signed up:
  - Emails to addresses someone typed in: invitations, reminders, messages to guests, change notices, name draws, co-host and list-manager invites, and asking someone to make a list. Each account has a daily allowance, and all basic accounts share another. The numbers are in `src/lib/account-levels.ts`.
  - Photo uploads: 50 for basic, 500 for star. The numbers are in `can_upload_photo` in `20261116074752_account_levels.sql`.
- A new feature that emails an address someone typed in must call `reserveEmails` (`src/lib/email-budget.ts`) before sending and `settleEmails` after. Emails to the account's own address, emails to guests who gave their own address, and the daily cron emails don't count.
- Add a tester in the Supabase SQL Editor. Never put their address in a migration or any other file, since the repo is public:

  ```sql
  insert into public.star_emails (email) values (lower('tester@example.com')) on conflict do nothing;
  ```

  `delete from public.star_emails where email = lower('…')` removes one. Either takes effect on the account's next send or upload.
- The phone app and the extension don't send emails or upload photos, so the levels don't change them.

## Visual tests (Chromatic)

- `.github/workflows/chromatic.yml` runs Chromatic on every push. It snapshots only the stories the commit affects.
- Builds on `main` accept their own changes (`autoAcceptChanges: main`). That keeps `main`'s baselines current, even when a PR merges before anyone accepted it.
- Still accept a PR's changes on its branch build before merging. Accepting records that someone reviewed them, and turns the PR's "UI Tests" check green. The Accept and merge button that follows the review page does both steps.
- On a branch build, accept only the changes that branch made.
- Merging before the branch's `chromatic` check finishes is fine. It can cost extra snapshots, but development speed matters more.
- The free plan includes 5,000 snapshots a month. When they run out, Chromatic pauses testing and review until the next month.
- Storybook can't render async server components. Put a page's markup in a plain component and write the story for that. The landing page works this way.

## End-to-end tests

- `e2e/` holds Playwright tests that use the website in a browser and check the emails that follow. [e2e/README.md](e2e/README.md) covers setup.
- They run against local Supabase in Docker (`npm run e2e:db`), never production. Every email, Supabase's own included, lands in local Supabase's Mailpit inbox at http://127.0.0.1:54324. Like production, local Supabase asks new accounts to confirm their email (`supabase/config.toml`).
- `EMAIL_TRANSPORT=mailpit` makes `src/lib/mailer.ts` send to Mailpit instead of Resend. Only the tests set it. Send every email through `src/lib/mailer.ts`, not Resend directly, so tests can catch it. Supabase's account emails are the one exception: local Supabase sends those to Mailpit itself.
- `.github/workflows/e2e.yml` runs them on pull requests that change `src/`, `e2e/`, `supabase/`, `package.json` or `next.config.ts`, and on `main`. The check is called **End-to-end tests**. It isn't required yet, so read its result before merging, and don't merge over a failure without knowing why.

## Account emails

- Supabase sends two emails itself: one to confirm a new account's email address, and one to reset a password. The website and the phone app both trigger them. Every other email goes through `src/lib/mailer.ts`.
- On production, Supabase sends them through Resend's SMTP server. The settings are under Authentication → Emails → SMTP Settings in the Supabase dashboard: host `smtp.resend.com`, port `465`, username `resend`, a Resend API key as the password, and sender `Regibee <notifications@regibee.com>`. Without them, Supabase uses its own sender, which only delivers to members of the Supabase team, about 2 emails an hour.
- With custom SMTP, Supabase sends at most 30 account emails an hour to start with. Raise it under Authentication → Rate Limits if sign-ups need more.
- The templates are in `src/lib/auth-email-templates.ts`, with stories under "Email Templates" in Storybook. `npm run auth-emails` writes them to `supabase/templates/`, which local Supabase reads. Their subjects are also in `supabase/config.toml`. `npm test` fails if any of those is out of date.
- Nothing deploys the templates to production. After changing one, paste its subject and the contents of its file into the matching template under Authentication → Emails in the Supabase dashboard: `confirmation.html` is "Confirm sign up" and `recovery.html` is "Reset password".
- Don't use `supabase config push` to do it. It sends whatever `supabase/config.toml` declares, and that file holds local settings such as `site_url`.

## Browser extension

- The Chrome extension lives in `extension/`. [extension/README.md](extension/README.md) covers building, loading and what it reads.
- It signs in with its own Supabase session, which `/extension/connect` creates. Its API is `src/app/api/extension/*`, and it runs as the signed-in user under the same access rules as the website.
- Store link rules and the pages it reads are in `src/lib/retailers.ts`, which the site and the extension share. Change a store there, not in the extension.
- The extension only works against a site that has its API routes deployed.
- People install it from the Chrome Web Store, which updates it for them. When a merge to main changes the extension, `.github/workflows/extension-publish.yml` sends a new version for review. It reaches people days after the website changes, and some keep an older version longer. So `/api/extension/*` and the Connect page must keep working with the version already out: add fields instead of renaming or removing them. See "Publishing" in [extension/README.md](extension/README.md).
- `npm run test:extension` runs the built extension in Playwright's Chromium on saved copies of real store pages, with Regibee's API stubbed. The pages hold the owner's real registries, so they stay outside the repo, in `~/.regibee/extension-test-pages`. Never commit them. GitHub Actions doesn't run these tests, since it has no pages.

## Mobile app

- The iPhone and Android app lives in `mobile/`. It's an Expo (React Native) app that does what an account can do on the website: lists, Saved, Events, Following and account settings. Guests keep using the website. [mobile/README.md](mobile/README.md) covers what it does, running it and what's left before the app stores.
- It signs in to the same Supabase project with the anon key, and most screens run the website's own code on the website's server, as the signed-in user:
  - `POST /api/app/data` runs a page loader from `src/lib/app-loaders.ts`, such as `loadListPage` (`src/lib/list-page.ts`). The website's page calls the same loader, so both show the same thing. When you change what a page loads, change its loader, not the page.
  - `POST /api/app/action` runs an exported server action from `src/lib/actions/*` by name (`registry.updateRegistry`). Server actions are already public endpoints that check who's asking, so this lets nobody do more than the website does. An argument written `{ "$form": {...} }` arrives as FormData.
  - Both take the app's access token as `Authorization: Bearer`, never cookies. While one runs, `createClient()` (`src/utils/supabase/server.ts`) acts as the app's user (`src/lib/app-request.ts`). Changing a loader's or action's arguments or result changes the app too, and older app builds keep calling the old shape until they update, so add fields instead of renaming or removing them.
  - The app still reads and writes a few things directly under RLS: an item's "Most wanted", cancelling a gift, gift ideas, and photo uploads to storage.
- Like the extension, the app only works against a site that has these routes deployed. `/api/account` (deleting the account) works the same way.
- The app says and does what the website does. Use the website's words for the same thing, and its rules for what's shown. Do something differently only where a phone app can clearly do it better, such as the share sheet, native menus or haptics. When both show the same thing, put the logic in a shared file and call it from both, as `ownerItemStatus` in `src/lib/gifts.ts` does for an item's gift status.
- It shares website files through the `@shared/*` path, such as `src/lib/gifts.ts`, `events.ts`, `retailers.ts`, `store-perks.ts`, `checklist-matching.ts`, `item-categories.ts` and the loaders' types (`*-page-types.ts`). A shared file may only import other shared files, with relative paths (`./occasions`), and nothing that runs only on a server. An `@/` import breaks the app's build.
- Its product reader is built from `extension/src/product-reader.ts`. After changing that file, run `npm run product-reader` in `mobile/`.
- Preview builds, and the testing builds Play's testers install, get over-the-air updates. When a merge to main changes the app, `.github/workflows/mobile-update.yml` publishes one to the `preview` channel, if the `EXPO_TOKEN` secret is set. The Account tab's "This version" says which pull request a preview build is running and has a Check for updates button. An update can't change native code: new native packages, an Expo upgrade, config plugins or the product reader need a new build. See "Updates" in [mobile/README.md](mobile/README.md).
- The root `tsconfig.json` leaves out `mobile/`. The app has its own checks.

## Privacy policy

- `/privacy` is the privacy policy. The App Store, Google Play and the Chrome Web Store link to it. Its text is in `src/components/privacy-policy.tsx`.
- When a change collects something new, sends data to a new service, keeps something new on a phone or in the browser, or changes what the extension reads, update that page in the same PR and change its effective date.

## Issues and follow-ups

- Track follow-up work as GitHub Issues on `dango-design/regibee` (`gh issue create`): anything a PR leaves out, or an idea for later. Don't leave it only in a chat summary or a review page. A PR that fixes an issue says "Fixes #N" in its description, so merging closes it.
- The repo is public. Anyone can read its issues, pull requests and commit messages. Keep out anything that might not be public:
  - registry, user, purchase and event ids, slugs and invite tokens
  - names, emails and anything else about owners, guests or other accounts
  - real data, such as gift counts or what a registry holds
  - preview and deployment URLs, and links into the Vercel, Supabase, Resend or Chromatic dashboards
  - keys, tokens and env values, even partial ones
  - screenshots of real pages, and text copied from them
- Describe the problem through the code and the pages instead. If you aren't sure something is public, leave it out.

## Before opening a pull request

- Run `npx tsc --noEmit` and `npm run build`.
- If you changed components or stories, also run `npm run build-storybook`.
- If you added a migration, also run `npm run check:migrations`.
- `npm test` runs the unit tests in `src/lib/*.test.ts` and `supabase/*.test.mts` with Node's own test runner, such as the gift exchange name draw and what autofill reads from a store's page (`src/lib/product-page.ts`). Run it if you changed anything in `src/lib/` or `supabase/`. The **Unit tests** check (`.github/workflows/unit-tests.yml`) runs it on pull requests that change `src/lib/` or `supabase/`.
- If you changed `src/lib/auth-email-templates.ts`, run `npm run auth-emails`, and copy any new subject into `supabase/config.toml`. After merging, update production's templates (see "Account emails").
- If you changed a flow the end-to-end tests cover, emails, `supabase/migrations` or `e2e/`, and Docker is running on this computer, run the test files that cover your change, such as `npm run test:e2e -- e2e/gift-funds.spec.ts`. Don't run the whole suite locally: the End-to-end tests check on the pull request runs every file. Without Docker, leave it all to that check.
- Other sessions on this computer use the same local Supabase and the tests' port, 3100. If a run says the port is already used, another session's tests are running. Wait for them to finish, and don't stop that server. After adding a migration, run `npm run e2e:db` first, but only once the port is free, because it empties the database those runs use.
- If you changed `extension/`, `src/lib/retailers.ts` or `src/lib/extension.ts`, also run `npm run extension:build` and `npm run test:extension`. The tests skip when this computer has no saved store pages. See "Tests" in [extension/README.md](extension/README.md).
- If you changed `mobile/`, `extension/src/product-reader.ts`, a file the app imports through `@shared/*`, or a loader or server action the app calls (see "Mobile app"), also run `npm run lint` and `npm run check` in `mobile/`.
- `npm run lint` fails right now. `eslint.config.mjs` imports `eslint-plugin-storybook`, which isn't in `package.json`.

## After opening a pull request

- When the PR's `chromatic`, `Vercel` and `End-to-end tests` checks finish (the last runs only on pull requests that change the site), publish a review page with the `pr-review-page` skill (`.claude/skills/pr-review-page`) and give the user the link. End that turn with an Accept and merge button. The skill says how to set it up and what to do when the user clicks it.

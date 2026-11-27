# Running Regibee

These notes are for anyone changing or running the live app, people and Claude alike. The [README](README.md) covers local setup.

## Where each part runs

| Service | What it does | What to know |
| --- | --- | --- |
| GitHub `dango-design/regibee` | Code, pull requests, CI | CI reads the `CHROMATIC_PROJECT_TOKEN`, `EXPO_TOKEN`, `CWS_SERVICE_ACCOUNT_KEY`, `CWS_PUBLISHER_ID` and `CWS_ITEM_ID` repo secrets. |
| Vercel | Builds and hosts the site | `main` deploys to regibee.com and www.regibee.com. Every other branch gets a preview URL. Every deployment URL except regibee.com needs a Vercel login. `vercel.json` runs the server code in `pdx1` (Portland), the Vercel region next to the database. A page makes several database queries in a row, so a server far from the database makes every page slow. If the Supabase project ever moves, change the region to match. |
| Supabase `regibee` (ref `ibfvmgpfwhhyrhnxaxig`) | Database and sign-in | This is the only database. Preview deploys and `vercel env pull` use it too, so anything you do on a preview or locally with those keys changes real data. Database changes are run by hand. See below. |
| Resend | Sends every email, from `notifications@regibee.com` | The site sends through Resend's API with `RESEND_API_KEY`. Supabase sends its account emails through Resend's SMTP server, with a second key kept in Supabase's settings. Both need the DNS records for regibee.com. |
| Porkbun | Registrar and DNS for regibee.com | The DNS records point the site at Vercel and verify the domain for Resend. |
| Expo (EAS) | Builds the phone app, uploads Android builds to Google Play, and sends preview builds over-the-air updates | The project and its id are in `mobile/app.config.ts`. It also holds the Android signing keystore and the Google service account key. The **Android testing build** workflow starts a new testing build and uploads it to Play when a merge to main changes native code. iPhone builds are run by hand. See "Updates" and "Android testers" in [mobile/README.md](mobile/README.md). |
| Google Play Console | The Android app's listing and testing tracks | Testers install from the internal testing track. `eas build --profile testing --auto-submit` uploads to it. |
| Chrome Web Store | The browser extension's listing. Chrome installs and updates the extension from it | One listing, private to testers for now. `.github/workflows/extension-publish.yml` sends each merge to main that changes the extension for review, with the `CWS_*` secrets. Google reviews every version, which usually takes a few days. See "Publishing" in [extension/README.md](extension/README.md). |
| PostHog (US Cloud) | Usage analytics: counts of what people do on the website, in the app and through the extension | Two projects: one for production, one for the app's preview and testing builds. Either Brian or Denise can manage it. See "Analytics" below. |
| Chromatic | Visual tests of the Storybook stories | The project is in the `dango-design` Chromatic account, on the free plan. Its id is in `chromatic.config.json`. |

Vercel holds these env vars for production, preview and development: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `NEXT_PUBLIC_SITE_URL`. Production alone also has `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` (see "Analytics"). Run `vercel env pull .env.local` to copy them to your machine.

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
- Every other migration adds something the new code uses, so run it before merging its PR. Merged first, the feature fails on regibee.com until someone runs it: `20261120220437_invite_followed_people.sql` wasn't run when its PR merged, and adding a guest from the people you follow failed. The review page (`.claude/skills/pr-review-page`) checks production for a PR's migrations, and its Accept and merge button runs one first when you ask.
- A new table with foreign keys to two tables that already link to each other gives Supabase's API a second route between them. It then refuses any query that joins the two without naming the link (error `PGRST201`), and pages that use one show nothing. `20261112062733_item_placements.sql` did this to `registries` and `registry_items`, and the dashboard showed "No registries yet" until each join named its link, as in `registry_items!registry_items_registry_id_fkey(...)`. `exchange_exclusions` (in `20261111103947_event_hosts_lists_and_gift_exchanges.sql`) did the same to `events` and `event_guests`, and hosts' Events tab came back empty. The end-to-end tests passed with both in place. They now check that the dashboard lists an owner's registries and the Events tab lists a host's events, but a join on another page can still break unnoticed. Before running such a migration, name the link in every join between those tables, in the website and in `mobile/src/lib/data.ts`.
- To test access rules (RLS) on production without saving anything, put the test in a `DO` block. Set `local role` and `request.jwt.claims` inside it, run the queries, and end the block with `raise exception` so everything rolls back.

## Keys and access rules

- The anon key ships in the browser, so anyone can use it. The table access rules (RLS) are the only thing protecting data the anon key can reach.
- `SUPABASE_SERVICE_ROLE_KEY` skips every access rule. Use the service-role client only in server code, and filter by an id or slug the user is allowed to see. The public registry page (`src/app/r/[slug]/page.tsx`) works this way.

## Support view

- `/support` lets the support team find any account or list and see it as its owner does, without being invited. The code is in `src/lib/support.ts`, `src/app/(protected)/support` and `src/components/support`. The tables are in `20261123064207_support_view.sql`.
- An account is on the support team when its confirmed email address is in `support_emails`. Add someone in the Supabase SQL Editor. Never put their address in a migration or any other file, since the repo is public:

  ```sql
  insert into public.support_emails (email) values (lower('person@example.com')) on conflict do nothing;
  ```

  `delete from public.support_emails where email = lower('…')` removes one. Either takes effect on their next page load.
- Everyone else gets the not-found page at `/support`. The account menu's Support link shows only to the team.
- The pages call `requireSupport` first, then read with the service-role client. There are no access rules (RLS) for the support team, on purpose: a support account's own session can read no more through the anon key, in the browser, the phone app or the extension, than anyone else's. Each support loader checks `getSupportViewer` again, and none of them are in `src/lib/app-loaders.ts`.
- A list's support page uses `loadListPageForSupport` (`src/lib/list-page.ts`), which builds the same data as the owner's manage page, as the owner sees it. When you change what the owner's page loads, the support page follows.
- The pages are read-only for now: no button on them changes anything, and server actions still refuse a support account that doesn't manage the list. To let the team change something later, add that one action on purpose, with its own `isSupportAccount` check and a row in `support_views`.
- Every account or list the team opens is recorded in `support_views`, and so is showing the gifts an owner hid from themselves. If the row can't be saved, the page fails instead of showing the data. Only people with access to the Supabase project can read it, in the SQL Editor; the migration has a sample query. Owners don't see it.
- The support pages show gift ideas and account levels, which the rest of the site shows only to the gift idea's owner, or to nobody.
- The privacy policy's security section says the support team can access the information in an account. Describe the team by its role ("our support team"), not by how many people are on it.

## List links

- A list is private, link-only or public (`src/lib/list-access.ts`). The database keeps this as `is_private` and `is_public`; both can't be set. New lists start link-only.
- Managers change it, and who sees the list on the profile, on the list's Settings page (`updateRegistry`) or in the Share panel on the list's page (`updateListSharing`). Both save through `sharingColumns`, so a new place that saves these must use it too. The panel warns before a list goes private or public (`accessChangeWarning`) and waits for a confirm.
- A private list opens only for its owner and co-managers. `src/app/r/[slug]/page.tsx` shows everyone else the not-found page. The database takes a list off its events, groups and Secret Santa wishlists when it becomes private, refuses to add it back, and refuses guests' gifts on it (`20261115084541_private_lists.sql`). Any new place that shows a list to people who don't manage it must skip private lists.
- Anyone with a link-only or public list's link (`/r/<slug>`) can open it. The 12 random characters at the end of the slug are what keep a list to the people it was sent to. Make new slugs with `generateRegistrySlug` (`src/lib/registry-create.ts`), or `new_registry_slug` in the database, never with `Math.random`.
- A list's link can change: its managers can get a new one on its Settings page (`replaceRegistryLink`). Store a list's id, not its link, and build `/r/<slug>` when you show it. Only the server can change a slug; the database refuses a change from a signed-in session.
- Old links are kept in `registry_old_links`, only so guests' gift emails still work (`src/lib/list-links.ts`). Don't use them to send anyone else to the new link.

## Lists on a profile

- Who can open a list and who sees it on its owner's profile are separate choices. The profile choice is nobody, friends, followers or everyone (`profileAudience` in `src/lib/list-access.ts`). It only decides who finds the list on the profile, on the Following page and in birthday reminders. Anyone with a link-only or public list's link can still open it, so say "on your profile" wherever the choice is shown.
- Friends are two accounts that follow each other, with both follows approved. Nothing stores it: work it out from `follows` (`profileViewer`, `mutualFollowIds`). Friends are followers too, so they see what followers see.
- The database keeps the choice as `listed_on_profile` and `profile_audience` (`20261124085210_profile_audience.sql`). A null `profile_audience` means what a listed list showed to before the choice existed: everyone for a public list, followers for a link-only one. Older phone app builds only send `listedOnProfile`, so keep reading it.
- Only a public list can show to everyone. Otherwise the profile would hand a link-only list's link to people it was never sent to. `profileAudience` reads a saved "everyone" on a link-only list as followers.
- Any new place that shows someone's listed lists to other people must pass each list through `profileAudience` and `seesOnProfile`, not only filter on `listed_on_profile`.

## List headers

- The band at the top of a list's page has a color and a pattern the owner picks with the Header button on their list's page. The choice is saved in `registries.settings.header` as `{ color, pattern }`. A list with nothing saved keeps the light teal with dots.
- The colors, the patterns and which kinds of list each pattern suits are in `src/lib/list-headers.ts`, which the phone app shares. The icon patterns are Lucide drawings, tiled as SVG. On the website, `listHeaderVars` and `HEADER_BAND` (`src/lib/list-header-style.ts`) draw the band in both light and dark mode.
- `setListHeader` saves it, and any manager can change it. The owner's page, the wishlist guest page and the phone app's list screen draw the band. A baby registry's guest page keeps its illustrated header until the owner picks a band.
- The phone app draws the chosen color, and dots only for the Dots pattern. It draws other patterns as a plain band for now.

## Gift profiles

- A person's gift profile (birthday, sizes, colors, likes, things to skip, notes) is in `profiles.gift_profile`. The rules are in `src/lib/gift-profile.ts`.
- The person chooses who sees each of three parts: the birthday, the sizes, and likes and dislikes (colors, likes, things to skip and notes). Each is only them, friends, followers or everyone, saved in `gift_profile.audience`. A part they haven't chosen uses the old rule: the birthday shows to followers, the rest to friends.
- Pass a gift profile through `visibleGiftProfile` on the server before it reaches a page, so the hidden parts never leave the server. The birthday's choice also decides who gets it on the Following page and in reminder emails (`src/lib/birthdays-server.ts`).
- Older phone app builds save a gift profile without `audience`. `saveGiftProfile` keeps the saved choices then.
- A child's list keeps its own gift profile in its settings, with no choices: it shows to anyone who opens the list, and its birthday only to approved followers while the list is on the owner's profile.

## Deleting things

- Deleting a registry, an event, a group or an account that holds something asks the person to type a sentence first, such as "I want to delete this registry". A brand-new one, with nothing in it, only asks with two buttons. The sentences and what counts as holding something are in `src/lib/delete-confirmation.ts`: a registry with an item or a gift fund, an event with a guest, a group with a member, an account with a registry or an event.
- Use `ConfirmDeleteDialog` (`src/components/confirm-delete-dialog.tsx`) on the website and `ConfirmDelete` (`mobile/src/components/confirm-delete.tsx`) in the app. Don't use the browser's `confirm()` or a system alert for these.
- The typing only slows the person down. The server actions don't check it.

## Items on several lists

- An item's home list is `registry_items.registry_id`. `registry_item_placements` puts it on more of the same owner's lists, each with its own category. Gifts belong to the item, so they show on every list it's on.
- Only the server reads placements. To list a list's items, use `src/lib/list-items.ts`, not `registry_items` filtered by `registry_id`, or placed items go missing.
- Taking an item off its home list moves it to the next list it's on. Only an item on no other list is deleted. A database trigger does this for direct deletes too, so the phone app and the extension follow the same rule.
- Deleting an item or a gift fund deletes guests' gifts on it, with their names, emails and messages. Database triggers do this on every path, a list's deletion included (`20261116012811_delete_gifts_with_items.sql`). A group gift's reservation stays until its group gift goes, since the group gift page reads its status from it. So never delete and re-add an item to move or change it: its gifts go with the delete.
- An owner who hides what's been reserved on any list an item is on doesn't see that item's gifts on any of them (`itemsHiddenFromOwner`).

## Items a manager bought

- A list's manager can mark an item as bought by them (`is_parent_purchased`). That isn't a gift: nobody gave it to them. Guests can't reserve it.
- The manager then chooses, and can change at any time: guests can cover it by sending its price (`guests_can_cover`, on by default), guests can't, or it counts as gifted (`marked_gifted`, which also stops covers). `setBoughtItemChoice` saves it on the website and in the phone app. Unmarking the item as bought puts both back (`20261127093601_bought_item_choices.sql`).
- An item a manager bought counts as gifted only once guests cover every one, or the manager marks it as gifted. Until then it counts as "bought by you". `quantity_fulfilled` still equals `quantity_needed` for it, since nothing is left for guests to reserve, so never count gifts from `quantity_fulfilled` alone. Use `listProgress` and `itemProgress` in `src/lib/gifts.ts`, as the managers' progress bar, the dashboard cards and the guest page's count do.

## Baby checklist

- A baby registry has a checklist of what most new parents need (`src/lib/checklist-data.ts`). The website's page is `src/components/checklist-manager.tsx`, loaded by `src/lib/checklist-page.ts`. The phone app's screen is `mobile/src/app/registry/[id]/checklist.tsx`.
- Each item or gift fund counts for at most one entry. `checklist_entry` on `registry_items` and `cash_funds` saves the owner's choice: an entry's key, `none`, or null to match by its name. The rules and their tests are in `src/lib/checklist-matching.ts`, which the app shares.
- Never change an entry's `key`: saved choices point at it. To rename an entry, change its `name` and add the old one to `formerNames`. Add the words stores use for it to `aliases`.
- Adding from the checklist asks whether the owner has a specific one in mind. Yes opens the add item dialog with a link field. No adds the entry with no product, and guests choose one. Neither marks it Most wanted.

## Barcode numbers

- Items and gift ideas have a `gtin` column: the product's barcode number (its UPC or EAN), saved as 14 digits. Nothing shows it yet. It's there so Regibee can later match the same product across stores.
- The product readers fill it in when the page has one: `src/lib/product-page.ts` on the server, and `extension/src/product-reader.ts` in the extension and the phone app. The rules and their tests are in `src/lib/gtin.ts`. The extension's reader can't import, so it has its own copy: change both.
- A barcode belongs to the link it was read from. The dialogs send it only with that link, and the server actions clear a saved one when the link changes without a new one (`gtinChange`). Swapping a store link for its registry link keeps it, since that's the same product.

## Guessing categories

- Adding an item guesses its category on the website, in the extension and in the phone app, from its name and the store's own category (the page's breadcrumbs). The rules and their tests are in `src/lib/item-categories.ts`.
- The guess prefers a category the list already has. When none fits, it names a broad one, such as "Food & Drink", which shows as chosen and marked new. It's added to the list only when the item is saved, so a closed dialog leaves no empty category.
- "Sort into categories", next to a list's Other heading on the website and in the app, does the same for the items that have none (`src/lib/actions/categories.ts`), with an Undo.
- The product readers fill in `storeCategory`: `src/lib/product-page.ts` on the server, and `extension/src/product-reader.ts` in the extension and the app. The extension's reader can't import, so it has its own copy of `storeCategoryPath`: change both. Nothing saves the store's category.

## Filling in details later

- Some stores, Amazon above all, block Regibee's server. An item added without the extension, such as from an iPad, then keeps its link and a name guessed from it, with no photo or price.
- On a computer with the extension, the list's page offers to fill those in (`MissingDetailsNotice`). The extension reads each link in a background tab, and `saveReadDetails` (`src/lib/actions/item-details.ts`) saves what it found.
- The rules are in `src/lib/item-details.ts`: a read replaces the name and price when the store's are different, fills in a photo only when there's none, and never changes the price of an item the owner marked as bought.
- `item_detail_reads` keeps each item's last read and the value before each change, so `DetailReview` can show the new and old values and switch back. Only the server reads it, with the service-role client. An item is offered again only when its link changes.

## Checking prices

- On a computer with the extension, a list's page checks a few prices each time a manager opens it (`PriceCheck`, `src/components/price-check.tsx`). A few seconds after the page opens, the extension reads up to 5 items' links in background tabs, one at a time. A line on the page says so while it reads, with a Stop button.
- The rules and their tests are in `src/lib/item-details.ts` (`priceCheckDue`). An item is checked when its price hasn't been checked for 7 days: since its last read of the same link, or since it was added. The longest unchecked go first. Items the owner bought, items every one of which has been given, items missing a photo or price (the fill-in notice handles those) and items waiting for review are skipped.
- A check changes only the price, never the name or photo (`savePriceCheck`). The new price shows to guests straight away, and `DetailReview` shows it with the old one, headed "New prices".
- If the owner switches back to their own price, checks go on. A later check that finds the price they turned down changes nothing (`turnedDownBefore`). One that finds a different price offers it.
- Each replaced price on the review has "Don't check this price again" (`setPriceChecks`), on the website and in the app. It saves the item's link in `item_detail_reads.price_checks_off_url`, and checks stay off while the item has that link.
- The item's edit dialog shows the same setting as "Check the store's price weekly", on the website and in the app, so checks can be turned back on or off later. It shows once the extension has read the item's current link, or while checks are off (`priceCheckSetting`, sent as `priceChecks` on each item), and not for a bought item or while the link is being changed.
- Names change only on the one fill-in read of each link, never on a price check. So the review has no such box for names.
- Each check saves its time in `item_detail_reads`, even when the price was the same.
- The phone app has no extension, so it doesn't check prices. It shows the review and the checkbox.

## Gift ideas

- A gift idea (`gift_ideas`) is something an owner might give someone else, like their mom, and the point is that she never finds out. Only the account that saved it can read it through the API.
- Never show a gift idea, or that one exists, to anyone but its owner: not on a list, a profile, an event, in an email, to co-managers or in analytics. Don't put gift ideas on a registry or give them a link. The support pages are the one exception (see "Support view").
- The table has access rules for the signed-in owner, so the website, the extension and the phone app can read and write it as that user. Prefer that over the service-role client. Checks and grouping are in `src/lib/gift-ideas.ts`, which has no imports.
- Wherever someone picks a list to add a product to, offer Gift ideas too, after their registries: the extension's "Add to" picker, the phone app's "Add to" row (`onChooseGiftIdea` in `mobile/src/components/item-editor.tsx`, which opens `mobile/src/app/idea.tsx` with the link), and the website's share page. Someone with no registry can still save a gift idea.

## Account levels

- Every account is basic unless its email address is in `star_emails`. Then it's star. Star is for people we know, like testers. Nobody can buy it, and the site never shows anyone their level (only the support pages show it, to the support team). Keep it that way: a level people pay for would bring the app stores' in-app purchase rules into the phone app.
- Both levels can do everything. Star only gets higher limits on what costs money or reaches people who never signed up:
  - Emails to addresses someone typed in: invitations, reminders, messages to guests, change notices, name draws, co-host and list-manager invites, asking someone to make a list, and invites to follow. Each account has a daily allowance, and all basic accounts share another. The numbers are in `src/lib/account-levels.ts`.
  - Photo uploads: 50 for basic, 500 for star. The numbers are in `can_upload_photo` in `20261116074752_account_levels.sql`.
  - Emails a visitor sets off on a list, event or group gift: gift, RSVP and chip-in confirmations, owners' notices about them, suggestions, and the reminder and "reservation ended" emails that follow a reservation. Each page has a daily allowance, sized by its owner's level, and all basic owners' pages share another. Over it, the gift or RSVP still saves and only the email is skipped. The numbers are in `src/lib/account-levels.ts`, and the counting is in `20261117085323_visitor_email_limits.sql`.
- A new feature that emails an address someone typed in must call `reserveEmails` (`src/lib/email-budget.ts`) before sending and `settleEmails` after. Emails to the account's own address, emails to guests who gave their own address, and the daily cron emails don't count.
- A new email that goes out because a visitor did something on a list, event or group gift must pass `visitorEmailAllowance` (`src/lib/email-budget.ts`) to its sender as `allow`, as the gift and RSVP emails do.
- Add a tester in the Supabase SQL Editor. Never put their address in a migration or any other file, since the repo is public:

  ```sql
  insert into public.star_emails (email) values (lower('tester@example.com')) on conflict do nothing;
  ```

  `delete from public.star_emails where email = lower('…')` removes one. Either takes effect on the account's next send or upload.
- The phone app and the extension don't send emails or upload photos, so the levels don't change them.

## Words

- Spell it "wishlist", one word, or "Wishlist" at the start of a sentence. This goes for text people see, emails, code comments, docs and PR titles. Don't write "wish list". New code names use `Wishlist` too. Older names such as `GuestWishLists` and `WishListHero`, and the comments in migrations that have already run, still say it the old way.
- Each kind of list has its own name in `src/lib/occasions.ts`, such as "baby registry", "birthday wishlist" and "Christmas list". "Gift list" is the general word, used where the kind isn't known yet, as on the New page.

## Screen text

Keep text on screens short. People learn the app by using it, not by reading it. This covers the website, the phone app and the extension.

- A label or button names the thing. Don't add a line under it that says the same again ("Shipping address" doesn't need "Share your shipping address with gift givers so they know where to send gifts.").
- Don't explain what the app does when someone taps something. If it works as expected, they'll see.
- A hint is one short sentence, or nothing. A notice or empty state is one or two.
- Keep text that stops a surprise someone can't undo or would mind:
  - who can see something, when that isn't obvious ("Only you see gift ideas.")
  - what a delete or a link change breaks for other people
  - when an email goes out to someone
  - money: Regibee never handles it
- Say it once. If a page's title or a field's label already makes a point, the hint doesn't repeat it.
- Don't name the code, the demo's internals or how the server works.
- The privacy policy and the emails are the exceptions. They can be as long as they need to be.

## Clickable cards

- A card that opens one thing, like a registry, an event or an item to edit, opens it from a click anywhere on the card, not only from its title or button. Its other buttons keep doing their own thing.
- Use the `clickable-card`, `card-link` and `card-action` classes in `src/app/globals.css`, which explain how. `DashboardRegistryCard` is an example. Don't wrap a card that holds buttons in a link: HTML doesn't allow it.

## Loading screens

- A page that reads data on the server needs a `loading.tsx` next to it, with a skeleton from `src/components/page-skeletons.tsx`. Without one, a click on a link to it shows nothing until the server has finished the whole page. With one, the skeleton shows at once.
- The public pages (`/r`, `/e`, `/u`) have none on purpose. With a loading screen, a list that doesn't exist would answer 200 instead of 404.
- `NavigationProgress` (`src/components/navigation-progress.tsx`), in the root layout, shows a bar across the top of the window from a click on any link until the next page or its skeleton shows. It covers the pages with no loading screen.

## Dark mode

- The website follows the device's light or dark setting. It's CSS only: the `dark` variant in `src/app/globals.css` matches `prefers-color-scheme: dark`, so pages never flash light first. There's no switch on the site.
- The dark colors are in the `@variant dark` block at the end of `src/styles/theme.css`. They follow the phone app's `darkTheme` (`mobile/src/lib/theme.ts`). Change both together. The header above a website page in the app (`mobile/src/app/web.tsx`) takes the page's colors in each mode from `useSitePageColors` in the same file, so change those with the page's `bg-primary`, `text-primary` or `border-secondary`.
- Only the semantic tokens change in dark mode: `bg-primary`, `text-secondary`, `border-secondary`, `bg-brand-solid`, `text-brand-tertiary` and so on. Palette colors such as `text-brand-600`, `bg-mint-50` or `bg-sunshine-100` stay the same in both modes. So prefer a semantic token, and give a palette color its own `dark:` class, such as `bg-sunshine-50 dark:bg-sunshine-400/10`.
- On a brand button (`bg-brand-solid`), use `text-primary_on-brand`, not `text-white`. In dark mode the button is light teal and its text is dark.
- Text on a fill that stays light in both modes, like `bg-mint-500` or `bg-sunshine-400`, needs a palette color such as `text-gray-900`. `text-primary` would turn light.
- A host's event color has a dark pair (`darkFill`, `darkInk` in `src/lib/event-colors.ts`). On the website, use `hostColorVars`, `HOST_FILL` and `HOST_INK` from `src/lib/host-colors.ts`.
- Store photos keep a light tile in dark mode, since most have a white background.
- The phone app's web view gets the phone's setting. iOS passes it through. On Android, WebView reports it from the app's theme, which Expo sets to follow the phone.
- Storybook shows every story in light. A story with `parameters: { theme: "dark" }` shows in dark, and the toolbar's Theme menu shows any story in dark locally. A few page stories have a dark copy. Add one for a new page whose dark mode could break on its own, not for every story.
- Emails stay light. Email apps handle dark mode in their own ways.

## Dropdowns

- Never use a plain `<select>` on the website. The browser draws its menu itself, and it looks out of place. Use `SelectField` (`src/components/base/select/select-field.tsx`), which opens a styled list. In a price field, use `CurrencySelect`. For a small filter or sort pill, use `TightSelect`.
- In tests, Playwright's `selectOption` can't pick from these. Use `chooseOption` in `e2e/fixtures.ts`. In a story, click the field's button, then the option in `document.body`, since the list opens outside the story.
- The extension's popup has no React, so it has its own: `dropdown()` in `extension/src/popup/dropdown.ts`. Its button holds the chosen value in `data-value`. Its tests use `chooseOption` and `expectOptions` in `extension/test/extension.ts`.

## Visual tests (Chromatic)

- `.github/workflows/chromatic.yml` runs Chromatic on every push. It snapshots only the stories the commit affects: Chromatic follows imports from each changed file up to the stories that use it (`onlyChanged` in `chromatic.config.json`).
- Chromatic's accessibility tests are turned off on the project's Manage page, since 2026-11-24. They cost a second snapshot for every story. `@storybook/addon-a11y` is still installed, so the Accessibility panel works in local Storybook.
- Chromatic snapshots 244 of the 379 stories. The rest have `parameters: { chromatic: { disableSnapshot: true } }`: they still show in Storybook, but Chromatic takes no picture of them and doesn't run their `play` function. They are states close to one that is snapshotted, such as a second phone view or another occasion's wording.
- When you add stories, leave snapshots on for the ones that show a different layout or a state people often reach: the default, empty, an error, an open dialog, one phone view. Turn them off for the others. Every story file keeps at least one snapshot.
- `untraced` in `chromatic.config.json` lists files Chromatic leaves out of that check. A change to one of them re-captures nothing, and Chromatic doesn't follow imports through it. The list holds:
  - Code that only runs on the server: `src/lib/actions/**`, `src/lib/*-server.ts`, `src/lib/*-email.ts` and the server helpers named there. Components import server actions, and the actions import most of `src/lib`, so before this a change to one server file re-captured about half of all stories. A story can't run server code, so nothing is lost. Name a new server-only file `<name>-server.ts` so the list covers it.
  - `mobile/**`. A change to the phone app's `package.json` used to re-capture every story.
  - `public/**`. Chromatic can't tell which stories use an image, so a changed image used to re-capture every story. Now it re-captures none. After changing an image a story shows, look at that story yourself.
- `npx chromatic trace <changed files>` lists the story files a change would re-capture. It needs `npm run build-storybook -- --stats-json` first, and a `--untraced <glob>` for each entry in the list.
- A change to `src/app/globals.css`, `src/app/fonts.ts`, `.storybook/` or the root `package.json` still re-captures every snapshotted story.
- Builds on `main` accept their own changes (`autoAcceptChanges: main`). That keeps `main`'s baselines current, even when a PR merges before anyone accepted it.
- Still accept a PR's changes on its branch build before merging. Accepting records that someone reviewed them, and turns the PR's "UI Tests" check green. The Accept and merge button that follows the review page does both steps.
- On a branch build, accept only the changes that branch made.
- Merging before the branch's `chromatic` check finishes is fine. It can cost extra snapshots, but development speed matters more.
- The free plan includes 5,000 snapshots a month. When they run out, Chromatic pauses testing and review until the billing month resets. The Billing page in Chromatic shows the date.
- While it's paused, the `chromatic` job still passes and still publishes the Storybook, but it takes no snapshots. The build reads `PASSED` with 0 changes and has `isLimited: true`. That means nothing was tested, not that nothing changed. `UI Tests` and `UI Review` stay pending on every PR, so don't wait for them, and there is nothing to accept in Chromatic. The **Story screenshots** check takes Chromatic's place: wait for it, use its pictures to review, and accept its changes before merging (see "Story screenshots"). The review page does this on its own when Chromatic is paused.
- Changes merged while Chromatic is paused get no snapshot. When it resumes, `onlyChanged` only captures stories affected by later commits, so those stories may keep their old baselines until a later PR touches them, and that PR's build then shows the earlier changes too.
- Storybook can't render async server components. Put a page's markup in a plain component and write the story for that. The landing page works this way.

## Story screenshots

- `.github/workflows/story-screenshots.yml` takes a screenshot of every story with Playwright and compares it with its baseline, a PNG in `story-screenshots/baselines`. It does what Chromatic's UI Tests do, with no snapshot limit, so it keeps testing while Chromatic is paused. [story-screenshots/README.md](story-screenshots/README.md) covers how it works.
- The check is called **Story screenshots**. It runs on pull requests that change `src/`, `public/`, `.storybook/`, `story-screenshots/` or `package.json`. It isn't required yet, so read its result before merging.
- It fails when a story looks different, has no baseline yet, doesn't render, or its play function throws. Storybook only logs a play function's error and shows the story without it, so this is how the check notices a story that never reached the state it pictures. The run's summary page lists the stories, and its `story-screenshots-report` artifact shows each one before and after.
- To accept changes, run `npm run screenshots:accept` on the branch, then commit and push `story-screenshots/baselines`. It downloads the new pictures from the check's run for the commit you are on. Accept only after looking at the pictures. A new story needs this once.
- Baselines come only from GitHub's runner. Never commit a screenshot taken on a Mac: it draws text differently, so it would never match.
- It snapshots the same stories as Chromatic: a story with `chromatic: { disableSnapshot: true }` is skipped here too.
- A few stories look different from run to run. A story that differs gets two more tries on GitHub, and one that matches on a later try passes and is listed as unstable on the run's summary page. The ones that differ often are listed in `UNSTABLE` in `story-screenshots/stories.spec.ts` and aren't compared. If the check still fails on a small difference the branch didn't make, run it again before accepting.
- A merge that skips the check, or isn't accepted first, leaves `main` with old baselines. The next pull request that runs the check then shows those changes too, and accepting there fixes it.

## End-to-end tests

- `e2e/` holds Playwright tests that use the website in a browser and check the emails that follow. [e2e/README.md](e2e/README.md) covers setup.
- They run against local Supabase in Docker (`npm run e2e:db`), never production. Every email, Supabase's own included, lands in local Supabase's Mailpit inbox at http://127.0.0.1:54324. Like production, local Supabase asks new accounts to confirm their email (`supabase/config.toml`).
- `EMAIL_TRANSPORT=mailpit` makes `src/lib/mailer.ts` send to Mailpit instead of Resend. Only the tests set it. Send every email through `src/lib/mailer.ts`, not Resend directly, so tests can catch it. Supabase's account emails are the one exception: local Supabase sends those to Mailpit itself.
- `.github/workflows/e2e.yml` runs them on pull requests that change `src/`, `e2e/`, `supabase/`, `package.json` or `next.config.ts`, and on `main`. The check is called **End-to-end tests**. It isn't required yet, so read its result before merging, and don't merge over a failure without knowing why.

## Account emails

- Supabase sends two emails itself: one to confirm a new account's email address, and one to reset a password. The website and the phone app both trigger them. Every other email goes through `src/lib/mailer.ts`.
- On production, Supabase sends them through Resend's SMTP server. The settings are under Authentication → Emails → SMTP Settings in the Supabase dashboard: host `smtp.resend.com`, port `465`, username `resend`, a Resend API key as the password, and sender `Regibee <notifications@regibee.com>`. Without them, Supabase uses its own sender, which only delivers to members of the Supabase team, about 2 emails an hour.
- With custom SMTP, Supabase sends at most 30 account emails an hour to start with, for the whole project. Confirmations and password resets share the limit. Past it, sign-ups and password resets fail on the website and in the phone app until the hour is up. Raise it under Authentication → Rate Limits if sign-ups need more, once you've checked that Resend's plan can send that many.
- Supabase sends no warning, so the site does. A pg_cron job in Supabase calls `/api/cron/auth-emails` every 5 minutes. That route counts the account emails sent in the last hour and emails `ALERT_EMAIL` at two thirds of the limit (20 of 30) and again at the limit, at most once an hour for each (`src/lib/auth-email-alert.ts`). The count can run a little low, since a user's resent email replaces the time of the one before.
- The site can't read Supabase's limit. When you change it, set `AUTH_EMAIL_HOURLY_LIMIT` in Vercel to the same number and redeploy. Unset, it's 30.
- The job reads the site's address and `CRON_SECRET` from Supabase Vault, in secrets named `site_url` and `cron_secret`, and does nothing until both are there. `20261116074313_auth_email_alerts.sql` shows how to add them. If `CRON_SECRET` changes in Vercel, change `cron_secret` in Vault too, with `vault.update_secret`, or the checks get a 401.
- The templates are in `src/lib/auth-email-templates.ts`, with stories under "Email Templates" in Storybook. `npm run auth-emails` writes them to `supabase/templates/`, which local Supabase reads. Their subjects are also in `supabase/config.toml`. `npm test` fails if any of those is out of date.
- Nothing deploys the templates to production. After changing one, paste its subject and the contents of its file into the matching template under Authentication → Emails in the Supabase dashboard: `confirmation.html` is "Confirm sign up" and `recovery.html` is "Reset password".
- Don't use `supabase config push` to do it. It sends whatever `supabase/config.toml` declares, and that file holds local settings such as `site_url`.

## Browser extension

- The Chrome extension lives in `extension/`. [extension/README.md](extension/README.md) covers building, loading and what it reads.
- It signs in with its own Supabase session, which `/extension/connect` creates. Its API is `src/app/api/extension/*`, and it runs as the signed-in user under the same access rules as the website.
- Store link rules and the pages it reads are in `src/lib/retailers.ts`, which the site and the extension share. Change a store there, not in the extension.
- It also brings in an Elfster wishlist, when the owner clicks its button on one. It reads Elfster's own API from the page (`extension/src/elfster-reader.ts`) and adds the picked items through `/api/extension/import`. Don't add elfster.com, or any new site, to the manifest's `host_permissions`: Chrome turns the extension off for everyone until they accept a new site. See "Elfster" in [extension/README.md](extension/README.md).
- The extension only works against a site that has its API routes deployed.
- People install it from the Chrome Web Store, which updates it for them. When a merge to main changes the extension, `.github/workflows/extension-publish.yml` sends a new version for review. It reaches people days after the website changes, and some keep an older version longer. So `/api/extension/*` and the Connect page must keep working with the version already out: add fields instead of renaming or removing them. See "Publishing" in [extension/README.md](extension/README.md).
- `npm run test:extension` runs the built extension in Playwright's Chromium on saved copies of real store pages, with Regibee's API stubbed. The pages hold the owner's real registries, so they stay outside the repo, in `~/.regibee/extension-test-pages`. Never commit them. GitHub Actions doesn't run these tests, since it has no pages.

## Mobile app

- The iPhone and Android app lives in `mobile/`. It's an Expo (React Native) app that does what an account can do on the website: lists, Saved, Events, Following and account settings. Pages for guests and followers show inside it as website pages. [mobile/README.md](mobile/README.md) covers what it does, running it and what's left before the app stores.
- It signs in to the same Supabase project with the anon key, and most screens run the website's own code on the website's server, as the signed-in user:
  - `POST /api/app/data` runs a page loader from `src/lib/app-loaders.ts`, such as `loadListPage` (`src/lib/list-page.ts`). The website's page calls the same loader, so both show the same thing. When you change what a page loads, change its loader, not the page.
  - `POST /api/app/action` runs an exported server action from `src/lib/actions/*` by name (`registry.updateRegistry`). Server actions are already public endpoints that check who's asking, so this lets nobody do more than the website does. An argument written `{ "$form": {...} }` arrives as FormData.
  - Both take the app's access token as `Authorization: Bearer`, never cookies. While one runs, `createClient()` (`src/utils/supabase/server.ts`) acts as the app's user (`src/lib/app-request.ts`). Changing a loader's or action's arguments or result changes the app too, and older app builds keep calling the old shape until they update, so add fields instead of renaming or removing them.
  - The app still reads and writes a few things directly under RLS: an item's "Most wanted", cancelling a gift, gift ideas, and photo uploads to storage.
  - Signed out, the routes run only the guest calls in `src/lib/app-guest-calls.ts`: the invitation and someone else's list with no token, and `submitRsvp`, `reserveItem`, `confirmGift`, `releaseGift`, `contributeToCashFund`, `coverParentPurchasedItem` and `suggestItem` with a guest's anonymous session. The app makes that session from the phone the first time a signed-out person does one of them, as the website's gift dialog does for a guest, and keeps it apart from the account's session. Everything else still needs a signed-in account, starting a group gift included, as on the website. A guest call reads what the website's guest page shows anyone and sends the same emails, which count against the page's visitor allowance. When a native guest screen gets a new action, add it to that list only if the website's page lets a signed-out visitor do it, and keep `src/lib/app-guest-calls.test.ts` passing.
- An event's invitation (`/e/<slug>`) has its own screen in the app, `mobile/src/app/e/[slug].tsx`, at the website's own path. It loads `loadInvitationPage` (`src/lib/invitation-page.ts`), the same loader the website's page uses, and sends RSVPs and wishlists through the website's server actions. `nativeRoute` in `mobile/src/lib/web.ts` decides which website paths open a native screen. It works signed out too, through the guest calls above. The plan for the other pages is in `mobile/docs/native-guest-screens.md`.
- Someone else's list (`/r/<slug>`) has its own screen too, `mobile/src/app/r/[slug].tsx`. It loads `loadPublicList` (`src/lib/public-list-page.ts`), which the website's page also calls, and runs every guest action as a native sheet through the website's server actions: `registry.reserveItem`, `confirmGift` and `releaseGift` for gifts, `contributeToCashFund` for gift funds, `coverParentPurchasedItem` for an item the owners bought, `suggestItem`, and `groupGifts.startGroupGift`, which then opens the new group gift's page in the web view. The loader reads no cookies: the website's page passes in the guest's gifts from the `regibee_my_gifts` cookie and the event guest from its cookie, and the app passes the purchase ids and fund amounts it keeps on the phone (`mobile/src/lib/my-gifts.ts`, per account, or under the phone's own keys while signed out, moved to the account at sign-in) and, for a list opened from an invitation's gift link, the event and RSVP token. `reserveItem`, `contributeToCashFund`, `coverParentPurchasedItem` and `startGroupGift` take the same event and token as `eventSlug` and `guestToken`, so an app gift is matched to the guest's RSVP the way the cookie does it (`eventGuestFromToken` in `src/lib/events-server.ts`). Like the invitation, it works signed out. A list's item status (its tag, count and buttons) comes from `guestItemStatus` in `src/lib/gifts.ts`, for both.
- Profiles, group gifts and invite links have no screens in the app yet. The app shows the website's pages for them in its own web view (`mobile/src/app/web.tsx`), signed in as the app's user. `GET /api/app/open?next=<path>` does the signing in: it saves the app's access token as the website's session cookie, sets the `regibee_in_app` cookie and redirects to the page. It acts only on requests with the app's `x-regibee-app` header, which a link from another site can't add; any other visit just goes on to the page. While that cookie is set, `Nav` shows nothing, since the app has its own tabs. `src/lib/in-app.ts` lists the pages the web view may show and maps `/dashboard/...` links to the app's screens. When you add a page for guests or followers, add its path there.
- A guest's item gifts follow them between the list screen and the web view, both ways. The rules and their tests are in `src/lib/my-gifts-cookie.ts`.
  - App to web view: the web view's request to `/api/app/open` carries the app's purchase ids in the `x-regibee-gifts` header, never the address. The route adds each one that matches a live gift on its item to `regibee_my_gifts`, and marks the cookie with the account. Another account's gifts in the cookie are dropped, and opening the web view signed out removes them. A request without the header, from an older build, leaves the cookie alone.
  - Web view to app: a script the app runs in each page (`GIFTS_SCRIPT` in `mobile/src/app/web.tsx`) reads `regibee_my_gifts` from `document.cookie` whenever it changes and posts it to the app, which keeps the gifts it didn't have. So the cookie must stay readable in the page (`httpOnly: false`), and every way of saving a gift on the website reaches the app without the website telling it.
- Like the extension, the app only works against a site that has these routes deployed. `/api/account` (deleting the account) works the same way.
- The app says and does what the website does. Use the website's words for the same thing, and its rules for what's shown. Do something differently only where a phone app can clearly do it better, such as the share sheet, native menus or haptics. When both show the same thing, put the logic in a shared file and call it from both, as `ownerItemStatus` in `src/lib/gifts.ts` does for an item's gift status.
- It shares website files through the `@shared/*` path, such as `src/lib/gifts.ts`, `events.ts`, `retailers.ts`, `store-perks.ts`, `checklist-matching.ts`, `item-categories.ts` and the loaders' types (`*-page-types.ts`). A shared file may only import other shared files, with relative paths (`./occasions`), and nothing that runs only on a server. An `@/` import breaks the app's build.
- Its product reader is built from `extension/src/product-reader.ts`. After changing that file, run `npm run product-reader` in `mobile/`. A change to the reader doesn't need a new app build: `mobile/fingerprint.config.js` leaves it out of the native fingerprint.
- On Android, links to the guest and follower pages on `www.regibee.com` open the app (Android App Links). The paths are `APP_LINK_PATHS` in `mobile/app.config.ts`, and the website proves the app may open them with `public/.well-known/assetlinks.json`, which lists the app's signing key fingerprints. When you add a page for guests or followers, add its path to `WEB_VIEW_PATHS` in `src/lib/in-app.ts` and to `APP_LINK_PATHS`. See "How Android App Links work" in [mobile/README.md](mobile/README.md).
- Preview builds, and the testing builds Play's testers install, get over-the-air updates. When a merge to main changes the app, `.github/workflows/mobile-update.yml` publishes one to the `preview` channel, if the `EXPO_TOKEN` secret is set. Its `paths` name `mobile/` and each website file the app imports through `@shared/*`, directly or through another shared file. `mobile/scripts/check-update-paths.mjs` fails when one is missing, so add a newly shared file there in the same PR. `npm run check` in `mobile/` and the **App update paths** check on pull requests run it. The Account tab's "This version" says which pull request a preview build is running and has a Check for updates button. An update can't change native code: new native packages, an Expo upgrade, config plugins or the product reader need a new build. See "Updates" in [mobile/README.md](mobile/README.md).
- The app gets push notifications for a follow request, an RSVP to your event and a gift on your list. `sendPush` (`src/lib/push-server.ts`) sends them through Expo to the tokens in `push_tokens`, next to the matching email in `src/lib/email.ts`. A new push must follow the same rules as its email: no gift ideas, and nothing about a gift to an owner who hides what's been reserved. See "Push notifications" in [mobile/README.md](mobile/README.md).
- The root `tsconfig.json` leaves out `mobile/`. The app has its own checks.

## Analytics

- PostHog counts what people do, so we can see which features get used and where people stop. The plan and the choices behind it are in the "Plan: adding PostHog analytics to Regibee" doc.
- Nothing that names a person or opens a list may reach PostHog: no names, emails, messages, item names or links, list slugs, invite tokens, or anything about a gift idea, not even that one exists. Anyone with a PostHog login can read what's there, and unlike the support pages, nothing records who looked.
- The server sends most events. Server actions and API routes call `track` (`src/lib/analytics-server.ts`) after a save succeeds. The phone app runs the same server actions, so those count for both. `AnalyticsEvents` in that file lists every event and the only properties it may carry; add one there on purpose. Guests' events (`{ guest: true }`) go with a new random id and no person profile.
- The website's browser sends page views and a few clicks (`trackClick`, `src/lib/analytics-client.ts`). `src/instrumentation-client.ts` starts PostHog without cookies, autocapture or session recording, and never identifies the account. It sends through `/ingest` on our domain (rewrites in `next.config.ts`).
- The phone app sends screen views and app opens (`mobile/src/lib/analytics.ts`), and identifies the account by its user id only.
- Every address goes through `src/lib/analytics-urls.ts` first. It turns `/r/<slug>` into `/r/:slug`, hides tokens and ids, drops query strings and page titles, and lists the pages that send nothing (gift ideas, support). Any new page with a secret in its address needs a line in `SECRET_SEGMENTS` there, with a test.
- Deleting an account deletes its PostHog person and events (`deleteAnalyticsPerson`).
- Nothing is sent without a key. On Vercel, set `NEXT_PUBLIC_POSTHOG_KEY` (the production project's token, `phc_…`) for production only, so previews and local runs send nothing. Account deletion needs `POSTHOG_PERSONAL_API_KEY` (a personal API key with the `person:write` scope) and `POSTHOG_PROJECT_ID`. The app reads `EXPO_PUBLIC_POSTHOG_KEY` from its EAS environment: the production project's token in `production`, the second project's in `preview`, and none in `development`.
- Each PostHog project needs these settings, or the privacy policy is wrong: "Enable cookieless tracking" on (without it, PostHog drops the website's events), "Discard client IP data" on, and session recording, surveys and heatmaps off.
- A new event or property is a change to what we collect, so it goes with a privacy policy change too.

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
- If you changed components, stories or styles, the **Story screenshots** check will show what changed. You can't take its pictures locally (see "Story screenshots").
- `npm run lint` fails right now. `eslint.config.mjs` imports `eslint-plugin-storybook`, which isn't in `package.json`.

## After opening a pull request

- When the PR's `chromatic`, `Vercel`, `Story screenshots` and `End-to-end tests` checks finish (the last two run only on pull requests that change the site), publish a review page. While Chromatic is paused, don't wait for `chromatic`; the page uses the Story screenshots pictures instead. Publish it with the `pr-review-page` skill (`.claude/skills/pr-review-page`) and give the user the link. End that turn with an Accept and merge button. The skill says how to set it up and what to do when the user clicks it.

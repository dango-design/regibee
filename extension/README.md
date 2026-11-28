# Regibee browser extension

A Chrome extension that brings the items on an owner's store registries into Regibee, with each item's registry link, so gifts bought through Regibee still count toward the store registry. It also works in Edge, Brave and Arc.

## What it does

- **Reads store registry pages.** When the owner opens their registry on Amazon, Target, Walmart or Pottery Barn Kids, the extension reads the items on that page: name, price, picture, how many are wanted, and the registry link guests should use.
- **Skips what's already on Regibee.** It matches items on the store's product ID inside each link, so an item already on Regibee with a plain link counts as the same item.
- **Ask first, or automatic.** By default, the toolbar button shows how many new items a registry page has, and the popup lists them with checkboxes. In automatic mode it adds new items on its own and shows a notice with Undo. Automatic mode never re-adds an item the owner already saw, left out, removed or undid.
- **Brings in an Elfster wishlist.** On a wishlist on elfster.com, the toolbar button lists its items, with the ones that aren't on Regibee yet ticked. Each comes with its name, price, picture, how many are wanted, the owner's note, "most wanted", and the link to the shop's own page, never Elfster's tracking link. An item with no link is still added, and matches on its name. Items the owner marked as received on Elfster are left out. It always asks first: automatic mode is only for store registries, since the page could be someone else's wishlist. See "Elfster" below.
- **Adds one item from any product page.** On a product page at any shop, the popup opens an "Add to Regibee" form filled in from the page: name, price, pictures to choose from, quantity, registry, category, most wanted, open to used with a minimum condition, and a note. "+ New category" makes a category on the registry and picks it, as the site's add-item dialog does (`POST /api/extension/categories`, which shares `src/lib/list-categories.ts` with the site). A name the registry already has picks that category instead of making a second one, and a name typed but not yet added is made when the owner adds the item. "Mark as bought by parent" ("Mark as already bought" on other lists) saves the item as one the owner bought, so guests can cover its cost. On a list with a zip code it adds estimated sales tax to the price, as the site's dialog does (`POST /api/extension/tax`; the zip code stays on the server). It keeps the page's address exactly, so a product opened from a store registry keeps its registry link, and it says so. On a page that doesn't look like a product, the home screen offers "Add this page to Regibee".
- **Saves a gift idea for someone else.** The product form's "Add to" picker lists the owner's registries, then Gift ideas, like one more list. Picking Gift ideas saves the product as a private gift idea instead: who it's for (optional, with the names already used one click away), the name, price, picture and a note. Only the owner can see gift ideas (`POST /api/extension/ideas`). The popup remembers the last choice. Someone with no registry gets the form with only Gift ideas.
- **Reads a pasted store link for the site.** Amazon blocks the server's fetch of its product pages, so pasting an Amazon link into the add or edit item dialog on regibee.com used to fail. Now, at the stores the extension reads (Amazon, Target, Walmart and Pottery Barn Kids, short links like a.co included), the dialog asks the extension first. The extension opens the link in a background tab next to the owner's, reads the product with the same reader as the popup, closes the tab and sends back the name, price and pictures. Only regibee.com pages can ask, through the content script that runs there (`src/content/connect.ts`), and it opens only those stores' links, never a store registry page. A store page opened this way doesn't count as a visit, so automatic mode doesn't import from it. When the extension isn't installed, is older than 0.2.0 or can't read the page, the server fetches the link as before. The site side is `src/lib/fetch-product.ts`.
- **Three ways to open it.** The toolbar button, the **Add to Regibee** item in the right-click menu on any web page, or the shortcut Alt+Shift+R (owners can change it at `chrome://extensions/shortcuts`). Right-clicking a picture shows that picture first in the form. From the right-click menu the form opens even on a page that doesn't look like a product. The menu item opens the toolbar popup with `chrome.action.openPopup`; where that fails (Chrome before 127, some other Chromium browsers) it opens the popup in a small window instead.
- **Add now, registry link later.** A store registry link needs the item to be on the store registry first: Target's `itemLineNum` and Amazon's `coliid` name the item's place on it. So on a plain link at a store where the owner has a registry, the form says to add it to Regibee now, then add it to the store registry on the same page. The next time the owner opens that store registry, the extension matches items on the store's product ID and swaps the registry link in for the plain one. It does this in both modes without asking, since it only makes gifts count, and shows a notice on the page. It never replaces a registry link that's already there. Opening a product from the store registry and clicking the button does the same for that one item ("Use this registry link").
- **Reminds the owner.** The home screen and the registry's dashboard say how many items still have plain links at stores where the owner has a registry. The dashboard notice has "Don't remind me", saved per item in `settings.hidden_plain_link_items`.

The product form reads the page only after the owner clicks the toolbar button, uses the right-click menu item or presses the shortcut, using Chrome's `activeTab`, `scripting` and `contextMenus` permissions. None of them adds an install warning, and the extension still can't see other pages. Reading a pasted store link needs no new permission: the extension could already read those stores' pages to import registries. The reader is `src/product-reader.ts`. It uses the page's structured product data where there is some, and reads Amazon's, Target's and Walmart's product blocks for the price and pictures they leave out. On real pages it read the name, price and every product picture from an Amazon page opened from a registry (keeping `colid` and `coliid`), a Target page and a Walmart page.

Amazon has a second product page layout at `/clp/<ASIN>`, where Google Shopping links. It has no `#productTitle`, and its first heading is the Alexa panel's "Chat history", so the reader reads its `#scans-hero-faceout` block instead. It saves that page as the product's `/dp/<ASIN>` link, the only time it changes the address: a `/clp/` link is never a registry link, and its query string is Google's tracking. Picking another size there changes the product ID in the address, and the reader takes the chosen one.

## How it signs in

The extension never sees a password. Its first run opens `/extension/connect` on regibee.com. When the owner clicks Connect there, the server creates a separate Supabase session just for the extension, and the page hands it to the extension's content script. Requests then carry that session's access token and run under the same access rules (RLS) as the website. Disconnecting ends only the extension's session, not the website's.

The server side is in `src/app/api/extension/*`, `src/lib/extension-server.ts` and `src/app/extension/connect`. `PATCH /api/extension/items` swaps registry links in for plain ones. Code shared with the extension is in `src/lib/extension.ts` and `src/lib/retailers.ts`.

## Build and load it

People install the extension from the Chrome Web Store, which keeps it up to date for them (see "Publishing"). Building and loading it yourself is for working on it.

```bash
npm run extension:build
```

That builds `extension/dist` for https://www.regibee.com. To work against a local dev server (`npm run dev`) instead:

```bash
npm run extension:dev
```

This builds for http://localhost:3000 and rebuilds on changes. A local dev server uses the production database, so items you import locally are real.

To load it in Chrome: open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and choose `extension/dist`. After a rebuild, click the reload button on the extension's card.

The API routes and the Connect page have to be deployed before a build for regibee.com can connect.

## Tests

```bash
npm run test:extension
```

This builds `extension/dist` and runs it in Playwright's Chromium, headless, on saved copies of real store pages and one made-up product page. The first time, install that Chromium with `npx playwright install chromium`. The tests are in `extension/test/`.

- **Registry pages.** The reader finds every item the page links with a registry link, and each item's link, name, price, picture and quantity match what was recorded from that page. The toolbar button counts the items that aren't on Regibee yet.
- **Product pages.** The product reader reads the name, price and pictures, and keeps the address exactly, so a page opened from a store registry keeps its registry link. The popup's "Add to Regibee" form shows what it read.
- **Elfster.** `elfster.spec.ts` reads a made-up wishlist from made-up answers in the shape of Elfster's API, and adds the picked items from the popup. It runs on any computer.
- **Gift ideas.** `gift-idea.spec.ts` saves a product as a gift idea from the popup, with and without a registry. It uses a small made-up product page, not a saved one, so it runs on any computer.
- **Bought by parent.** `bought.spec.ts` marks a product as bought from the popup and checks the sales tax added to its price. It uses a made-up product page too.
- **Reading a link for the website.** `read-link.spec.ts` asks the extension to read a store link the way a Regibee page does. It checks that two Regibee tabs asking at once are both read, one after the other, and that a read whose tab closed while it waited opens nothing. It uses made-up pages too.

The tests never reach a store or Regibee. Each saved page is served at the address it was saved from, so the content scripts run on it as they do on the real site. No host name resolves, and every other request is refused. Calls to Regibee's API get made-up answers, so nothing touches the database.

### The saved pages

The pages hold the owner's real registries, so they stay on your computer, in `~/.regibee/extension-test-pages`, and never go in the repo. `REGIBEE_TEST_PAGES` points the tests at another folder. Without pages, the tests skip, which is why GitHub Actions doesn't run them. What the tests recorded from each page is in `expected/` in the same folder, and the files from failed tests are in `test-results/`. Both hold registry items too.

The first set, saved on November 8, 2026: the Amazon "Your registry" page (30 items) and a Walmart registry page (23 items), an Amazon and a Walmart product page opened from those registries, and a Target product page.

To save a page, or save it again after a store changes it:

1. Open it in Chrome, signed in if it needs that.
2. Open DevTools, paste all of [`test/save-page.js`](test/save-page.js) into the Console and press Enter. It downloads `<store>-<registry|product>.html`, named after the store and the kind of page.
3. Move the file to the pages folder, replacing the old one.
4. Run `npm run test:extension`. For a new page, the first run records what the extension reads from it in `expected/` and fails once, saying so. Check that file against the live page. For a page saved again, a failure shows what the extension now reads differently. When the differences are only the store's own changes, such as new prices or items, record them with `npm run test:extension -- --update-snapshots`.

## Stores

Everything store-specific is in `src/lib/retailers.ts`: link rules, product IDs, which pages list the owner's items (`registryPage`), and whether someone has checked that the extension can read them (`verified`). The manifest's site access comes from the same list, so a store added there is picked up on the next build.

| Store | Reads | Checked on a real registry |
| --- | --- | --- |
| Amazon | The owner's "Your registry" page | Yes: all 29 items, with links, names and pictures; prices for all but unavailable items |
| Walmart | The registry page | Yes: all 23 items; prices for all but out-of-stock items |
| Target | The owner's view, `gift-registry/my-registry` | No. The guest view has no item links, so the popup asks for the owner's view |
| Pottery Barn Kids | Registry pages | No |
| Babylist | Nothing yet | We don't know its registry link format |

The reader (`src/reader.ts`) works the same way for every store: it finds the registry item links by the store's rules, then reads each item from the smallest part of the page around its links that holds no other item. It doesn't depend on a store's class names, but a redesign can still break it. When it finds nothing, the popup says so and points to the copy-link steps.

## Elfster

Elfster's wishlist page (`/profile/<user id>/wish-lists/<wishlist id>`) shows each wish's name, price and picture, but the page has no link to the shop. Elfster's own API has it, so the reader (`src/elfster-reader.ts`) asks the API the page uses, from the page, as whoever is signed in there:

- `GET /v1/wishlists/<id>` for the wishlist's name.
- `GET /v1/wishlists/<id>/wishes?limit=100&offset=0` for the wishes, a page at a time.

Checked on a real wishlist of 26 wishes on 2026-11-25. Each wish has `sourceUrl`, the shop's page, and `url`, Elfster's tracking link to it. The reader uses only `sourceUrl`. It also reads `wishId`, `title`, `description`, `imageUrl` (skipped when `imageUrlIsDefault`), `quantity`, `price.amount` (only when `price.currency` is USD or missing, since Regibee's prices are in dollars), `isMostWanted`, `quantityReceived` and `quantityPurchased`.

### Keeping a list in sync

Some people keep their Elfster wishlist because their family uses Elfster. A gift bought on one site doesn't show on the other, so two people can buy the same thing. A Regibee list can be kept in sync with the owner's Elfster wishlist:

- The import screen has "Keep in sync with Elfster", ticked. When everything is already on the list, it's a button instead. Either one calls `POST /api/extension/import/sync` with every wish, received ones included.
- From then on, each time the owner opens the extension on that wishlist, `POST /api/extension/import/check` says the list is synced (`synced: true`), and the popup syncs again. It only syncs when the owner clicks the toolbar button on the wishlist: the extension still has no access to elfster.com.
- The server matches each wish to an item, by the wish it matched before, then by link, then by name (`planWishlistSync` in `src/lib/wishlist-import.ts`). It saves how many of each have been bought or received on Elfster (`given`) in `elfster_wishes`. The guest list page counts those as taken, and `reserve_registry_item` refuses them (`20261128070237_elfster_sync.sql`).
- Elfster never shows an owner what's been bought for them, so Regibee doesn't either. `given` goes only to the sync route, never to the check or import routes, and the sync answers only with the items whose wish left the wishlist. The popup never shows it. The list's managers never see it on any page, and the tables have no access rules for any API role.
- "Stop syncing" on the popup calls `POST /api/extension/import/stop`, which forgets the wishes, so guests can choose those items again.
- Checked on a test wishlist on 2026-11-28: after a second account marked a wish as bought, Elfster's API sent `quantityPurchased: 1` for it to the owner's own session, while Elfster's page showed the owner nothing. So a sync from the owner's session carries over what family members bought.

The extension has no access to elfster.com in its manifest, on purpose: a new site there would make Chrome turn the extension off for everyone until they accept the new permission. The popup runs the reader with `activeTab`, the same way it reads a product page, so it works only after the owner clicks the button on that tab.

The server side is `POST /api/extension/import/check`, `POST /api/extension/import`, and for syncing, `POST /api/extension/import/sync` and `/import/stop`. The checks are in `src/lib/wishlist-import.ts`. If Elfster changes its API, the popup says it couldn't read the wishlist, and the reader and its test need the new shape.

## Publishing

The extension has one listing on the Chrome Web Store. It's private while people test it, so only testers can install it, and it goes public later. Chrome updates every installed copy by itself. On a Mac or Windows PC, the store is the only way an extension updates itself. A copy loaded with Load unpacked never does.

### How a change reaches people

1. A merge to main that changes the extension runs `.github/workflows/extension-publish.yml`. It builds the extension for regibee.com, uploads it with `extension/publish.mjs` and sends it for review.
2. Google reviews every version, private ones too. Most reviews take a few days, and some take a few weeks. Reading store pages may make them slower.
3. When the review passes, the store publishes the new version, and Chrome installs it within a few hours. A tester who wants it sooner can open `chrome://extensions`, turn on Developer mode and click **Update**.

Only one version can wait for review. If a merge lands while an older version is still waiting, the workflow cancels the older one and sends the new one. The review starts over, so merges that keep landing before a review finishes keep putting the update off.

Versions the workflow sends publish as soon as they pass review. A version submitted by hand in the developer dashboard can be set to wait instead. After it passes review, the dashboard shows it as "Ready to publish", and the store refuses any new upload until someone clicks **Publish**. The workflow then fails and says so. Publish that version in the dashboard, then click **Run workflow** to send the newer one.

Merges that change only `extension/test/`, `extension/store-listing/` or this README don't publish anything. A change to `src/lib/extension.ts` or `src/lib/retailers.ts` does, since the extension is built from them.

### Versions

A build from main has four parts in its version: `EXTENSION_VERSION` from `src/manifest.ts`, then the workflow's run number, such as `0.2.0.57`. The popup's bottom bar and `chrome://extensions` show it with the pull request it came from, such as `0.2.0.57 (#212)`. Local builds show only `EXTENSION_VERSION`. Change `EXTENSION_VERSION` when the extension does something new.

The store only takes a higher version than the last one uploaded. To try a failed publish again, click **Run workflow** on the workflow's page in the Actions tab. **Re-run** keeps the same run number, so the store refuses it.

### The website changes first

The website goes live minutes after a merge. The extension reaches people days later, and some keep an older version longer. So:

- `/api/extension/*` and the Connect page must keep working with the version people have now. Add fields instead of renaming or removing them. Remove old behavior only once the store has had the new version for a while.
- When the site needs something only a newer extension can do, check the `features` the extension reports (`src/lib/extension.ts`), as `src/lib/fetch-product.ts` does, and fall back when it isn't there.

### Setting it up

This is done once, by a person, in Google's dashboards.

1. **Developer account.** Sign in to the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) with the Google account that should own the extension. It needs 2-step verification and a one-time $5 registration fee.
2. **The listing.** Run `npm run extension:build`, zip what's inside `extension/dist` (not the folder itself) and upload it as a new item. The API can't create an item, so this first upload is by hand. Then fill in the Store listing, Privacy, Distribution and Test instructions tabs. [`store-listing/README.md`](store-listing/README.md) has the text for each field and the images to upload. The Privacy tab's answers must match the "The browser extension" section of the privacy policy, at https://www.regibee.com/privacy. When what the extension reads or keeps changes, update both.

   Then submit it for review.
3. **A service account, so GitHub can publish.** In the [Google Cloud console](https://console.cloud.google.com), make a project and turn on the Chrome Web Store API. Create a service account in it, with no roles, and make a JSON key for it. Add the service account's email in the developer dashboard's account settings. An account can have only one.
4. **GitHub secrets.** Under the repo's Settings › Secrets and variables › Actions, add:
   - `CWS_SERVICE_ACCOUNT_KEY`: the whole JSON key file. Delete the file afterwards, and never commit it.
   - `CWS_PUBLISHER_ID`: the publisher ID, under Publisher › Settings in the developer dashboard.
   - `CWS_ITEM_ID`: the extension's 32-letter ID, on the item's Package tab.

   Until all three are set, the workflow warns and publishes nothing. Add them once the first version has passed review. Otherwise the next merge that changes the extension cancels that review and starts a new one.

### Adding testers

A private listing can only be installed by Google accounts you name. Anyone else who opens its link gets a page saying it doesn't exist. Either:

- Add testers' emails as trusted testers in the developer dashboard's account settings. The list covers every item the account publishes.
- Or add a Google Group you manage on the listing's Distribution page, and add testers to the group.

Send testers the listing's link. They open it in Chrome signed in with that Google account and click **Add to Chrome**. Brave and Arc install from the store too. Edge first asks to allow extensions from other stores. Testers also need a Regibee account to connect.

### Going public

- Check the Target owner view and a Pottery Barn Kids registry page, then mark them `verified`.
- Change Distribution to **Public** in the developer dashboard and publish that change there. The API can't publish a new visibility until it has been published once by hand.
- From then on, each merge reaches everyone, testers included. If testers should get changes before everyone else, add a second, private listing for them and point the workflow at it. Google requires its name to end in "BETA" and its description to say it's for testing.

A Safari version needs an Apple developer account and an Xcode wrapper.

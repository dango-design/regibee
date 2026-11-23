# Chrome Web Store listing

What to enter on each tab of the extension's item in the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole), and the images to upload. The answers follow the code and the privacy policy (`src/components/privacy-policy.tsx`). When the extension starts reading something new, or gets a new permission, update this file, the privacy policy and the dashboard together.

The images in `images/` show the real popup with a made-up account and made-up store pages. No real registry appears in them.

## Store listing tab

**Description:**

```
Regibee keeps your gift lists in one place. This extension connects Chrome to your Regibee account, so you can add things to your lists while you shop.

BRING IN YOUR STORE REGISTRIES
Open your registry on Amazon, Walmart, Target or Pottery Barn Kids, and Regibee shows the items that aren't on your Regibee list yet. Add them with one click, or let it add new ones for you. Each item keeps its store registry link, so gifts bought through Regibee still count toward your store registry.

ADD ANYTHING FROM ANY SHOP
On a product page, click the Regibee button, choose "Add to Regibee" in the right-click menu, or press Alt+Shift+R. The name, price and pictures are filled in for you.

SAVE PRIVATE GIFT IDEAS
Choose "Gift ideas" to save a product for someone else, like your mom or a friend. Only you can see gift ideas. The person they're for never does.

HELP ON REGIBEE.COM
Some stores block Regibee's server. When you paste a link from Amazon, Walmart, Target or Pottery Barn Kids while adding an item on regibee.com, the extension reads the product for the site instead.

You need a free Regibee account: https://www.regibee.com

PRIVACY
The extension reads a page only when you open your own store registry, or when you click its button, its menu item or its shortcut. It doesn't read any other pages or your browsing history. Full details: https://www.regibee.com/privacy
```

- **Category:** Shopping (under Lifestyle)
- **Language:** English (United States)
- **Store icon:** `images/store-icon-128.png`. Google's icon guidelines ask for 96×96 artwork with 16 px of clear space on each side.
- **Screenshots:** `images/1-store-registries.png`, `images/2-add-from-any-shop.png`, `images/3-private-gift-ideas.png`. The store takes 1280×800, as JPEG or 24-bit PNG with no alpha channel.
- **Small promo tile:** `images/small-promo-tile.png` (440×280)
- **Marquee promo tile, promo video:** none. They're optional.
- **Official URL:** none. It needs regibee.com verified in Google Search Console first.
- **Homepage URL:** `https://www.regibee.com`
- **Support URL:** `https://www.regibee.com/privacy#contact`
- **Mature content:** unchecked

## Privacy tab

**Single purpose:**

```
Adds products and store registry items to the user's Regibee gift lists while they shop.
```

**Permission reasons:**

- **storage:**
  ```
  Keeps the extension's Regibee sign-in, the user's list of registries, their settings (ask first or add automatically), the names they've saved gift ideas for, and which store registry items they've already seen, so it doesn't offer the same item twice.
  ```
- **activeTab:**
  ```
  When the user clicks the toolbar button, the "Add to Regibee" menu item or the keyboard shortcut, the extension reads the product on the current tab (name, price, pictures, barcode number) to fill in the add-item form. It doesn't read the tab at any other time.
  ```
- **scripting:**
  ```
  Runs the product reader in the current tab, only after the user clicks the toolbar button, the "Add to Regibee" menu item or the keyboard shortcut. It works together with activeTab.
  ```
- **contextMenus:**
  ```
  Adds an "Add to Regibee" item to the right-click menu. It opens the add-item form for the page, or for the picture the user right-clicked.
  ```
- **Host permissions:**
  ```
  amazon.com, walmart.com, target.com and potterybarnkids.com: when the user opens their own registry page at one of these stores, the extension reads the items on it (name, price, picture, quantity and registry link) so it can add them to the user's Regibee registry. It also reads a product link from these stores that the user pastes on regibee.com, because these stores block Regibee's server. It doesn't read other pages on these sites.
  regibee.com: the Connect page on regibee.com signs the extension in to the user's account, and the extension saves items through regibee.com's API.
  ```

**Remote code:** No. All code is in the package. The extension only fetches JSON data from regibee.com.

**Data usage.** Tick:

- **Personally identifiable information:** the account's name and email address, and the names of the people the user saves gift ideas for.
- **Authentication information:** the extension's own Regibee sign-in session.
- **Website content:** product names, prices, pictures and links read from store pages.

Leave the others unticked: health, financial and payment, personal communications, location, web history (it doesn't read browsing history) and user activity. Tick all three statements below them.

**Privacy policy URL:** `https://www.regibee.com/privacy`

## Distribution tab

- **Payments:** Free
- **Visibility:** Private while people test it. See "Adding testers" and "Going public" in [the extension's README](../README.md#publishing).
- **Regions:** all

## Test instructions tab

Google's reviewers can't do anything without a Regibee account, and they may reject an extension they can't test. Make a Regibee account just for reviewers, give it a registry with a few items, and enter its email and password on this tab, never in the repo. Then:

```
1. Install the extension. It opens regibee.com/extension/connect. Sign in with the test account above and click Connect.
2. Open any product page, for example on target.com or walmart.com, and click the Regibee toolbar button. The add-item form opens, filled in from the page. Click "Add to Regibee".
3. In the "Add to" picker, choose "Gift ideas" to save the product as a private gift idea instead.
4. Store registry import needs a registry at Amazon, Walmart, Target or Pottery Barn Kids, which the test account doesn't have. With one, opening the registry page shows the new items in the popup.
```

## Account tab

Set once for the developer account: the publisher name (Regibee), a contact email that Google verifies, and trader status. Use the same trader status as the Google Play developer account.

## Making the images again

After the popup changes, take new screenshots and make the images again:

```bash
npm run extension:build
npx playwright test --config extension/store-listing/playwright.config.ts
node extension/store-listing/compose.mjs
```

`screenshots.spec.ts` runs the built extension on made-up store pages, the same way the extension's tests do, and saves the popup at twice its size in your computer's temp folder. `compose.mjs` puts each popup picture on a 1280×800 image with its title and text, and draws the promo tile and the icon. The titles and text are in `compose.mjs`. Upload the new images in the dashboard. Nothing sends them automatically.

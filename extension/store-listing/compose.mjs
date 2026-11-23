// Makes the Chrome Web Store images in images/: three 1280×800 screenshots,
// the 440×280 small promo tile and the 128×128 store icon. Run
// screenshots.spec.ts first: each screenshot shows the popup picture it took.
// See README.md in this folder.
//
//   node extension/store-listing/compose.mjs

import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
// Where screenshots.spec.ts saves the popup pictures.
const RAW_DIR = path.join(os.tmpdir(), "regibee-store-listing");
const OUT_DIR = path.join(HERE, "images");

const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString("base64")}`;
function popupShot(name) {
  const file = path.join(RAW_DIR, `${name}.png`);
  if (!existsSync(file)) throw new Error(`${file} is missing. Run screenshots.spec.ts first (see README.md).`);
  return dataUri(file, "image/png");
}
const drawing = (name) => dataUri(path.join(REPO, "public/hero", `${name}.svg`), "image/svg+xml");
// The same drawing the extension shows (extension/build.mjs copies it in).
const logo = dataUri(path.join(REPO, "src/app/icon.svg"), "image/svg+xml");

// The site's colors, as in the popup (extension/src/popup/popup.css).
const BASE = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #231b18; overflow: hidden; }
`;

function screenshotPage({ shot, title, text, decor }) {
  return `<!doctype html><html><head><style>${BASE}
    body { width: 1280px; height: 800px; background: #f8f4ef; position: relative; }
    .circle { position: absolute; right: -120px; top: -60px; width: 760px; height: 920px; border-radius: 50%; background: #def1f4; }
    .copy { position: absolute; left: 96px; top: 0; bottom: 0; width: 520px; display: flex; flex-direction: column; justify-content: center; gap: 24px; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 26px; color: #004659; letter-spacing: -0.01em; }
    .brand img { height: 48px; }
    h1 { font-size: 56px; line-height: 1.08; font-weight: 700; color: #004659; letter-spacing: -0.02em; }
    p { font-size: 23px; line-height: 1.45; color: #4d4440; }
    .popup { position: absolute; right: 120px; top: 50px; height: 700px; border-radius: 22px; border: 1px solid #e3ddd6;
             box-shadow: 0 30px 70px rgba(0, 50, 64, 0.18), 0 4px 14px rgba(0, 50, 64, 0.08); background: #fff; }
    .decor { position: absolute; }
  </style></head><body>
    <div class="circle"></div>
    ${decor}
    <div class="copy">
      <div class="brand"><img src="${logo}" alt="">Regibee</div>
      <h1>${title}</h1>
      <p>${text}</p>
    </div>
    <img class="popup" src="${popupShot(shot)}" alt="">
  </body></html>`;
}

const SCREENSHOTS = [
  {
    file: "1-store-registries.png",
    shot: "registry",
    title: "Bring your store registries into Regibee",
    text: "Open your registry at Amazon, Walmart, Target or Pottery Barn Kids. Regibee finds the items that aren't on your list yet and keeps each one's registry link, so gifts still count at the store.",
    decor: `<img class="decor" src="${drawing("star-teal-left")}" style="left:40px;top:60px;width:56px">
            <img class="decor" src="${drawing("heart-red")}" style="left:620px;bottom:70px;width:44px">`,
  },
  {
    file: "2-add-from-any-shop.png",
    shot: "product",
    title: "Add anything, from any shop",
    text: "Click the Regibee button on a product page, use the right-click menu or press Alt+Shift+R. The name, price and pictures are filled in for you.",
    decor: `<img class="decor" src="${drawing("heart-yellow")}" style="left:44px;top:70px;width:48px">
            <img class="decor" src="${drawing("star-teal-right")}" style="left:610px;bottom:80px;width:56px">`,
  },
  {
    file: "3-private-gift-ideas.png",
    shot: "idea",
    title: "Save gift ideas for the people you love",
    text: "Keep a private list of ideas for your mom, a friend or a new baby. Only you can see gift ideas. The person they're for never does.",
    decor: `<img class="decor" src="${drawing("heart-red")}" style="left:46px;top:64px;width:44px">
            <img class="decor" src="${drawing("star-teal-left")}" style="left:612px;bottom:76px;width:56px">`,
  },
];

const PROMO_TILE = `<!doctype html><html><head><style>${BASE}
  body { width: 440px; height: 280px; background: #def1f4; display: flex; align-items: center; gap: 22px; padding: 0 30px; position: relative; }
  .logo { height: 150px; flex: none; }
  .name { font-size: 44px; font-weight: 700; color: #004659; letter-spacing: -0.02em; line-height: 1; }
  .tagline { margin-top: 12px; font-size: 19px; line-height: 1.3; color: #23464f; font-weight: 500; }
  .decor { position: absolute; }
</style></head><body>
  <img class="decor" src="${drawing("star-teal-right")}" style="right:22px;top:18px;width:30px">
  <img class="logo" src="${logo}" alt="">
  <div><div class="name">Regibee</div><div class="tagline">Add to your gift lists from any shop</div></div>
</body></html>`;

// Google's icon guidelines: 96×96 artwork with 16 px of clear space around it.
const STORE_ICON = `<!doctype html><html><head><style>${BASE}
  body { width: 128px; height: 128px; padding: 16px; background: transparent; }
  img { width: 96px; height: 96px; object-fit: contain; display: block; }
</style></head><body><img src="${logo}" alt=""></body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
async function render(html, width, height, file, { transparent = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: "load" });
  // An opaque page gives a 24-bit PNG with no alpha channel, as the store
  // asks for screenshots and promo tiles. Only the icon may be transparent.
  await page.screenshot({ path: path.join(OUT_DIR, file), type: "png", omitBackground: transparent });
  await page.close();
}

for (const screenshot of SCREENSHOTS) await render(screenshotPage(screenshot), 1280, 800, screenshot.file);
await render(PROMO_TILE, 440, 280, "small-promo-tile.png");
await render(STORE_ICON, 128, 128, "store-icon-128.png", { transparent: true });
await browser.close();
console.log(`Saved the store images in ${path.relative(process.cwd(), OUT_DIR)}`);

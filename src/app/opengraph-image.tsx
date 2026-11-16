import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The picture that shows when someone shares a Regibee link in Messenger,
// iMessage, Slack and other apps. Next writes it into the og:image and
// twitter:image tags. Every page uses it unless the page sets its own image,
// as an event page with a photo does. Without it, Messenger picked the first
// picture on the home page, a small sticker, and blew it up.
//
// It has no dynamic data, so Next renders it to a PNG once, at build time.
// It copies the home page hero: the panda, the stickers, the headline and the
// occasion chips.

export const alt = "Regibee: One Registry, Every Occasion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// From src/styles/theme.css.
const color = {
  white: "rgb(255 255 255)",
  text: "rgb(35 27 24)", // gray-900
  brand: "rgb(0 70 89)", // brand-600
  highlight: "rgb(249 235 128)", // sunshine-200
};

const chips = [
  { label: "Baby", background: "rgb(255 223 223)", text: "rgb(153 56 62)" }, // blush 100 / 700
  { label: "Birthday", background: "rgb(247 239 169)", text: "rgb(78 58 6)" }, // sunshine 100 / 900
  { label: "Christmas", background: "rgb(205 246 233)", text: "rgb(1 97 77)" }, // mint 100 / 800
  { label: "Any occasion", background: "rgb(222 241 244)", text: "rgb(0 56 71)" }, // brand 100 / 700
];

// An SVG from public/hero as a data URL. The files write each fill as
// var(--fill-0, #hex), which the image renderer can't read, so this keeps
// just the hex color.
async function sticker(name: string) {
  const svg = await readFile(join(process.cwd(), "public/hero", name), "utf8");
  const plain = svg.replace(/var\(--fill-0,\s*(#[0-9a-fA-F]{3,8})\)/g, "$1");
  return `data:image/svg+xml;base64,${Buffer.from(plain).toString("base64")}`;
}

export default async function OpenGraphImage() {
  const [font, panda, starLeft, starRight, heartRed, heartYellow] = await Promise.all([
    // Bricolage Grotesque is the site's heading font (src/app/fonts.ts). The
    // renderer needs the font file itself; next/font doesn't expose it.
    readFile(join(process.cwd(), "src/assets/fonts/BricolageGrotesque-Bold.ttf")),
    sticker("panda.svg"),
    sticker("star-teal-left.svg"),
    sticker("star-teal-right.svg"),
    sticker("heart-red.svg"),
    sticker("heart-yellow.svg"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: color.white,
          fontFamily: "Bricolage Grotesque",
          color: color.text,
        }}
      >
        {/* Stickers around the panda, placed like the hero's on a wide screen. */}
        <img src={starRight} width={64} height={65} style={{ position: "absolute", left: 772, top: 70, transform: "rotate(-8deg)" }} />
        <img src={heartRed} width={92} height={75} style={{ position: "absolute", right: 52, top: 52, transform: "rotate(12deg)" }} />
        <img src={heartYellow} width={66} height={54} style={{ position: "absolute", left: 790, bottom: 92, transform: "rotate(-12deg)" }} />
        <img src={starLeft} width={58} height={59} style={{ position: "absolute", right: 74, bottom: 78, transform: "rotate(10deg)" }} />
        <img
          src={panda}
          width={300}
          height={344}
          style={{ position: "absolute", left: 840, top: 143, transform: "rotate(6deg)" }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: 88,
            width: 780,
          }}
        >
          {/* The wordmark, as in the site's header logo. */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={panda} width={52} height={60} />
            <span style={{ fontSize: 44, color: color.brand, letterSpacing: -0.5 }}>Regibee</span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              // Each line only as wide as its text, so the marker stroke
              // stops where "Every Occasion" does.
              alignItems: "flex-start",
              marginTop: 40,
              fontSize: 92,
              lineHeight: 1.05,
              letterSpacing: -2.5,
            }}
          >
            <span>One Registry,</span>
            <div style={{ display: "flex", position: "relative", color: color.brand }}>
              {/* The yellow marker stroke under "Every Occasion". */}
              <div
                style={{
                  position: "absolute",
                  left: -4,
                  right: -4,
                  bottom: 8,
                  height: 30,
                  borderRadius: 999,
                  backgroundColor: color.highlight,
                }}
              />
              <span>Every Occasion</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 48 }}>
            {chips.map((chip) => (
              <span
                key={chip.label}
                style={{
                  fontSize: 26,
                  padding: "8px 22px",
                  borderRadius: 999,
                  backgroundColor: chip.background,
                  color: chip.text,
                }}
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Bricolage Grotesque", data: font, weight: 700, style: "normal" }],
    },
  );
}

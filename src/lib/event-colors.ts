// The colors a host picks for their event's invitation (events.theme_color).
// A host can pick any color, so this turns it into two that always read well:
// a fill, light enough for the site's text, and an ink, dark enough for icons
// and labels on that fill or on white. Dark mode gets its own pair: a dark
// fill for the site's light text, and a light ink.
//
// No imports, so the phone app can share it (@shared/event-colors) and its
// test runs on plain Node.

/** A few colors to start from, before the host's own. Any color works. */
export const THEME_COLOR_PRESETS: { label: string; color: string }[] = [
  { label: "Blush", color: "#f9b8b9" },
  { label: "Peach", color: "#ffd2b3" },
  { label: "Sunshine", color: "#f9eb80" },
  { label: "Mint", color: "#a0e4d4" },
  { label: "Sky", color: "#c3e3e8" },
  { label: "Lavender", color: "#d9c8f0" },
];

export interface ThemeColors {
  /** Background for a panel: the host's color, lightened when it's too dark for text. */
  fill: string;
  /** For icons and short labels, on the fill or on white: the host's color, darkened. */
  ink: string;
  /** The fill in dark mode: the host's color mixed into the dark page color. */
  darkFill: string;
  /** The ink in dark mode, on the dark fill or the dark page: the host's color, lightened. */
  darkInk: string;
}

const HEX = /^#[0-9a-f]{6}$/;

/** "#a1b2c3" from what a color input or a host sent, or null when it isn't a color. */
export function normalizeThemeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const color = value.trim().toLowerCase();
  return HEX.test(color) ? color : null;
}

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance, as WCAG defines it. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mixes a color toward another: amount 0 keeps it, 1 is the other. */
function mix(hex: string, toward: string, amount: number): string {
  const from = toRgb(hex);
  const to = toRgb(toward);
  return toHex(from.map((c, i) => c + (to[i] - c) * amount) as Rgb);
}

/**
 * The lightest the site's tertiary text (gray-600) can sit on at 4.5:1, with
 * a little room. A fill at least this light keeps every text color readable.
 */
const MIN_FILL_LUMINANCE = 0.62;

/** The page and panel color in dark mode (gray-950 in src/styles/theme.css). */
const DARK_PAGE = "#110b0a";

/**
 * The lightest a dark-mode fill can be for the site's dark-mode tertiary
 * text (gray-400) to sit on it at 4.5:1, with a little room.
 */
const MAX_DARK_FILL_LUMINANCE = 0.035;

/**
 * A mark, like a checkmark, drawn on a swatch of the color itself: the site's
 * dark text color, or white on a dark color, whichever stands out more.
 */
export function markOn(color: string): string {
  return contrast(color, "#ffffff") > contrast(color, "#231b18") ? "#ffffff" : "#231b18";
}

/** The fill and ink for a host's color. */
export function themeColors(color: string): ThemeColors {
  let fill = color;
  for (let step = 1; luminance(fill) < MIN_FILL_LUMINANCE && step <= 20; step++) {
    fill = mix(color, "#ffffff", step / 20);
  }
  let ink = color;
  for (let step = 1; (contrast(ink, fill) < 4.5 || contrast(ink, "#ffffff") < 4.5) && step <= 20; step++) {
    ink = mix(color, "#000000", step / 20);
  }
  let darkFill = mix(DARK_PAGE, color, 0.3);
  for (let step = 1; luminance(darkFill) > MAX_DARK_FILL_LUMINANCE && step <= 20; step++) {
    darkFill = mix(DARK_PAGE, color, 0.3 * (1 - step / 20));
  }
  let darkInk = color;
  for (
    let step = 1;
    (contrast(darkInk, darkFill) < 4.5 || contrast(darkInk, DARK_PAGE) < 4.5) && step <= 20;
    step++
  ) {
    darkInk = mix(color, "#ffffff", step / 20);
  }
  return { fill, ink, darkFill, darkInk };
}

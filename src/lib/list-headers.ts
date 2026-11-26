// The band at the top of a list's page: its color and the pattern drawn on
// it. The owner picks both on the list's page, and they're saved in
// `registries.settings.header` as `{ color, pattern }`. A list with nothing
// saved gets the light teal with dots that every list had before.
//
// The owner's page, the guest page and the phone app all draw the band from
// this file, so they match. No imports, so the phone app can share it
// (@shared/list-headers) and its test runs on plain Node.

/** Where the choice is kept in a registry's settings. */
export const HEADER_SETTING = "header";

export interface HeaderColorTones {
  /** The band itself. */
  bg: string;
  /** The pattern on the band: a little darker than the band, so it stays quiet behind the title. */
  pattern: string;
  /** Small labels on the band, such as "Wishlist · 4 items". */
  ink: string;
}

export interface HeaderColor {
  id: string;
  label: string;
  light: HeaderColorTones;
  dark: HeaderColorTones;
}

/**
 * The colors to pick from. Every band is light enough in light mode, and dark
 * enough in dark mode, for the site's normal text on top of it. Sky is the
 * one every list had before (bg-brand-primary with brand-200 dots).
 */
export const HEADER_COLORS: HeaderColor[] = [
  {
    id: "sky",
    label: "Sky",
    light: { bg: "#f0fafc", pattern: "#c3e3e8", ink: "#2e7387" },
    dark: { bg: "#0b2a33", pattern: "#1b4552", ink: "#639cad" },
  },
  {
    id: "mint",
    label: "Mint",
    light: { bg: "#eafbf5", pattern: "#a8e2d3", ink: "#1f7a5f" },
    dark: { bg: "#0b2a22", pattern: "#1c4a3d", ink: "#70dbbc" },
  },
  {
    id: "sunshine",
    label: "Sunshine",
    light: { bg: "#fefbe4", pattern: "#f1e5a6", ink: "#80620a" },
    dark: { bg: "#29240b", pattern: "#4a4117", ink: "#f2e27a" },
  },
  {
    id: "peach",
    label: "Peach",
    light: { bg: "#fff5ee", pattern: "#fcd3b8", ink: "#a4532a" },
    dark: { bg: "#2e1a0f", pattern: "#553321", ink: "#ffc39c" },
  },
  {
    id: "blush",
    label: "Blush",
    light: { bg: "#fff4f4", pattern: "#f7cbcc", ink: "#99383e" },
    dark: { bg: "#2e1416", pattern: "#542729", ink: "#f9b8b9" },
  },
  {
    id: "lavender",
    label: "Lavender",
    light: { bg: "#f6f2fd", pattern: "#dccef2", ink: "#6b4fa0" },
    dark: { bg: "#1e1630", pattern: "#3a2d57", ink: "#cdb8f0" },
  },
  {
    id: "sand",
    label: "Sand",
    light: { bg: "#f8f5f2", pattern: "#e4dbd3", ink: "#6e5d52" },
    dark: { bg: "#1d1714", pattern: "#3b312b", ink: "#d9cbc0" },
  },
];

/**
 * Line drawings the patterns are made of, from Lucide (ISC license), the icon
 * set the website already uses. Each is drawn on a 24 by 24 grid, in a
 * stroke the pattern colors.
 */
const ICONS = {
  "baby": "<path d='M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5'/><path d='M15 12h.01'/><path d='M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1'/><path d='M9 12h.01'/>",
  "milk": "<path d='M8 2h8'/><path d='M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2'/><path d='M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0'/>",
  "panda": "<path d='M11.25 17.25h1.5L12 18z'/><path d='m15 12 2 2'/><path d='M18 6.5a.5.5 0 0 0-.5-.5'/><path d='M20.69 9.67a4.5 4.5 0 1 0-7.04-5.5 8.35 8.35 0 0 0-3.3 0 4.5 4.5 0 1 0-7.04 5.5C2.49 11.2 2 12.88 2 14.5 2 19.47 6.48 22 12 22s10-2.53 10-7.5c0-1.62-.48-3.3-1.3-4.83'/><path d='M6 6.5a.495.495 0 0 1 .5-.5'/><path d='m9 12-2 2'/>",
  "rabbit": "<path d='M13 16a3 3 0 0 1 2.24 5'/><path d='M18 12h.01'/><path d='M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3'/><path d='M20 8.54V4a2 2 0 1 0-4 0v3'/><path d='M7.612 12.524a3 3 0 1 0-1.6 4.3'/>",
  "bird": "<path d='M16 7h.01'/><path d='M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20'/><path d='m20 7 2 .5-2 .5'/><path d='M10 18v3'/><path d='M14 17.75V21'/><path d='M7 18a6 6 0 0 0 3.84-10.61'/>",
  "footprints": "<path d='M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z'/><path d='M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z'/><path d='M16 17h4'/><path d='M4 13h4'/>",
  "moon": "<path d='M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401'/>",
  "cloud": "<path d='M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'/>",
  "star": "<path d='M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'/>",
  "sparkle": "<path d='M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z'/>",
  "heart": "<path d='M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5'/>",
  "cake": "<path d='M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8'/><path d='M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1'/><path d='M2 21h20'/><path d='M7 8v3'/><path d='M12 8v3'/><path d='M17 8v3'/><path d='M7 4h.01'/><path d='M12 4h.01'/><path d='M17 4h.01'/>",
  "gift": "<path d='M12 7v14'/><path d='M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8'/><path d='M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5'/><rect x='3' y='7' width='18' height='4' rx='1'/>",
  "balloon": "<path d='M12 16v1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v1'/><path d='M12 6a2 2 0 0 1 2 2'/><path d='M18 8c0 4-3.5 8-6 8s-6-4-6-8a6 6 0 0 1 12 0'/>",
  "snowflake": "<path d='m10 20-1.25-2.5L6 18'/><path d='M10 4 8.75 6.5 6 6'/><path d='m14 20 1.25-2.5L18 18'/><path d='m14 4 1.25 2.5L18 6'/><path d='m17 21-3-6h-4'/><path d='m17 3-3 6 1.5 3'/><path d='M2 12h6.5L10 9'/><path d='m20 10-1.5 2 1.5 2'/><path d='M22 12h-6.5L14 15'/><path d='m4 10 1.5 2L4 14'/><path d='m7 21 3-6-1.5-3'/><path d='m7 3 3 6h4'/>",
  "tree-pine": "<path d='m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z'/><path d='M12 22v-3'/>",
  "candy-cane": "<path d='M5.7 21a2 2 0 0 1-3.5-2l8.6-14a6 6 0 0 1 10.4 6 2 2 0 1 1-3.464-2 2 2 0 1 0-3.464-2Z'/><path d='M17.75 7 15 2.1'/><path d='M10.9 4.8 13 9'/><path d='m7.9 9.7 2 4.4'/><path d='M4.9 14.7 7 18.9'/>",
  "flower": "<circle cx='12' cy='12' r='3'/><path d='M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5'/><path d='M12 7.5V9'/><path d='M7.5 12H9'/><path d='M16.5 12H15'/><path d='M12 16.5V15'/><path d='m8 8 1.88 1.88'/><path d='M14.12 9.88 16 8'/><path d='m8 16 1.88-1.88'/><path d='M14.12 14.12 16 16'/>",
  "flower-2": "<path d='M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1'/><circle cx='12' cy='8' r='2'/><path d='M12 10v12'/><path d='M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z'/><path d='M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z'/>",
  "leaf": "<path d='M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z'/><path d='M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'/>",
  "toy-brick": "<rect width='18' height='12' x='3' y='8' rx='1'/><path d='M10 8V5c0-.6-.4-1-1-1H6a1 1 0 0 0-1 1v3'/><path d='M19 8V5c0-.6-.4-1-1-1h-3a1 1 0 0 0-1 1v3'/>",
  "sun": "<circle cx='12' cy='12' r='4'/><path d='M12 2v2'/><path d='M12 20v2'/><path d='m4.93 4.93 1.41 1.41'/><path d='m17.66 17.66 1.41 1.41'/><path d='M2 12h2'/><path d='M20 12h2'/><path d='m6.34 17.66-1.41 1.41'/><path d='m19.07 4.93-1.41 1.41'/>",
  "rainbow": "<path d='M22 17a10 10 0 0 0-20 0'/><path d='M6 17a6 6 0 0 1 12 0'/><path d='M10 17a2 2 0 0 1 4 0'/>",
  "paw-print": "<circle cx='11' cy='4' r='2'/><circle cx='18' cy='8' r='2'/><circle cx='20' cy='16' r='2'/><path d='M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z'/>",
} as const;

type IconName = keyof typeof ICONS;

/** The kinds of list a pattern suits, so the picker can show those first. */
export type HeaderOccasion = "baby" | "birthday" | "christmas" | "wedding" | "housewarming" | "graduation";

export interface HeaderPattern {
  id: string;
  label: string;
  /** Kinds of list it suits. The picker shows these first for that kind. */
  suits: HeaderOccasion[];
}

/** The patterns to pick from, in the order the picker shows them. */
export const HEADER_PATTERNS: HeaderPattern[] = [
  { id: "dots", label: "Dots", suits: [] },
  { id: "plain", label: "Plain", suits: [] },
  { id: "feet", label: "Little feet", suits: ["baby"] },
  { id: "animals", label: "Animals", suits: ["baby"] },
  { id: "dreams", label: "Moon and stars", suits: ["baby"] },
  { id: "baby", label: "Baby things", suits: ["baby"] },
  { id: "balloons", label: "Balloons", suits: ["birthday"] },
  { id: "confetti", label: "Confetti", suits: ["birthday", "graduation"] },
  { id: "cake", label: "Cake and gifts", suits: ["birthday"] },
  { id: "snowflakes", label: "Snowflakes", suits: ["christmas"] },
  { id: "holiday", label: "Holiday", suits: ["christmas"] },
  { id: "hearts", label: "Hearts", suits: ["wedding", "baby"] },
  { id: "flowers", label: "Flowers", suits: ["wedding", "housewarming"] },
  { id: "stars", label: "Stars", suits: ["graduation", "christmas"] },
  { id: "sunny", label: "Sunny days", suits: ["housewarming"] },
  { id: "paws", label: "Paws", suits: [] },
];

/** The icons each icon pattern scatters, in turn. */
const PATTERN_ICONS: Record<string, IconName[]> = {
  feet: ["footprints"],
  animals: ["panda", "rabbit", "bird"],
  dreams: ["moon", "star", "cloud"],
  baby: ["milk", "baby", "toy-brick"],
  balloons: ["balloon", "sparkle"],
  cake: ["cake", "gift"],
  snowflakes: ["snowflake"],
  holiday: ["tree-pine", "candy-cane", "gift"],
  hearts: ["heart"],
  flowers: ["flower", "leaf", "flower-2"],
  stars: ["star", "sparkle"],
  sunny: ["sun", "cloud", "rainbow"],
  paws: ["paw-print"],
};

export const DEFAULT_HEADER = { color: "sky", pattern: "dots" } as const;

export interface ListHeader {
  color: HeaderColor;
  pattern: HeaderPattern;
}

function colorById(id: unknown): HeaderColor | undefined {
  return HEADER_COLORS.find((c) => c.id === id);
}

function patternById(id: unknown): HeaderPattern | undefined {
  return HEADER_PATTERNS.find((p) => p.id === id);
}

/** A saved choice: the ids of a color and a pattern. */
export interface HeaderChoice {
  color: string;
  pattern: string;
}

/**
 * What the owner saved in a list's settings, or null when they never chose.
 * The ids aren't checked here: listHeader falls back for unknown ones.
 */
export function headerChoice(settings: unknown): HeaderChoice | null {
  const saved =
    settings && typeof settings === "object" ? (settings as Record<string, unknown>)[HEADER_SETTING] : undefined;
  if (!saved || typeof saved !== "object") return null;
  const { color, pattern } = saved as Record<string, unknown>;
  return { color: typeof color === "string" ? color : "", pattern: typeof pattern === "string" ? pattern : "" };
}

/**
 * The band to draw for a saved choice, or the default with none. An unknown
 * color or pattern, say one a newer version saved and an older app build
 * doesn't know, falls back to the default for that half only.
 */
export function listHeader(choice?: HeaderChoice | null): ListHeader {
  return {
    color: colorById(choice?.color) ?? colorById(DEFAULT_HEADER.color)!,
    pattern: patternById(choice?.pattern) ?? patternById(DEFAULT_HEADER.pattern)!,
  };
}

/** What to save from a choice a page or the app sent, or null when it isn't one. */
export function parseHeaderChoice(value: unknown): HeaderChoice | null {
  if (!value || typeof value !== "object") return null;
  const { color, pattern } = value as Record<string, unknown>;
  if (!colorById(color) || !patternById(pattern)) return null;
  return { color: color as string, pattern: pattern as string };
}

/**
 * The patterns in the order to show for a kind of list: the ones that suit it
 * first, then the rest in their usual order.
 */
export function patternsFor(occasion: HeaderOccasion | null): HeaderPattern[] {
  if (!occasion) return HEADER_PATTERNS;
  const suits = HEADER_PATTERNS.filter((p) => p.suits.includes(occasion));
  return [...suits, ...HEADER_PATTERNS.filter((p) => !suits.includes(p))];
}

/** The kind of list, for patternsFor: from registry_type and event_type. */
export function headerOccasion(registryType: string | null, eventType: string | null): HeaderOccasion | null {
  if (registryType === "baby") return "baby";
  const known: HeaderOccasion[] = ["birthday", "christmas", "wedding", "housewarming", "graduation"];
  return known.find((o) => o === eventType) ?? null;
}

/** Where each icon sits in a tile: its top-left corner, turn in degrees, and scale. */
const PLACES = [
  { x: 6, y: 8, turn: -14, scale: 0.8 },
  { x: 52, y: 4, turn: 12, scale: 0.66 },
  { x: 28, y: 46, turn: 6, scale: 0.8 },
  { x: 66, y: 52, turn: -10, scale: 0.66 },
];
/** Small dots between the icons, so the tile doesn't look like a grid. */
const SPECKS = [
  { x: 40, y: 28 },
  { x: 82, y: 34 },
  { x: 12, y: 74 },
  { x: 56, y: 82 },
];
const ICON_TILE = 88;

const CONFETTI = [
  "<rect x='6' y='10' width='9' height='3.2' rx='1.6' transform='rotate(32 10.5 11.6)'/>",
  "<circle cx='40' cy='13' r='2.2'/>",
  "<path d='M57 7l5.5 6.5-8.2 1.4z'/>",
  "<rect x='20' y='38' width='9' height='3.2' rx='1.6' transform='rotate(-40 24.5 39.6)'/>",
  "<circle cx='61' cy='40' r='1.8'/>",
  "<path d='M41 56l4 7-8 0z'/>",
  "<circle cx='11' cy='60' r='2'/>",
  "<rect x='56' y='60' width='9' height='3.2' rx='1.6' transform='rotate(70 60.5 61.6)'/>",
].join("");
const CONFETTI_TILE = 72;

export interface PatternTile {
  /** Width and height of one tile, in CSS pixels. Tiles repeat across the band. */
  size: number;
  /** One tile's SVG markup, without the outer <svg>. */
  body: string;
}

/**
 * One tile of a pattern, drawn in `color`. Null for Plain. Dots is the same
 * grid as before: a 1.4px dot every 20px.
 */
export function patternTile(patternId: string, color: string): PatternTile | null {
  if (patternId === "plain") return null;
  if (patternId === "dots") return { size: 20, body: `<circle cx='10' cy='10' r='1.4' fill='${color}'/>` };
  if (patternId === "confetti") return { size: CONFETTI_TILE, body: `<g fill='${color}'>${CONFETTI}</g>` };
  const icons = PATTERN_ICONS[patternId];
  if (!icons) return null;
  const drawn = PLACES.map((place, i) => {
    const icon = ICONS[icons[i % icons.length]];
    return `<g transform='translate(${place.x} ${place.y}) scale(${place.scale}) rotate(${place.turn} 12 12)'>${icon}</g>`;
  }).join("");
  const specks = SPECKS.map((s) => `<circle cx='${s.x}' cy='${s.y}' r='1.3' fill='${color}' stroke='none'/>`).join("");
  return {
    size: ICON_TILE,
    body: `<g fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${drawn}${specks}</g>`,
  };
}

/** A tile as a whole SVG document. */
export function patternTileSvg(tile: PatternTile): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${tile.size}' height='${tile.size}' viewBox='0 0 ${tile.size} ${tile.size}'>${tile.body}</svg>`;
}

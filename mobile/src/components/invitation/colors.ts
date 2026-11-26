// The invitation's colors, in light and dark mode.
//
// The website fills the invitation's top and gift sections with the host's
// color (src/lib/event-colors.ts), or with the occasion's tint when the host
// picked none (src/lib/occasion-theme.ts). Those fills are light, made for
// dark text. In dark mode the app keeps the color but darkens the fill toward
// the background, and uses a light shade of it for icons and labels.

import { normalizeThemeColor, themeColors } from "@shared/event-colors";
import type { EventType } from "@shared/events";
import { occasionFor, type OccasionTint } from "@shared/occasions";

import { useTheme, type Theme } from "@/lib/theme";

/** A panel's background and the color for its icons and short labels. */
export interface PanelColors {
  fill: string;
  ink: string;
}

// The website's 50, 100 and ink shades for each tint (src/styles/theme.css).
const TINTS: Record<OccasionTint | "mintSoft" | "sunshineSoft", PanelColors> = {
  blush: { fill: "#FFDFDF", ink: "#99383E" },
  sunshine: { fill: "#F7EFA9", ink: "#4E3A06" },
  mint: { fill: "#CDF6E9", ink: "#01614D" },
  teal: { fill: "#DEF1F4", ink: "#003847" },
  // The sign-up sheet and the gift exchange use the lighter 50 shades.
  mintSoft: { fill: "#EAFBF5", ink: "#01614D" },
  sunshineSoft: { fill: "#FEFBE4", ink: "#4E3A06" },
};

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Mixes a color toward another: amount 0 keeps it, 1 is the other. */
function mix(hex: string, toward: string, amount: number): string {
  const from = toRgb(hex);
  const to = toRgb(toward);
  return `#${from
    .map((c, i) => Math.round(c + (to[i] - c) * amount).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Light-mode colors as the website draws them, turned for dark mode when needed. */
function forTheme(light: PanelColors, theme: Theme): PanelColors {
  if (!theme.dark) return light;
  // A quarter of the light fill over the dark background makes the fill, and
  // the light fill itself becomes the ink.
  return { fill: mix(light.fill, theme.background, 0.75), ink: light.fill };
}

/**
 * The invitation's own colors: the host's, or the occasion's. `hostColor` is
 * null when the host picked none.
 */
export function useInvitationColors(themeColor: string | null | undefined, eventType: EventType): PanelColors & { hostColor: string | null } {
  const theme = useTheme();
  const hostColor = normalizeThemeColor(themeColor);
  const light = hostColor ? themeColors(hostColor) : TINTS[occasionFor(eventType).tint];
  return { ...forTheme(light, theme), hostColor };
}

/** The colors of a section that has its own tint on the website, such as the sign-up sheet. */
export function useSectionColors(tint: "mintSoft" | "sunshineSoft" | "mint"): PanelColors {
  return forTheme(TINTS[tint], useTheme());
}

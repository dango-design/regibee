import type { PersonalEventType, RegistryType } from "@/lib/types";
import { listTint, type OccasionTint } from "@/lib/occasions";

// Each occasion's colors from the brand palette (src/styles/theme.css). Which
// occasion gets which tint is in src/lib/occasions.ts: baby things are blush,
// birthdays sunshine, Christmas and other holidays mint, everything else teal.
export interface OccasionTheme {
  /** Soft background for a band or panel. */
  bg: string;
  /** Icon color on white. */
  icon: string;
  /** Text color on white or on `bg` (at least 4.5:1). */
  text: string;
}

const THEMES: Record<OccasionTint, OccasionTheme> = {
  blush: { bg: "bg-blush-100", icon: "text-blush-700", text: "text-blush-700" },
  sunshine: { bg: "bg-sunshine-100", icon: "text-sunshine-700", text: "text-sunshine-900" },
  mint: { bg: "bg-mint-100", icon: "text-mint-800", text: "text-mint-800" },
  teal: { bg: "bg-brand-100", icon: "text-brand-600", text: "text-brand-700" },
};

export function themeForTint(tint: OccasionTint): OccasionTheme {
  return THEMES[tint];
}

/** A registry's colors, from its type and occasion. */
export function occasionTheme(registryType: RegistryType, eventType: PersonalEventType | null): OccasionTheme {
  return THEMES[listTint(registryType, eventType)];
}

// The countdown is in occasions.ts, so the mobile app can use it too.
export { countdownLabel } from "@/lib/occasions";

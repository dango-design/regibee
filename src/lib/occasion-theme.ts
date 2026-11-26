import type { PersonalEventType, RegistryType } from "./types";
import { listTint, type OccasionTint } from "./occasions";

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
  blush: { bg: "bg-blush-100 dark:bg-blush-300/15", icon: "text-blush-700 dark:text-blush-200", text: "text-blush-700 dark:text-blush-200" },
  sunshine: { bg: "bg-sunshine-100 dark:bg-sunshine-400/15", icon: "text-sunshine-700 dark:text-sunshine-200", text: "text-sunshine-900 dark:text-sunshine-200" },
  mint: { bg: "bg-mint-100 dark:bg-mint-500/15", icon: "text-mint-800 dark:text-mint-300", text: "text-mint-800 dark:text-mint-300" },
  teal: { bg: "bg-brand-secondary", icon: "text-brand-tertiary", text: "text-brand-secondary" },
};

export function themeForTint(tint: OccasionTint): OccasionTheme {
  return THEMES[tint];
}

/** A registry's colors, from its type and occasion. */
export function occasionTheme(registryType: RegistryType, eventType: PersonalEventType | null): OccasionTheme {
  return THEMES[listTint(registryType, eventType)];
}

// The countdown is in occasions.ts, so the mobile app can use it too.
export { countdownLabel } from "./occasions";

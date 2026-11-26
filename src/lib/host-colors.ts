import type { CSSProperties } from "react";
import type { ThemeColors } from "./event-colors";

// A host's event color on the website, in light and dark mode. Put
// hostColorVars on the element, then HOST_FILL for a panel in the color or
// HOST_INK for an icon or label in it. The phone app reads themeColors
// directly, so this stays out of event-colors.ts.

export const HOST_FILL = "bg-(--host-fill) dark:bg-(--host-fill-dark)";
export const HOST_INK = "text-(--host-ink) dark:text-(--host-ink-dark)";

export function hostColorVars(colors: ThemeColors): CSSProperties {
  return {
    "--host-fill": colors.fill,
    "--host-ink": colors.ink,
    "--host-fill-dark": colors.darkFill,
    "--host-ink-dark": colors.darkInk,
  } as CSSProperties;
}

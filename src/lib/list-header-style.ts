import type { CSSProperties } from "react";
import { patternTile, patternTileSvg, type ListHeader } from "./list-headers";

// A list's band on the website, in light and dark mode. Put
// listHeaderVars(header) on the band, with HEADER_BAND for its color and
// pattern and HEADER_INK for small labels on it. The phone app draws its own
// band from list-headers.ts, so this stays out of that file.

export const HEADER_BAND =
  "bg-(--header-bg) [background-image:var(--header-image)] [background-size:var(--header-size)] dark:bg-(--header-bg-dark) dark:[background-image:var(--header-image-dark)]";
export const HEADER_INK = "text-(--header-ink) dark:text-(--header-ink-dark)";

/** A pattern tile as a CSS background image, or none for Plain. */
function tileImage(patternId: string, color: string): { image: string; size: string } {
  // Dots stay a CSS gradient, exactly as the band drew them before.
  if (patternId === "dots") {
    return { image: `radial-gradient(${color} 1.4px, transparent 1.4px)`, size: "20px 20px" };
  }
  const tile = patternTile(patternId, color);
  if (!tile) return { image: "none", size: "auto" };
  return {
    image: `url("data:image/svg+xml,${encodeURIComponent(patternTileSvg(tile))}")`,
    size: `${tile.size}px ${tile.size}px`,
  };
}

export function listHeaderVars({ color, pattern }: ListHeader): CSSProperties {
  const light = tileImage(pattern.id, color.light.pattern);
  const dark = tileImage(pattern.id, color.dark.pattern);
  return {
    "--header-bg": color.light.bg,
    "--header-bg-dark": color.dark.bg,
    "--header-image": light.image,
    "--header-image-dark": dark.image,
    // Both modes use the same tile, so one size does.
    "--header-size": light.size,
    "--header-ink": color.light.ink,
    "--header-ink-dark": color.dark.ink,
  } as CSSProperties;
}

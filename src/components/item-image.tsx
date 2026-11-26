import {
  Moon,
  Utensils,
  Package,
  Car,
  Bath,
  Shirt,
  HeartPulse,
  BookOpen,
  Heart,
  Gift,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

type CategoryTheme = {
  Icon: LucideIcon;
  bg: string;
  fg: string;
};

const FALLBACK_THEME: CategoryTheme = {
  Icon: Package,
  bg: "#f4f4f5",
  fg: "#71717a",
};

// Pastel background + darker-tone icon per category.
// Keyed off substrings in the category name so this works whether categories
// come from the seed data or a parent-renamed category.
const CATEGORY_THEMES: ReadonlyArray<[RegExp, CategoryTheme]> = [
  [/nursery|sleep/i, { Icon: Moon, bg: "#efe9ff", fg: "#5b3fbf" }],
  [/feed|bottle|nursing/i, { Icon: Utensils, bg: "#fff0e3", fg: "#b45309" }],
  [/diaper/i, { Icon: Package, bg: "#e3f8ec", fg: "#047857" }],
  [/gear|travel|stroller|car seat/i, { Icon: Car, bg: "#e5f3ff", fg: "#0369a1" }],
  [/bath/i, { Icon: Bath, bg: "#e0f5f5", fg: "#0d9488" }],
  [/cloth|outfit/i, { Icon: Shirt, bg: "#ffe3ee", fg: "#be185d" }],
  [/health|safety/i, { Icon: HeartPulse, bg: "#ffe4e4", fg: "#be123c" }],
  [/toy|book|play/i, { Icon: BookOpen, bg: "#fff6d6", fg: "#a16207" }],
  [/maternity|postpartum|mama|mom/i, { Icon: Heart, bg: "#ffe9ef", fg: "#9d174d" }],
  [/gift|extra/i, { Icon: Gift, bg: "#e3f0ea", fg: "#004659" }],
];

// In light mode a tile is its pastel with the darker icon. In dark mode the
// pastel would glare, so the tile is the icon's color mixed into the page's
// dark gray, and the icon is lightened.
const TILE = "bg-(--tile-bg) dark:bg-[color-mix(in_srgb,var(--tile-fg)_24%,var(--color-gray-950))]";
const TILE_ICON = "text-(--tile-fg) dark:text-[color-mix(in_srgb,var(--tile-fg)_45%,white)]";

function tileColors(bg: string, fg: string) {
  return { "--tile-bg": bg, "--tile-fg": fg } as CSSProperties;
}

function themeFor(categoryName?: string | null): CategoryTheme {
  if (!categoryName) return FALLBACK_THEME;
  for (const [pattern, theme] of CATEGORY_THEMES) {
    if (pattern.test(categoryName)) return theme;
  }
  return FALLBACK_THEME;
}

interface ItemImageProps {
  imageUrl?: string | null;
  title: string;
  categoryName?: string | null;
  /** "fill" takes the full width. Give it a height with className, like "h-48". */
  size?: "sm" | "md" | "fill";
  className?: string;
}

export function ItemImage({
  imageUrl,
  title,
  categoryName,
  size = "sm",
  className = "",
}: ItemImageProps) {
  if (size === "fill") {
    return <FillImage imageUrl={imageUrl} title={title} categoryName={categoryName} className={className} />;
  }

  const sizeClass = size === "md" ? "size-20" : "size-16";
  const iconClass = size === "md" ? "h-9 w-9" : "h-7 w-7";

  if (imageUrl) {
    return (
      <div className={`relative flex ${sizeClass} shrink-0 items-center justify-center rounded-md bg-[#fdfdfd] ${className}`}>
        {/* Registries can list hundreds of items, and store photos are often
            large, so photos load as they near the screen. */}
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          className={`${sizeClass} rounded-md object-cover`}
        />
      </div>
    );
  }

  const { Icon, bg, fg } = themeFor(categoryName);
  return (
    <div
      className={`relative flex ${sizeClass} shrink-0 items-center justify-center rounded-md ${TILE} ${className}`}
      style={tileColors(bg, fg)}
      aria-hidden="true"
    >
      <Icon className={`${iconClass} ${TILE_ICON}`} />
    </div>
  );
}

/**
 * An item's photo in a gift dialog, so guests still see what they're giving
 * after they open it. `children` is a line under the photo, like the price.
 * Shows nothing when there's neither.
 */
export function ItemPhotoPanel({
  imageUrl,
  title,
  children,
}: {
  imageUrl?: string | null;
  title: string;
  children?: ReactNode;
}) {
  if (!imageUrl && !children) return null;
  return (
    <div className="overflow-hidden rounded-lg bg-secondary">
      {imageUrl && <FillImage imageUrl={imageUrl} title={title} className="h-44 sm:h-56" />}
      {children}
    </div>
  );
}

/**
 * A full-width photo. The whole photo shows, never cropped, because store
 * photos come in every shape and cropping can cut off the product.
 */
function FillImage({
  imageUrl,
  title,
  categoryName,
  className,
}: Pick<ItemImageProps, "imageUrl" | "title" | "categoryName" | "className">) {
  if (imageUrl) {
    return (
      <div className={`flex w-full items-center justify-center overflow-hidden rounded-lg bg-secondary p-3 dark:bg-gray-50 ${className}`}>
        {/* Most store photos have a white background. Multiply blends that
            white into the box's colour, so the photo doesn't sit in a white
            rectangle. On a dark box multiply would turn the photo almost
            black, so in dark mode the box stays light, like a store's. */}
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain mix-blend-multiply"
        />
      </div>
    );
  }

  const { Icon, bg, fg } = themeFor(categoryName);
  return (
    <div
      className={`flex w-full items-center justify-center rounded-lg ${TILE} ${className}`}
      style={tileColors(bg, fg)}
      aria-hidden="true"
    >
      <Icon className={`h-12 w-12 ${TILE_ICON}`} />
    </div>
  );
}

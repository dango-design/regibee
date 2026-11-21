import { initialsFor } from "@/lib/initials";
import { cx } from "@/lib/utils/cx";

/**
 * Initials for the people a registry is for, joined with "+": "Dana & Ben"
 * becomes "D+B". One person gets their initials: "Alex Kim" becomes "AK".
 * Null when there are no names to take letters from.
 */
export function monogramFor(names: string | null | undefined): string | null {
  const people = (names ?? "")
    .split(/\s*(?:&|\+|,|\band\b)\s*/i)
    .map((person) => person.trim())
    .filter((person) => /[\p{L}\p{N}]/u.test(person));
  if (people.length === 0) return null;
  if (people.length === 1) return initialsFor(people[0]);
  return people
    .slice(0, 3)
    .map((person) => initialsFor(person).charAt(0))
    .join("+");
}

interface RegistryAvatarProps {
  photoUrl?: string | null;
  /** Who the registry is for, like "Dana & Ben". Without a photo, the circle shows "D+B". */
  names?: string | null;
  /**
   * "lg" is 96px. "md" is 56px on phones and 80px from the sm breakpoint up,
   * for the list page's header, where it sits beside the title.
   */
  size?: "md" | "lg";
  className?: string;
}

const SIZES = {
  lg: { circle: "size-24", text: "text-3xl", longText: "text-2xl" },
  md: { circle: "size-14 sm:size-20", text: "text-xl sm:text-3xl", longText: "text-base sm:text-2xl" },
};

/**
 * The circle at the top of a registry: the owner's photo, or a monogram of
 * the names when there's no photo. Renders nothing when there's neither.
 */
export function RegistryAvatar({ photoUrl, names, size = "lg", className }: RegistryAvatarProps) {
  const sizes = SIZES[size];
  if (photoUrl) {
    return (
      // The registry's title follows, so the photo needs no alt text of its own.
      <img
        src={photoUrl}
        alt=""
        className={cx(sizes.circle, "shrink-0 rounded-full object-cover ring-4 ring-white shadow-sm", className)}
      />
    );
  }

  const monogram = monogramFor(names);
  if (!monogram) return null;
  return (
    <span
      aria-hidden="true"
      className={cx(
        sizes.circle,
        "flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-display font-semibold text-brand-700 ring-4 ring-white shadow-sm",
        monogram.length > 3 ? sizes.longText : sizes.text,
        className,
      )}
    >
      {monogram}
    </span>
  );
}

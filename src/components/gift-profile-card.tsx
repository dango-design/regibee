import type { ComponentType, ReactNode } from "react";
import { Ban, Cake, Heart, Palette, Ruler, StickyNote } from "lucide-react";
import { formatBirthday, hasGiftDetails, sizeSummary, type GiftProfile } from "@/lib/gift-profile";
import { cx } from "@/lib/utils/cx";

export interface GiftProfileCardProps {
  profile: GiftProfile;
  /** Whose profile it is, as in "About Dorothy". */
  name: string;
  /**
   * Shows the birthday. Only for the person themselves and the followers they
   * approved, never for everyone with a link.
   */
  showBirthday?: boolean;
  /** Goes next to the heading, like an Edit link on your own profile. */
  action?: ReactNode;
  /**
   * "stacked" puts each label over its value. "compact" puts the label beside
   * it, so the card takes less height, for the side of a list page's header.
   */
  variant?: "stacked" | "compact";
  className?: string;
}

function Chips({ tags, tone }: { tags: string[]; tone: "like" | "skip" }) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <li
          key={tag}
          className={cx(
            "max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium",
            tone === "like"
              ? "bg-brand-primary text-brand-secondary"
              : "bg-primary text-tertiary ring-1 ring-secondary ring-inset",
          )}
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}

function Row({
  icon: Icon,
  label,
  compact,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  compact: boolean;
  children: ReactNode;
}) {
  // A <dl> group may hold only its <dt> and <dd>, so the icon sits inside
  // the <dt>, placed in the left gutter.
  if (compact) {
    // The <dl> is a grid with the labels in one column, as wide as the
    // longest, and the values in the other. This group adds no box of its own.
    return (
      <div className="contents">
        <dt className="relative pl-6 text-xs font-medium whitespace-nowrap text-tertiary">
          <Icon className="absolute top-px left-0 size-4 text-fg-quaternary" aria-hidden />
          {label}
        </dt>
        <dd className="min-w-0 break-words text-sm text-primary">{children}</dd>
      </div>
    );
  }
  return (
    <div className="relative min-w-0 pl-7">
      <dt className="text-xs font-medium text-tertiary">
        <Icon className="absolute top-0.5 left-0 size-4 text-fg-quaternary" aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-primary">{children}</dd>
    </div>
  );
}

/** Whether GiftProfileCard shows anything for this profile. */
export function giftProfileCardShows(profile: GiftProfile, showBirthday = false): boolean {
  return hasGiftDetails(profile) || (showBirthday && Boolean(profile.birthday));
}

/**
 * What someone likes and their sizes, for the people giving them gifts.
 * Renders nothing when there's nothing to show.
 */
export function GiftProfileCard({
  profile,
  name,
  showBirthday = false,
  action,
  variant = "stacked",
  className,
}: GiftProfileCardProps) {
  if (!giftProfileCardShows(profile, showBirthday)) return null;
  const birthday = showBirthday && profile.birthday ? formatBirthday(profile.birthday) : null;

  const sizes = sizeSummary(profile.sizes);
  const likes = profile.likes ?? [];
  const skip = profile.skip ?? [];
  const compact = variant === "compact";

  return (
    <section className={cx("rounded-2xl border border-secondary bg-primary p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="min-w-0 break-words font-semibold text-primary">About {name}</h2>
        {action}
      </div>
      <dl
        className={cx(
          "mt-3",
          compact ? "grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5" : "space-y-3",
        )}
      >
        {birthday && (
          <Row icon={Cake} label="Birthday" compact={compact}>
            {birthday}
          </Row>
        )}
        {sizes.length > 0 && (
          <Row icon={Ruler} label="Sizes" compact={compact}>
            <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
              {sizes.map((size) => (
                <li key={size}>{size}</li>
              ))}
            </ul>
          </Row>
        )}
        {profile.colors && (
          <Row icon={Palette} label="Favorite colors" compact={compact}>
            {profile.colors}
          </Row>
        )}
        {likes.length > 0 && (
          <Row icon={Heart} label="Likes" compact={compact}>
            <Chips tags={likes} tone="like" />
          </Row>
        )}
        {skip.length > 0 && (
          <Row icon={Ban} label="Please skip" compact={compact}>
            <Chips tags={skip} tone="skip" />
          </Row>
        )}
        {profile.notes && (
          <Row icon={StickyNote} label="Notes" compact={compact}>
            <p className="whitespace-pre-line">{profile.notes}</p>
          </Row>
        )}
      </dl>
    </section>
  );
}

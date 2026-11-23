import type { ReactNode } from "react";
import { LockOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ClampedText } from "@/components/clamped-text";
import { GiftProfileChips } from "@/components/gift-profile-card";
import { RegistryAvatar } from "@/components/registry-avatar";
import { formatBirthday, sizeSummary, type GiftProfile } from "@/lib/gift-profile";
import { cx } from "@/lib/utils/cx";

export interface WishListHeroProps {
  title: string;
  photoUrl?: string | null;
  /** The owner's note about the list. Blank lines are paragraph breaks. */
  description: string | null;
  fulfilledItems: number;
  totalItems: number;
  /** Who shared it, for lists on the owner's profile. Signs the note. */
  ownerName?: string | null;
  /** OwnerChip, for lists on the owner's profile. */
  ownerChip?: ReactNode;
  /** What the person likes and their sizes. */
  giftProfile?: GiftProfile | null;
  /** Whose gift profile it is, as in "About Dorothy". */
  giftProfileName?: string;
  /** Shows the birthday: only for the person and the followers they approved. */
  showBirthday?: boolean;
}

// One summary card part per thing there is to show. On narrow screens the
// card has two columns: progress and sizes share a row when both show, and
// every other part takes the whole width. From the breakpoint where all the
// parts fit, they sit in one row.
const COLUMNS: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "md:grid-cols-3",
  4: "lg:grid-cols-4",
};
const ONE_COLUMN_FROM: Record<number, string> = {
  1: "",
  2: "sm:col-span-1",
  3: "md:col-span-1",
  4: "lg:col-span-1",
};
const PART = "flex min-w-0 flex-col bg-primary px-5 py-4 sm:px-6 sm:py-5";

/**
 * The top of a wishlist's page. A tinted band holds the title and who
 * shared it. Under it, a card overlapping the band's edge sums the list up:
 * the owner's note, how much has been gifted, and the person's sizes and
 * likes. A wishlist usually serves many occasions, so it shows no date.
 * Baby registries keep their own header (PublicRegistryHero).
 */
export function WishListHero({
  title,
  photoUrl,
  description,
  fulfilledItems,
  totalItems,
  ownerName,
  ownerChip,
  giftProfile,
  giftProfileName = "this list's owner",
  showBirthday = false,
}: WishListHeroProps) {
  const progress = totalItems > 0 ? (fulfilledItems / totalItems) * 100 : 0;

  const sizes = sizeSummary(giftProfile?.sizes);
  const birthday = showBirthday && giftProfile?.birthday ? formatBirthday(giftProfile.birthday) : null;
  const colors = giftProfile?.colors;
  const likes = giftProfile?.likes ?? [];
  const skip = giftProfile?.skip ?? [];
  const notes = giftProfile?.notes;
  const hasOtherDetails = Boolean(birthday || colors || likes.length || skip.length || notes);
  // Sizes get a part of their own next to "About" when both have something.
  // Alone, they go under "About", so the person's name still heads them.
  const sizesApart = sizes.length > 0 && hasOtherDetails;
  const showAbout = hasOtherDetails || sizes.length > 0;
  const note = description?.trim();
  const parts = (note ? 1 : 0) + 1 + (sizesApart ? 1 : 0) + (showAbout ? 1 : 0);

  // Progress and sizes share a row on narrow screens when both show.
  const part = (half: boolean, extra: string) =>
    cx(PART, half ? "col-span-1" : "col-span-2", ONE_COLUMN_FROM[parts], extra);

  const sizeList = (
    <ul className="flex flex-col gap-0.5">
      {sizes.map((size) => (
        <li key={size}>{size}</li>
      ))}
    </ul>
  );

  return (
    <>
      <section
        className="bg-brand-50 px-4 pt-8 pb-20 sm:pt-10 sm:pb-24"
        style={{
          backgroundImage: "radial-gradient(var(--color-brand-200) 1.4px, transparent 1.4px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
          {photoUrl && <RegistryAvatar photoUrl={photoUrl} names={null} className="mb-1 size-20" />}
          <p className="text-xs font-semibold tracking-[0.08em] text-brand-500 uppercase">
            Wishlist · {totalItems} {totalItems === 1 ? "item" : "items"}
          </p>
          <h1 className="break-words text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl">{title}</h1>
          {ownerChip && <div className="mt-1 max-w-full">{ownerChip}</div>}
        </div>
      </section>

      <div className="container mx-auto px-4">
        {/* The 1px gaps show the card's background through as dividers, in
            any arrangement of parts. */}
        <div
          className={cx(
            "relative -mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-secondary bg-[var(--color-border-secondary)] shadow-[0_8px_24px_rgba(35,27,24,0.06)] sm:-mt-16",
            COLUMNS[parts],
          )}
        >
          {note && (
            <div className={part(false, "gap-1.5")}>
              <p className="text-xs font-semibold text-tertiary">{ownerName ? `A note from ${ownerName}` : "A note"}</p>
              <ClampedText text={note} lines={4} className="text-sm leading-relaxed text-primary" />
            </div>
          )}

          <div className={part(sizesApart, "gap-2")}>
            <div className="flex items-baseline justify-between gap-3 text-xs text-tertiary">
              <span className="font-semibold">
                {fulfilledItems} of {totalItems} items gifted
              </span>
              <span className="tabular-nums">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} aria-label="Items gifted" />
            <p className="flex items-start gap-1.5 text-xs text-tertiary">
              <LockOpen className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              Reserve a gift in 10 seconds — no sign-up required.
            </p>
          </div>

          {sizesApart && (
            <div className={part(true, "gap-1.5 text-sm text-primary")}>
              <p className="text-xs font-semibold text-tertiary">Sizes</p>
              {sizeList}
            </div>
          )}

          {showAbout && (
            <div className={part(false, "gap-2")}>
              {/* font-sans and tracking-normal keep the small label look
                  instead of the display font h2s get by default. */}
              <h2 className="font-sans text-xs font-semibold tracking-normal break-words text-tertiary">
                About {giftProfileName}
              </h2>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 text-sm">
                {!sizesApart && sizes.length > 0 && <Detail label="Sizes">{sizeList}</Detail>}
                {birthday && <Detail label="Birthday">{birthday}</Detail>}
                {colors && <Detail label="Favorite colors">{colors}</Detail>}
                {likes.length > 0 && (
                  <Detail label="Likes">
                    <GiftProfileChips tags={likes} tone="like" />
                  </Detail>
                )}
                {skip.length > 0 && (
                  <Detail label="Please skip">
                    <GiftProfileChips tags={skip} tone="skip" />
                  </Detail>
                )}
                {notes && (
                  <Detail label="Notes">
                    <span className="whitespace-pre-line">{notes}</span>
                  </Detail>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** One label and value in the About part. The <dl> lines the values up. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-xs whitespace-nowrap text-tertiary">{label}</dt>
      <dd className="min-w-0 break-words text-primary">{children}</dd>
    </div>
  );
}

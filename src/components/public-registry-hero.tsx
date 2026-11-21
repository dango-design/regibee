import Link from "next/link";
import { Calendar, LockOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { RegistryAvatar, monogramFor } from "@/components/registry-avatar";
import { cx } from "@/lib/utils/cx";

export interface PublicRegistryHeroProps {
  isBabyRegistry: boolean;
  title: string;
  photoUrl?: string | null;
  /** The honorees' names, for the avatar's initials. */
  names: string | null;
  /** YYYY-MM-DD */
  eventDate: string | null;
  description: string | null;
  fulfilledItems: number;
  totalItems: number;
  /** Who shared it, for registries on the owner's profile. */
  owner?: { name: string; path: string } | null;
  /** The Follow button under "Shared by", for anyone but the owner. */
  followButton?: React.ReactNode;
  /**
   * What the person likes and their sizes (GiftProfileCard, compact), shown
   * beside the list's details from the md breakpoint up.
   */
  about?: React.ReactNode;
}

/**
 * The top of a shared registry page. The list's own details go on the left:
 * the photo or initials, title, date, welcome message and progress. The
 * person goes on the right: who shared it, the Follow button and what they
 * like. On phones the right side follows the left. Kept short, so the items
 * start on the first screen. The share page (src/app/r/[slug]/page.tsx) and
 * the demo both use it.
 */
export function PublicRegistryHero({
  isBabyRegistry,
  title,
  photoUrl,
  names,
  eventDate,
  description,
  fulfilledItems,
  totalItems,
  owner,
  followButton,
  about,
}: PublicRegistryHeroProps) {
  const progress = totalItems > 0 ? (fulfilledItems / totalItems) * 100 : 0;
  const hasAvatar = Boolean(photoUrl || monogramFor(names));
  const hasPerson = Boolean(owner || about);

  return (
    <section className="border-b border-secondary bg-primary">
      <div className="container mx-auto flex flex-col gap-5 px-4 py-5 sm:py-8 md:flex-row md:items-start md:gap-10">
        {/* The list */}
        <div className="min-w-0 flex-1">
          <div className={cx("flex items-center", hasAvatar && "gap-4 sm:gap-5")}>
            <RegistryAvatar photoUrl={photoUrl} names={names} size="md" />
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold tracking-tight text-primary sm:text-3xl lg:text-4xl">
                {title}
              </h1>
              {eventDate && (
                <p className="mt-1 flex items-center gap-2 text-sm text-secondary sm:text-base">
                  <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
          {description && <p className="mt-4 max-w-2xl whitespace-pre-line text-secondary">{description}</p>}
          {/* Progress and how giving works, in one strip. */}
          <div className="mt-4 flex max-w-2xl flex-col gap-2 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex min-w-0 flex-1 items-center gap-3 text-sm text-secondary">
              <span className="shrink-0">
                {fulfilledItems} of {totalItems} items gifted
              </span>
              <Progress value={progress} aria-label="Items gifted" className="min-w-16 flex-1" />
              <span className="shrink-0 tabular-nums">{Math.round(progress)}%</span>
            </div>
            <p className="inline-flex shrink-0 items-center gap-1.5 text-xs text-tertiary">
              <LockOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Reserve a gift in 10 seconds — no sign-up required.
            </p>
          </div>
        </div>

        {/* The person, beside the list from md up. Baby registries keep their
            illustrations there from lg up, under the owner. */}
        {(hasPerson || isBabyRegistry) && (
          <div
            className={cx(
              "flex flex-col gap-4 md:w-80 md:shrink-0 lg:w-96",
              // Only illustrations: nothing to show below lg.
              !hasPerson && "hidden lg:flex",
            )}
          >
            {owner && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-secondary">
                  Shared by{" "}
                  <Link href={owner.path} className="font-medium text-primary underline-offset-2 hover:underline">
                    {owner.name}
                  </Link>
                </p>
                {followButton}
              </div>
            )}
            {about}
            {isBabyRegistry && <BabyIllustrations />}
          </div>
        )}
      </div>
    </section>
  );
}

/** The baby registry's panda and friends, in a small cluster. Decorative. */
function BabyIllustrations() {
  return (
    <div className="pointer-events-none relative hidden h-36 w-full max-w-80 lg:block" aria-hidden="true">
      <img src="/hero/heart-red.svg" alt="" className="absolute top-1 left-[52px] h-[36px] w-[44px]" />
      <img src="/hero/star-teal-left.svg" alt="" className="absolute bottom-3 left-[14px] h-[37px] w-[36px]" />
      <img src="/hero/panda.svg" alt="" className="absolute top-0 left-[96px] h-[138px] w-[120px]" />
      <img src="/hero/bottle.svg" alt="" className="absolute top-2 right-[58px] h-[71px] w-[42px] rotate-[21deg]" />
      <img src="/hero/heart-yellow.svg" alt="" className="absolute top-1 right-[8px] h-[26px] w-[32px]" />
      <img src="/hero/socks.svg" alt="" className="absolute right-[6px] bottom-1 h-[63px] w-[78px]" />
    </div>
  );
}

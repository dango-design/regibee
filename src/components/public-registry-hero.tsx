import Link from "next/link";
import { Calendar, LockOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { RegistryAvatar } from "@/components/registry-avatar";

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
}

/**
 * The top of a shared registry page: the photo or initials, title, date,
 * welcome message and progress. The share page (src/app/r/[slug]/page.tsx)
 * and the demo both use it. Baby registries get a tall header with
 * illustrations around it. Other lists get a shorter one (WishListHero).
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
}: PublicRegistryHeroProps) {
  const progress = totalItems > 0 ? (fulfilledItems / totalItems) * 100 : 0;

  if (!isBabyRegistry) {
    return (
      <WishListHero
        title={title}
        photoUrl={photoUrl}
        names={names}
        eventDate={eventDate}
        description={description}
        fulfilledItems={fulfilledItems}
        totalItems={totalItems}
        progress={progress}
        owner={owner}
        followButton={followButton}
      />
    );
  }

  return (
    // Baby registries reserve 400px for the decorative illustrations;
    // personal registries size to content with a looser minimum, and tighten
    // further when there's no welcome message.
    <section
      className={`relative flex items-center justify-center bg-white py-12 ${
        isBabyRegistry ? "min-h-[400px]" : description ? "min-h-[260px]" : "min-h-[200px]"
      }`}
    >
      {/* Decorative illustrations — baby-specific; personal registries keep
          a clean hero. Pinned to a 1440px canvas. */}
      {isBabyRegistry && (
        <div className="pointer-events-none absolute inset-0 mx-auto hidden max-w-[1440px] lg:block" aria-hidden="true">
          {/* Left side */}
          <img src="/hero/star-teal-left.svg" alt="" className="absolute left-[89px] top-[108px] w-[62px] h-[63px]" />
          <img src="/hero/heart-red.svg" alt="" className="absolute left-[174px] top-[33px] w-[70px] h-[57px]" />
          <img src="/hero/panda.svg" alt="" className="absolute left-[209px] top-[98px] w-[192px] h-[220px]" />
          <img src="/hero/spoon-and-fork.svg" alt="" className="absolute left-[44px] top-[230px] w-[99px] h-[112px] -rotate-[29deg]" />
          {/* Right side */}
          <img src="/hero/heart-yellow.svg" alt="" className="absolute right-[134px] top-[45px] w-[55px] h-[45px]" />
          <img src="/hero/bottle.svg" alt="" className="absolute right-[284px] top-[71px] w-[72px] h-[122px] rotate-[21deg]" />
          <img src="/hero/bib.svg" alt="" className="absolute right-[55px] top-[139px] w-[113px] h-[96px] rotate-[4deg]" />
          <img src="/hero/socks.svg" alt="" className="absolute right-[245px] top-[265px] w-[130px] h-[105px]" />
          <img src="/hero/star-teal-right.svg" alt="" className="absolute right-[62px] top-[284px] w-[62px] h-[63px]" />
        </div>
      )}
      {/* Center content */}
      <div className="relative z-10 flex max-w-[575px] flex-col items-center gap-4 px-4 text-center">
        <RegistryAvatar photoUrl={photoUrl} names={names} />
        <h1 className="text-4xl font-bold leading-[44px] tracking-tight text-primary">{title}</h1>
        {eventDate && (
          <p className="flex items-center gap-2 text-secondary">
            <Calendar className="h-4 w-4" />
            {formatEventDate(eventDate)}
          </p>
        )}
        {description && <p className="text-secondary whitespace-pre-line">{description}</p>}
        <div className="w-full max-w-[566px]">
          <div className="flex justify-between text-sm text-secondary mb-1">
            <span>
              {fulfilledItems} of {totalItems} items gifted
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} aria-label="Items gifted" />
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-tertiary">
          <LockOpen className="h-3.5 w-3.5" />
          Reserve a gift in 10 seconds — no sign-up required.
        </p>
        {owner && (
          <div className="flex flex-col items-center gap-2 border-t border-secondary pt-4">
            <p className="text-sm text-secondary">
              Shared by{" "}
              <Link href={owner.path} className="font-medium text-primary underline-offset-2 hover:underline">
                {owner.name}
              </Link>
            </p>
            {followButton}
          </div>
        )}
      </div>
    </section>
  );
}

/** "December 25, 2026", for a YYYY-MM-DD date. */
function formatEventDate(eventDate: string) {
  return new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A wish list's header, centered like a baby registry's but shorter. The
 * date and "Shared by" share one line under the title, with the Follow
 * button at its end and its hint under it (FollowButton's inline layout).
 * The count and bar share a line too. No minimum height, so the page goes
 * straight on to the About card and the items.
 */
function WishListHero({
  title,
  photoUrl,
  names,
  eventDate,
  description,
  fulfilledItems,
  totalItems,
  progress,
  owner,
  followButton,
}: Omit<PublicRegistryHeroProps, "isBabyRegistry"> & { progress: number }) {
  return (
    <section className="bg-white px-4 pt-8 pb-2 sm:pt-10">
      {/* As wide as the About card under it (max-w-2xl), so their edges line up. */}
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
        <RegistryAvatar photoUrl={photoUrl} names={names} className="mb-1" />
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl sm:leading-[44px]">{title}</h1>
        {(eventDate || owner) && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-secondary">
            {eventDate && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                {formatEventDate(eventDate)}
              </span>
            )}
            {eventDate && owner && (
              <span aria-hidden="true" className="text-quaternary">
                ·
              </span>
            )}
            {owner && (
              <span>
                Shared by{" "}
                <Link href={owner.path} className="font-medium text-primary underline-offset-2 hover:underline">
                  {owner.name}
                </Link>
              </span>
            )}
            {owner && followButton}
          </div>
        )}
        {description && <p className="mt-1 whitespace-pre-line text-secondary">{description}</p>}
        <div className="mt-1 flex w-full items-center gap-3 text-sm text-secondary">
          <span className="shrink-0">
            {fulfilledItems} of {totalItems} items gifted
          </span>
          <Progress value={progress} aria-label="Items gifted" className="min-w-12 flex-1" />
          <span className="shrink-0 tabular-nums">{Math.round(progress)}%</span>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-tertiary">
          <LockOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Reserve a gift in 10 seconds — no sign-up required.
        </p>
      </div>
    </section>
  );
}

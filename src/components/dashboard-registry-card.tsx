import Link from "next/link";
import { EyeOff, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RegistryIcon } from "@/components/registry-icon";
import { countdownLabel, occasionTheme } from "@/lib/occasion-theme";
import { occasionLabel } from "@/lib/registry-copy";
import type { PersonalEventType, RegistryType } from "@/lib/types";
import { cx } from "@/lib/utils/cx";

export interface DashboardRegistryCardProps {
  title: string;
  registryType: RegistryType;
  eventType: PersonalEventType | null;
  /** YYYY-MM-DD, or null when the registry has no date. */
  eventDate: string | null;
  /** YYYY-MM-DD. Passed in so stories and tests get a fixed countdown. */
  today: string;
  totalItems: number;
  fulfilledItems: number;
  /** Gifts reserved in the last 7 days. */
  giftsThisWeek: number;
  manageHref: string;
  /** The list's photo fills the cover. Without one, the cover takes the occasion's color and icon. */
  photoUrl?: string | null;
  /** Only its owner and co-managers can open it. The cover says so. */
  isPrivate?: boolean;
  /**
   * The owner hid what's been reserved from themselves. The card says so
   * instead of showing progress. Pass zero fulfilled items and no gifts this week.
   */
  reservationsHidden?: boolean;
  /**
   * The title's heading level. Cards right under the page's h1 use 2. Cards
   * under a section h2, like "Shared with you", use 3.
   */
  headingLevel?: 2 | 3;
}

/**
 * A list on the My registries tab. The cover across the top is the list's
 * photo, or its occasion's color and icon (src/lib/occasion-theme.ts), and
 * counts down to its date. Under it are the title, a progress bar and one
 * line about its gifts. Its total value, who gave what and the link to its
 * public page are on the list's own page. A click anywhere on the card opens
 * the list (see clickable-card in globals.css). The phone app's home screen
 * draws the same card (mobile/src/components/home/list-cover-card.tsx).
 */
export function DashboardRegistryCard({
  title,
  registryType,
  eventType,
  eventDate,
  today,
  totalItems,
  fulfilledItems,
  giftsThisWeek,
  manageHref,
  photoUrl,
  isPrivate = false,
  reservationsHidden = false,
  headingLevel = 2,
}: DashboardRegistryCardProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const theme = occasionTheme(registryType, eventType);
  const progress = totalItems > 0 ? (fulfilledItems / totalItems) * 100 : 0;
  // Only while the date is ahead: once it's gone by, there's nothing to count down to.
  const countdown = eventDate && eventDate >= today ? countdownLabel(eventDate, today, registryType) : null;

  return (
    <Card className="group/card clickable-card gap-0 overflow-hidden py-0">
      <div className={cx("relative h-28 overflow-hidden", theme.bg)}>
        {photoUrl ? (
          // The title follows, so the photo needs no alt text of its own.
          <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <RegistryIcon
            registryType={registryType}
            eventType={eventType}
            className={cx(
              "absolute -top-3 -right-4 size-36 stroke-[1.25] opacity-25 motion-safe:group-hover/card:animate-wiggle",
              theme.icon,
            )}
          />
        )}
        <div className="relative flex items-center gap-2 p-3.5">
          {countdown && (
            <span className={cx("rounded-full bg-primary px-2.5 py-1 text-xs font-semibold", theme.text)}>
              {countdown}
            </span>
          )}
          {isPrivate && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-secondary">
              <Lock aria-hidden="true" className="size-3" />
              Private
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-5 pt-4 pb-5">
        {/* tracking-normal: the base h2 style tightens letter spacing, but card titles keep the h3 look. */}
        <Heading className="font-display text-xl leading-snug font-bold tracking-normal">
          <Link href={manageHref} className="card-link line-clamp-2 break-words">
            {title}
          </Link>
        </Heading>
        {/* The cover's color and icon show the occasion, so its name is only read out. */}
        <p className="sr-only">{occasionLabel(registryType, eventType)}</p>

        {reservationsHidden ? (
          <p className="flex items-center gap-2 text-sm text-tertiary">
            <EyeOff aria-hidden="true" className="h-4 w-4 shrink-0" />
            What&apos;s been reserved is hidden from you
          </p>
        ) : (
          <>
            {totalItems > 0 && <Progress value={progress} aria-label={`Items gifted for ${title}`} />}
            <p className="text-sm text-secondary">
              {totalItems > 0 ? `${fulfilledItems} of ${totalItems} gifted` : "No items yet"}
              {giftsThisWeek > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-mint-800 dark:text-mint-300">{giftsThisWeek} new this week</span>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

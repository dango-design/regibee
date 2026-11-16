import Link from "next/link";
import { EyeOff } from "lucide-react";
import { cx } from "@/lib/utils/cx";
import { reservationsHiddenText } from "@/lib/gifts";

/** When the owner's hidden gifts are revealed, from the events the list is linked to. */
export interface RevealInfo {
  /** Some gifts are revealed already: the ones reserved before the last event. */
  revealedCount?: number;
  /** The next reveal: "Dec 26", the day after the event. */
  next?: { date: string; eventTitle: string } | null;
}

/**
 * Tells a list's owner that what's been reserved is hidden from them, and
 * where to change it. Shown on the owner's registry page, its Gift Activity
 * tab and its public page while the owner is the one looking.
 */
export function ReservationsHiddenNotice({
  settingsHref,
  turnedOnByExchange = false,
  reveal,
  className,
}: {
  /** The registry's settings page. Left out on pages with no settings link. */
  settingsHref?: string;
  /** Regibee turned it on because the owner added the list to a gift exchange. */
  turnedOnByExchange?: boolean;
  /** When gifts are revealed. Left out on lists not linked to an event. */
  reveal?: RevealInfo;
  className?: string;
}) {
  // The app's registry screen shows the same words (src/lib/gifts.ts).
  const text = reservationsHiddenText({
    revealedCount: reveal?.revealedCount,
    next: reveal?.next,
    turnedOnByExchange,
  });
  return (
    <div className={cx("flex items-start gap-3 rounded-2xl bg-secondary p-4", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
        <EyeOff aria-hidden="true" className="h-4.5 w-4.5 text-tertiary" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-primary">{text.title}</p>
        {text.revealed && <p className="text-secondary">{text.revealed}</p>}
        {text.next && <p className="text-secondary">{text.next}</p>}
        <p className="text-tertiary">
          {text.why}
          {settingsHref && (
            <>
              {" "}
              <Link href={settingsHref} className="font-medium text-brand-600 hover:underline">
                Change this in settings
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

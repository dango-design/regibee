import { ExternalLink, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExchangeGiftee } from "@/lib/events";

/**
 * Who a guest drew in the gift exchange, on their own RSVP link. Nobody else
 * sees it, the host included.
 */
export function SecretSantaCard({
  giftee,
  budget,
  mailed,
  wishlistHref,
}: {
  giftee: ExchangeGiftee;
  budget: string | null;
  mailed: boolean;
  /** Where the wishlist button goes. For a Regibee wishlist, through the event, so gifts stay secret. */
  wishlistHref: string | null;
}) {
  return (
    <section aria-labelledby="santa-heading" className="flex flex-col gap-4 rounded-2xl border-2 border-mint-500 bg-mint-50 dark:bg-mint-500/10 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary">
          <Gift aria-hidden="true" className="size-5 text-mint-800 dark:text-mint-300" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide text-mint-800 dark:text-mint-300 uppercase">Your Secret Santa name</p>
          <h2 id="santa-heading" className="font-display text-2xl font-bold text-primary">
            You&apos;re getting a gift for {giftee.name}
          </h2>
          <p className="mt-1 text-sm text-secondary">
            {budget ? `The budget is ${budget}. ` : ""}Keep it a secret: nobody else knows who drew whom.
          </p>
        </div>
      </div>

      {wishlistHref && (
        <div className="clickable-card flex flex-col gap-2 rounded-xl bg-primary p-3 sm:flex-row sm:items-center sm:justify-between">
          {/* A click anywhere here opens the wishlist. The button is the real
              link for keyboards and screen readers. */}
          <a
            href={wishlistHref}
            target={giftee.wishlistTitle ? undefined : "_blank"}
            rel="noopener noreferrer"
            aria-hidden="true"
            tabIndex={-1}
            className="card-link absolute inset-0"
          />
          <div className="min-w-0">
            <p className="font-medium text-primary">{giftee.wishlistTitle ?? `${giftee.name}'s wishlist`}</p>
            {giftee.wishlistTitle && (
              <p className="text-sm text-tertiary">
                If you reserve something there, {giftee.name} sees &ldquo;Secret Santa&rdquo;, not your name.
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="card-action shrink-0" asChild>
            <a href={wishlistHref} target={giftee.wishlistTitle ? undefined : "_blank"} rel="noopener noreferrer">
              <span className="inline-flex items-center gap-1.5">
                See the wishlist
                {!giftee.wishlistTitle && <ExternalLink aria-hidden="true" className="size-3.5" />}
              </span>
            </a>
          </Button>
        </div>
      )}

      {giftee.giftIdeas && (
        <div>
          <p className="text-sm font-medium text-secondary">Their gift ideas</p>
          <p className="mt-0.5 whitespace-pre-line text-primary">{giftee.giftIdeas}</p>
        </div>
      )}

      {!wishlistHref && !giftee.giftIdeas && (
        <p className="text-sm text-secondary">
          {giftee.name} hasn&apos;t added a wishlist or gift ideas yet. This page shows them as soon as they do.
        </p>
      )}

      {mailed && (
        <div>
          <p className="text-sm font-medium text-secondary">Mail it to</p>
          {giftee.shippingAddress ? (
            <p className="mt-0.5 whitespace-pre-line text-primary">{giftee.shippingAddress}</p>
          ) : (
            <p className="mt-0.5 text-sm text-tertiary">{giftee.name} hasn&apos;t added an address yet. Ask the host.</p>
          )}
        </div>
      )}
    </section>
  );
}

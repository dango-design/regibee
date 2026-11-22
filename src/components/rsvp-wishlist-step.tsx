"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Gift, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveEventWishlist, type EventWishlistInput } from "@/lib/actions/events";
import { storeName } from "@/lib/events";
import { normalizeThemeColor, themeColors } from "@/lib/event-colors";
import { cx } from "@/lib/utils/cx";

/** What the wish list step needs from the event page, besides the event and the guest's token. */
export interface RsvpWishlist {
  /**
   * The guest's wish list now, or null. A Regibee list has its title, and its
   * id when it's one of the signed-in account's own lists, so they can add to it.
   */
  current: { url: string; title: string | null; ownListId: string | null } | null;
  giftIdeas: string | null;
  /** The signed-in account's own lists that others can open. Null when signed out. */
  account: { lists: { id: string; title: string }[] } | null;
  /** Where signing up or logging in comes back to. Defaults to the guest's own link. */
  returnTo?: string;
  /** The host's color for the invitation, which fills the step. None leaves it without a fill. */
  themeColor?: string | null;
  saveAction?: (input: EventWishlistInput) => Promise<{ error: string | null }>;
}

export interface RsvpWishlistStepProps extends RsvpWishlist {
  slug: string;
  token: string;
}

/**
 * The step after a guest says they're coming to an everyone-gives-everyone
 * event: add the wish list the others will shop from. It's a Regibee list, so
 * it takes an account. Someone signed in picks one of their lists or makes a
 * new one. Someone signed out makes an account or logs in, and comes back
 * here to do that. A link or gift ideas saved before this rule still show.
 */
export function RsvpWishlistStep({
  slug,
  token,
  current,
  giftIdeas,
  account,
  returnTo,
  themeColor = null,
  saveAction = saveEventWishlist,
}: RsvpWishlistStepProps) {
  // No fill, under a line, unless the host picked a color for the invitation.
  const color = normalizeThemeColor(themeColor);
  const colors = color ? themeColors(color) : null;
  const box = cx(
    "mt-4 flex scroll-mt-24 flex-col",
    colors ? "rounded-xl p-4" : "border-t border-secondary pt-4",
  );
  const boxStyle = colors ? { backgroundColor: colors.fill } : undefined;
  const icon = (
    <span
      className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", colors ? "bg-primary" : "bg-secondary")}
    >
      <Gift
        aria-hidden="true"
        className={cx("size-4.5", !colors && "text-brand-600")}
        style={colors ? { color: colors.ink } : undefined}
      />
    </span>
  );
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const hasSomething = Boolean(current || giftIdeas);
  const [choosing, setChoosing] = useState(!hasSomething);
  // Which button is saving: a list's id or "new".
  const [busy, setBusy] = useState<string | null>(null);
  const [justMade, setJustMade] = useState(false);
  const [error, setError] = useState("");

  const lists = account?.lists ?? [];
  const back = returnTo ?? `/e/${slug}?g=${encodeURIComponent(token)}#wishlist`;
  const working = busy !== null || refreshing;

  const save = async (choice: Omit<EventWishlistInput, "slug" | "token">, key: string) => {
    setBusy(key);
    setError("");
    const result = await saveAction({ slug, token, ...choice });
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    // The page reloads with the saved list. Until it has, the button keeps spinning.
    startTransition(() => {
      setBusy(null);
      setChoosing(false);
      setJustMade(Boolean(choice.makeNew));
      router.refresh();
    });
  };

  // A button's label, or a spinner while that button's save runs.
  const spinner = (key: string, label: React.ReactNode, busyLabel: string) =>
    busy === key ? (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        {busyLabel}
      </span>
    ) : (
      label
    );

  if (!choosing && hasSomething) {
    return (
      <section
        id="wishlist"
        aria-labelledby="wishlist-heading"
        className={cx(box, "gap-3")}
        style={boxStyle}
      >
        <div className="flex items-start gap-3">
          {icon}
          <div className="min-w-0 pt-1">
            <h3 id="wishlist-heading" className="font-medium text-primary">
              Your wish list
            </h3>
            {current ? (
              <p className="text-sm break-words text-secondary">
                {current.title ?? `A list on ${storeName(current.url)}`}
              </p>
            ) : (
              <p className="text-sm text-secondary">No list, just gift ideas.</p>
            )}
            {giftIdeas && (
              <p className="mt-1 text-sm whitespace-pre-line text-secondary">
                <span className="font-medium text-primary">Gift ideas: </span>
                {giftIdeas}
              </p>
            )}
            {justMade && current?.ownListId && (
              <p className="mt-2 text-sm text-tertiary">
                It&apos;s linked to the invitation. Add a few things, so everyone knows what to get you.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {current?.ownListId && (
            <Button size="sm" variant={justMade ? "default" : "outline"} asChild>
              <Link href={`/dashboard/registry/${current.ownListId}`}>Add things to your list</Link>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setChoosing(true)}>
            {current ? "Change" : "Add a wish list"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      id="wishlist"
      aria-labelledby="wishlist-heading"
      className={cx(box, "gap-4")}
      style={boxStyle}
    >
      <div className="flex items-center gap-3">
        {icon}
        <h3 id="wishlist-heading" className="min-w-0 font-medium text-primary">
          {current ? "Change your wish list" : "Now add your wish list"}
        </h3>
      </div>

      {account ? (
        <div className="flex flex-col gap-3">
          {lists.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-secondary">Use one of your lists</p>
              <ul className="flex flex-col gap-2">
                {lists.map((list) => {
                  const linked = current?.ownListId === list.id;
                  return (
                    <li
                      key={list.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-secondary bg-primary p-3"
                    >
                      <span className="min-w-0 font-medium break-words text-primary">{list.title}</span>
                      {linked ? (
                        <span className="inline-flex items-center gap-1 text-sm text-success-primary">
                          <Check aria-hidden="true" className="size-4" />
                          Linked
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="max-sm:min-h-11"
                          disabled={working}
                          aria-label={`Use ${list.title}`}
                          onClick={() => save({ registryId: list.id }, list.id)}
                        >
                          {spinner(list.id, "Use this list", "Linking…")}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="flex flex-col items-start gap-1.5">
            {/* With lists to pick from, picking one is the main thing to do,
                so making another is a quieter button. */}
            <Button
              variant={lists.length > 0 ? "ghost" : "default"}
              disabled={working}
              onClick={() => save({ makeNew: true }, "new")}
            >
              {spinner(
                "new",
                <span className="inline-flex items-center gap-1.5">
                  <Plus aria-hidden="true" className="size-4" />
                  {lists.length > 0 ? "Make a new wish list" : "Make my wish list"}
                </span>,
                "Making it…",
              )}
            </Button>
            {lists.length === 0 && (
              <p className="text-sm text-tertiary">
                It&apos;s free. Add things from any store, and it&apos;s linked here as soon as you make it.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/signup?redirect=${encodeURIComponent(back)}`}>Make a free wish list</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/login?redirect=${encodeURIComponent(back)}`}>Log in</Link>
            </Button>
          </div>
          <p className="text-sm text-tertiary">
            New to Regibee? Make a free account, and you&apos;ll come back here to make your list. Already have a list
            on Regibee? Log in to pick it.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-error-primary">
          {error}
        </p>
      )}

      {hasSomething && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={working}
          onClick={() => {
            setChoosing(false);
            setError("");
          }}
        >
          Keep my wish list as it is
        </Button>
      )}
    </section>
  );
}

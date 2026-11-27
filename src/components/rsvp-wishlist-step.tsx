"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Gift, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RowActionsMenu, type RowAction } from "@/components/row-actions-menu";
import { saveEventWishlist, type EventWishlistInput } from "@/lib/actions/events";
import { storeName } from "@/lib/events";
import { normalizeThemeColor, themeColors } from "@/lib/event-colors";
import { HOST_FILL, HOST_INK, hostColorVars } from "@/lib/host-colors";
import { cx } from "@/lib/utils/cx";
import type { RsvpWishlistData } from "@/lib/invitation-page-types";

/** What the wishlist step needs from the event page, besides the event and the guest's token. */
export interface RsvpWishlist extends RsvpWishlistData {
  /** Where signing up or logging in comes back to. Defaults to the guest's own link. */
  returnTo?: string;
  saveAction?: (input: EventWishlistInput) => Promise<{ error: string | null }>;
}

export interface RsvpWishlistStepProps extends RsvpWishlist {
  slug: string;
  token: string;
}

/**
 * The step after a guest says they're coming to an everyone-gives-everyone
 * event: add the wishlist the others will shop from. It's a Regibee list, so
 * it takes an account. Someone signed in picks one of their lists or makes a
 * new one. Someone signed out makes an account or logs in, and comes back
 * here to do that. A link or gift ideas saved before this rule still show.
 *
 * With a wishlist linked, someone signed in can add more of their own lists
 * beside it, such as a list they keep for their child, and take them off.
 * Once linked, the step is one quiet row under the RSVP: the lists as links,
 * and a "…" menu for the rare changes.
 */
export function RsvpWishlistStep({
  slug,
  token,
  current,
  giftIdeas,
  more = [],
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
    colors ? cx("rounded-xl p-4", HOST_FILL) : "border-t border-secondary pt-4",
  );
  const boxStyle = colors ? hostColorVars(colors) : undefined;
  const icon = (
    <span
      className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", colors ? "bg-primary" : "bg-secondary")}
    >
      <Gift
        aria-hidden="true"
        className={cx("size-4.5", colors ? HOST_INK : "text-brand-tertiary")}
        style={colors ? hostColorVars(colors) : undefined}
      />
    </span>
  );
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const hasSomething = Boolean(current || giftIdeas);
  const [choosing, setChoosing] = useState(!hasSomething);
  // Picking another list to add beside the wishlist.
  const [adding, setAdding] = useState(false);
  // Which button is saving: a list's id, "new", or "remove:" and a list's id.
  const [busy, setBusy] = useState<string | null>(null);
  const [justMade, setJustMade] = useState(false);
  const [error, setError] = useState("");

  const lists = account?.lists ?? [];
  const back = returnTo ?? `/e/${slug}?g=${encodeURIComponent(token)}#wishlist`;
  const working = busy !== null || refreshing;
  // Another list goes beside a Regibee wishlist, and takes an account.
  const canAddMore = Boolean(account && current?.title);
  const otherLists = lists.filter((list) => list.id !== current?.ownListId && !more.some((m) => m.id === list.id));

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
      setAdding(false);
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
    // Changing the wishlist or adding a second list is rare, so those wait
    // in a "…" menu instead of showing as buttons.
    const menu: RowAction[] = [
      ...(current ? [{ id: "change", label: "Change wishlist" }] : []),
      ...(canAddMore ? [{ id: "add", label: "Add another list" }] : []),
      ...more.map((list) => ({ id: `remove:${list.id}`, label: `Take off ${list.title}` })),
    ];
    const onMenu = (id: string) => {
      setError("");
      if (id === "change") setChoosing(true);
      else if (id === "add") setAdding(true);
      else if (id.startsWith("remove:")) save({ removeRegistryId: id.slice("remove:".length) }, id);
    };
    const listLink = "font-medium break-words text-primary underline-offset-2 hover:underline";
    return (
      <section
        id="wishlist"
        aria-labelledby="wishlist-heading"
        className={cx(box, "gap-3")}
        style={boxStyle}
      >
        <div className="flex items-start gap-3">
          {icon}
          <div className="min-w-0 flex-1">
            <h3 id="wishlist-heading" className="text-sm text-tertiary">
              Your wishlist
            </h3>
            {current || more.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {current && (
                  <li>
                    {current.ownListId ? (
                      <Link href={`/dashboard/registry/${current.ownListId}`} className={listLink}>
                        {current.title ?? "Your list"}
                      </Link>
                    ) : (
                      <a href={current.url} target="_blank" rel="noopener noreferrer" className={listLink}>
                        {current.title ?? `A list on ${storeName(current.url)}`}
                      </a>
                    )}
                  </li>
                )}
                {more.map((list) => (
                  <li key={list.id}>
                    {list.ownListId ? (
                      <Link href={`/dashboard/registry/${list.ownListId}`} className={listLink}>
                        {list.title}
                      </Link>
                    ) : (
                      <span className="font-medium break-words text-primary">{list.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-secondary">No list, just gift ideas.</p>
            )}
            {giftIdeas && (
              <p className="mt-1 text-sm whitespace-pre-line text-secondary">
                <span className="font-medium text-primary">Gift ideas: </span>
                {giftIdeas}
              </p>
            )}
          </div>
          <RowActionsMenu label="Wishlist options" actions={menu} onAction={onMenu} disabled={working} />
        </div>

        {/* Right after making a list, filling it is the next thing to do. */}
        {justMade && current?.ownListId && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-tertiary">Add a few things so everyone knows what to get you.</p>
            <Button size="sm" asChild>
              <Link href={`/dashboard/registry/${current.ownListId}`}>Add things to your list</Link>
            </Button>
          </div>
        )}

        {!current && (
          <Button size="sm" variant="outline" className="self-start" onClick={() => setChoosing(true)}>
            Add a wishlist
          </Button>
        )}

        {busy?.startsWith("remove:") && (
          <p role="status" className="inline-flex items-center gap-1.5 text-sm text-tertiary">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Taking it off…
          </p>
        )}

        {canAddMore && adding && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-secondary">Add another of your lists</p>
            {otherLists.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {otherLists.map((list) => (
                  <li
                    key={list.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-secondary bg-primary p-3"
                  >
                    <span className="min-w-0 font-medium break-words text-primary">{list.title}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="max-sm:min-h-11"
                      disabled={working}
                      aria-label={`Add ${list.title}`}
                      onClick={() => save({ addRegistryId: list.id }, list.id)}
                    >
                      {spinner(list.id, "Add this list", "Adding…")}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-tertiary">
                You have no other lists to add.{" "}
                <Link href="/dashboard/new" className="font-medium text-brand-tertiary underline">
                  Make a new list
                </Link>
                , then come back here to add it.
              </p>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              disabled={working}
              onClick={() => {
                setAdding(false);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-error-primary">
            {error}
          </p>
        )}
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
          {current ? "Change your wishlist" : "Now add your wishlist"}
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
                  {lists.length > 0 ? "Make a new wishlist" : "Make my wishlist"}
                </span>,
                "Making it…",
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/signup?redirect=${encodeURIComponent(back)}`}>Make a free wishlist</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/login?redirect=${encodeURIComponent(back)}`}>Log in</Link>
            </Button>
          </div>
          <p className="text-sm text-tertiary">
            Already have a Regibee list? Log in to pick it.
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
          Keep my wishlist as it is
        </Button>
      )}
    </section>
  );
}

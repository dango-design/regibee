"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Gift, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { saveEventWishlist, type EventWishlistInput } from "@/lib/actions/events";
import { storeName } from "@/lib/events";

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
  saveAction?: (input: EventWishlistInput) => Promise<{ error: string | null }>;
}

export interface RsvpWishlistStepProps extends RsvpWishlist {
  slug: string;
  token: string;
}

/**
 * The step after a guest says they're coming to an everyone-gives-everyone
 * event: add the wish list the others will shop from. Someone signed in picks
 * one of their lists or makes a new one. Someone signed out makes an account
 * or logs in, and comes back here to do that. Anyone can paste a link to a
 * list at another store, or just write gift ideas.
 */
export function RsvpWishlistStep({
  slug,
  token,
  current,
  giftIdeas,
  account,
  returnTo,
  saveAction = saveEventWishlist,
}: RsvpWishlistStepProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const hasSomething = Boolean(current || giftIdeas);
  const [choosing, setChoosing] = useState(!hasSomething);
  const [pasting, setPasting] = useState(false);
  const [url, setUrl] = useState(current?.url ?? "");
  const [ideas, setIdeas] = useState(giftIdeas ?? "");
  // Which button is saving: a list's id, "new" or "paste".
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
      setPasting(false);
      setJustMade(Boolean(choice.makeNew));
      router.refresh();
    });
  };

  const openPaste = () => {
    setUrl(current?.url ?? "");
    setIdeas(giftIdeas ?? "");
    setPasting(true);
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
        className="mt-4 flex scroll-mt-6 flex-col gap-3 rounded-xl bg-mint-50 p-4"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
            <Gift aria-hidden="true" className="size-4.5 text-mint-800" />
          </span>
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
            <p className="mt-2 text-sm text-tertiary">
              {justMade && current?.ownListId
                ? "It's linked to the invitation. Add a few things, so everyone knows what to get you."
                : "The others see it on the invitation, with what they've reserved from it. You won't, so your gifts stay a surprise."}
            </p>
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
      className="mt-4 flex scroll-mt-6 flex-col gap-4 rounded-xl bg-mint-50 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
          <Gift aria-hidden="true" className="size-4.5 text-mint-800" />
        </span>
        <div className="min-w-0 pt-1">
          <h3 id="wishlist-heading" className="font-medium text-primary">
            {current ? "Change your wish list" : "Now add your wish list"}
          </h3>
          <p className="mt-1 text-sm text-secondary">
            Everyone gives everyone, so the others need to know what you&apos;d like. They&apos;ll see what&apos;s
            been reserved from your list. You won&apos;t, so your gifts stay a surprise.
          </p>
        </div>
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
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary p-3"
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
            <Button
              variant={lists.length > 0 ? "outline" : "default"}
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

      {pasting ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ url, giftIdeas: ideas }, "paste");
          }}
          className="flex flex-col gap-3 border-t border-secondary pt-4"
        >
          <Input
            label="Link to your list (optional)"
            value={url}
            onChange={setUrl}
            placeholder="A list at Amazon, Target or any store"
            hint="Paste the whole link from your browser."
          />
          <TextArea
            label="Gift ideas (optional)"
            value={ideas}
            onChange={setIdeas}
            rows={2}
            maxLength={1000}
            placeholder="Cozy socks (size M), anything with cats, a good mystery novel"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={working}>
              {spinner("paste", "Save", "Saving…")}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={working} onClick={() => setPasting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={openPaste}
          className="cursor-pointer self-start text-left text-sm font-medium text-brand-600 hover:underline max-sm:min-h-11"
        >
          Paste a link from another store, or add gift ideas
        </button>
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
            setPasting(false);
            setError("");
          }}
        >
          Keep my wish list as it is
        </Button>
      )}
    </section>
  );
}

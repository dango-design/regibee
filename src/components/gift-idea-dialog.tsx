"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Clipboard, CurrencyDollar, Link01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { TextArea } from "@/components/base/textarea/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteGiftIdea, saveGiftIdea } from "@/lib/actions/gift-ideas";
import { fetchProductDetails } from "@/lib/fetch-product";
import { NOTES_MAX, RECIPIENT_MAX, TITLE_MAX, recipientKey, type GiftIdea } from "@/lib/gift-ideas";
import { gtinForLink, type ReadGtin } from "@/lib/gtin";
import { detectStore } from "@/lib/retailers";
import { findSharedLink, nameFromProductUrl } from "@/lib/shared-link";
import { cx } from "@/lib/utils/cx";

// Saves a gift idea for someone else, or changes one. Who it's for comes
// first: a link shared from a phone is read on its own, so most of the time
// picking the person is all that's left. It's optional, so an idea can be
// saved before deciding who it's for. Nothing here is ever shown to them.

export interface GiftIdeaDialogProps {
  /** The button that opens the dialog. */
  trigger: React.ReactNode;
  /** The idea to change. Leave unset to save a new one. */
  idea?: GiftIdea;
  /** People ideas were saved for before, most recent first. Shown as one-tap choices. */
  recipients: string[];
  /** Who a new idea starts out for, such as the person whose ideas you're looking at. */
  defaultRecipient?: string;
  /** Open on load with this link filled in, then read it. For links shared from a phone (/share). */
  openWithLink?: { url: string; title?: string };
  // Stories pass stand-ins. The page uses the real server actions.
  saveAction?: typeof saveGiftIdea;
  deleteAction?: typeof deleteGiftIdea;
  /** Reads a product link. Stories pass a stand-in. */
  readLink?: typeof fetchProductDetails;
  onSaved?: (saved: { id: string; recipient: string; title: string }) => void;
  onDeleted?: () => void;
}

function errorOf(result: unknown): string | null {
  if (result && typeof result === "object" && "error" in result) {
    const error = (result as { error?: unknown }).error;
    if (typeof error === "string" && error) return error;
  }
  return null;
}

function priceText(price: number | null | undefined) {
  return price == null ? "" : price.toFixed(2);
}

export function GiftIdeaDialog({
  trigger,
  idea,
  recipients,
  defaultRecipient,
  openWithLink,
  saveAction = saveGiftIdea,
  deleteAction = deleteGiftIdea,
  readLink = fetchProductDetails,
  onSaved,
  onDeleted,
}: GiftIdeaDialogProps) {
  const editing = Boolean(idea);
  const startRecipient = idea?.recipient ?? defaultRecipient ?? "";
  const [open, setOpen] = useState(Boolean(openWithLink));
  const [recipient, setRecipient] = useState(startRecipient);
  const [url, setUrl] = useState(idea?.externalUrl ?? openWithLink?.url ?? "");
  const [title, setTitle] = useState(idea?.title ?? openWithLink?.title ?? "");
  const [price, setPrice] = useState(priceText(idea?.price));
  const [imageUrl, setImageUrl] = useState(idea?.imageUrl ?? "");
  const [pictures, setPictures] = useState<string[]>([]);
  const [brokenPictures, setBrokenPictures] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState(idea?.notes ?? "");
  const [reading, setReading] = useState(false);
  const [readStatus, setReadStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const urlRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  // Each read takes the next number. Closing the dialog moves it on, so a read
  // that finishes after that leaves the fresh form alone.
  const readNumber = useRef(0);
  const lastReadUrl = useRef<string | null>(null);
  // A barcode number read here, and its link. It's sent only with that link
  // (src/lib/gtin.ts).
  const readGtin = useRef<ReadGtin | null>(null);
  const readSharedLink = useRef(false);

  const canPaste = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";

  /** Reads the link and fills in what's still empty. */
  const read = async (rawUrl: string, options: { knownTitle?: string; fromTap?: boolean } = {}) => {
    const trimmed = rawUrl.trim();
    if (!trimmed || reading) return;
    const link = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      new URL(link);
    } catch {
      return;
    }
    if (!options.fromTap && link === lastReadUrl.current) return;
    lastReadUrl.current = link;

    const run = ++readNumber.current;
    const stillCurrent = () => run === readNumber.current;
    const currentTitle = options.knownTitle || title;
    setReading(true);
    setReadStatus(null);

    const result = await readLink(link, {
      onReadingWithExtension: () => {
        if (stillCurrent()) setReadStatus({ text: "Reading the page with the Regibee extension…", isError: false });
      },
    });
    if (!stillCurrent()) return;
    setReading(false);

    if (result.error) {
      const store = detectStore(link)?.name ?? "that page";
      const guessed = currentTitle ? undefined : nameFromProductUrl(link);
      if (guessed) setTitle(guessed);
      setReadStatus({
        text: guessed
          ? `We couldn't read ${store}, so we took the name from the link. Check it.`
          : currentTitle
            ? `We couldn't read ${store}. Your link and name are kept.`
            : `We couldn't read ${store}. The link is kept, so add a name yourself.`,
        isError: true,
      });
      if (options.fromTap && !currentTitle && !guessed) titleRef.current?.focus();
      return;
    }

    readGtin.current = { url: link, gtin: result.gtin ?? null };
    const filled: string[] = [];
    if (result.title && !currentTitle) {
      setTitle(result.title);
      filled.push("name");
    }
    if (result.price && !price) {
      setPrice(parseFloat(result.price).toFixed(2));
      filled.push("price");
    }
    const found = result.imageUrls ?? (result.imageUrl ? [result.imageUrl] : []);
    if (found.length > 0) {
      setPictures(found);
      setBrokenPictures(new Set());
      if (!imageUrl) {
        setImageUrl(found[0]);
        filled.push("picture");
      }
    }
    setReadStatus({
      text: filled.length > 0 ? `Filled in the ${filled.join(", ")}.` : "Nothing new to fill in from that page.",
      isError: false,
    });
  };

  // A link shared from a phone: read it as soon as the dialog opens, and take
  // the share off the address so a reload doesn't open the dialog again.
  useEffect(() => {
    if (!openWithLink || readSharedLink.current) return;
    readSharedLink.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    read(openWithLink.url, { knownTitle: openWithLink.title });
    // Runs once, for the link the page opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paste = async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      urlRef.current?.focus();
      return;
    }
    const shared = findSharedLink({ text });
    if (!shared) {
      setReadStatus({ text: "There's no link on your clipboard. Copy the product's link, then tap Paste.", isError: true });
      return;
    }
    setUrl(shared.url);
    const knownTitle = title || shared.title;
    if (!title && shared.title) setTitle(shared.title);
    read(shared.url, { knownTitle, fromTap: true });
  };

  const reset = () => {
    readNumber.current++;
    lastReadUrl.current = null;
    readGtin.current = null;
    setRecipient(startRecipient);
    setUrl(idea?.externalUrl ?? "");
    setTitle(idea?.title ?? "");
    setPrice(priceText(idea?.price));
    setImageUrl(idea?.imageUrl ?? "");
    setPictures([]);
    setBrokenPictures(new Set());
    setNotes(idea?.notes ?? "");
    setReading(false);
    setReadStatus(null);
    setSaving(false);
    setError("");
    setConfirmingDelete(false);
  };

  // The form starts from the idea as it is now, so it's reset on opening as
  // well as closing: after a save, the page refreshes with the new values.
  const changeOpen = (next: boolean) => {
    reset();
    setOpen(next);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    let result: Awaited<ReturnType<typeof saveGiftIdea>>;
    try {
      // read() adds https:// the same way, so a link that was read matches.
      const link = url.trim() && !/^https?:\/\//i.test(url.trim()) ? `https://${url.trim()}` : url.trim();
      const gtin = gtinForLink(readGtin.current, link) || null;
      result = await saveAction({ recipient, title, url, imageUrl, price, notes, gtin }, idea?.id);
    } catch {
      result = { error: "The idea wasn't saved. Try again in a moment." };
    }
    const message = errorOf(result);
    if (message || !("success" in result)) {
      setError(message ?? "The idea wasn't saved. Try again in a moment.");
      setSaving(false);
      return;
    }
    const saved = { id: result.id, recipient: recipient.replace(/\s+/g, " ").trim(), title: title.replace(/\s+/g, " ").trim() };
    changeOpen(false);
    onSaved?.(saved);
  };

  const remove = async () => {
    if (!idea) return;
    setError("");
    setSaving(true);
    let message: string | null;
    try {
      message = errorOf(await deleteAction(idea.id));
    } catch {
      message = "The idea wasn't deleted. Try again in a moment.";
    }
    if (message) {
      setError(message);
      setSaving(false);
      setConfirmingDelete(false);
      return;
    }
    changeOpen(false);
    onDeleted?.();
  };

  const chosenKey = recipientKey(recipient);
  const shownPictures = [...new Set([...(imageUrl ? [imageUrl] : []), ...pictures])].filter((p) => !brokenPictures.has(p));

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit gift idea" : "Save a gift idea"}</DialogTitle>
          <DialogDescription>
            <Lock aria-hidden="true" className="mr-1 inline size-3.5 align-[-2px]" />
            Only you can see your gift ideas. The person they&apos;re for never does.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="min-w-0 space-y-5">
          <div className="space-y-2">
            <Input
              label="Who's it for? (optional)"
              placeholder="Mom, Sam, my brother…"
              value={recipient}
              onChange={setRecipient}
              maxLength={RECIPIENT_MAX}
              autoComplete="off"
              enterKeyHint="next"
            />
            {recipients.length > 0 && (
              <ul aria-label="People you've saved ideas for" className="flex flex-wrap gap-1.5">
                {recipients.map((name) => {
                  const chosen = recipientKey(name) === chosenKey;
                  return (
                    <li key={recipientKey(name)}>
                      <button
                        type="button"
                        aria-pressed={chosen}
                        // Tapping the chosen name again takes it off.
                        onClick={() => setRecipient(chosen ? "" : name)}
                        className={cx(
                          "min-h-9 cursor-pointer rounded-full px-3 text-sm font-medium outline-focus-ring transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                          chosen
                            ? "bg-brand-solid text-primary_on-brand"
                            : "bg-secondary text-secondary ring-1 ring-secondary ring-inset hover:bg-tertiary",
                        )}
                      >
                        {name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label>Link (optional)</Label>
            <div className="flex items-stretch gap-2 max-sm:flex-col">
              <Input
                ref={urlRef}
                aria-label="Product link"
                placeholder="https://www.example.com/..."
                value={url}
                onChange={setUrl}
                onBlur={(e) => read((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  // Enter reads the link instead of saving the half-filled form.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    read(url, { fromTap: true });
                  }
                }}
                inputMode="url"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                enterKeyHint="go"
                className="flex-1"
              />
              <div className="flex gap-2 max-sm:*:flex-1">
                {canPaste && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={reading}
                    onClick={paste}
                    className="hidden h-10 max-sm:inline-flex pointer-coarse:inline-flex"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Clipboard aria-hidden="true" className="h-4 w-4" />
                      Paste link
                    </span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={reading || !url.trim()}
                  onClick={() => read(url, { fromTap: true })}
                  className="h-10"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {reading ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link01 aria-hidden="true" className="h-4 w-4" />
                    )}
                    {reading ? "Reading…" : "Fill in"}
                  </span>
                </Button>
              </div>
            </div>
            {readStatus && (
              <p role="status" className={cx("text-xs", readStatus.isError ? "text-warning-primary" : "text-brand-tertiary")}>
                {readStatus.text}
              </p>
            )}
          </div>

          <Input
            ref={titleRef}
            label="What is it?"
            placeholder="e.g., Wool scarf in green"
            value={title}
            onChange={setTitle}
            maxLength={TITLE_MAX}
            autoComplete="off"
            enterKeyHint="next"
            isRequired
          />

          {shownPictures.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-secondary">Picture</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {shownPictures.map((picture) => {
                  const selected = picture === imageUrl;
                  return (
                    <button
                      key={picture}
                      type="button"
                      onClick={() => setImageUrl(selected ? "" : picture)}
                      aria-label={selected ? "Don't use a picture" : "Use this picture"}
                      aria-pressed={selected}
                      className={cx(
                        "relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 bg-tertiary transition",
                        selected ? "border-brand-solid ring-2 ring-brand-solid/30" : "border-transparent hover:border-secondary",
                      )}
                    >
                      <img
                        src={picture}
                        alt=""
                        className="size-full object-cover"
                        onError={() => setBrokenPictures((prev) => new Set(prev).add(picture))}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Input
            label="Price (optional)"
            icon={CurrencyDollar}
            placeholder="0.00"
            value={price}
            onChange={setPrice}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            className="sm:max-w-48"
          />

          <TextArea
            label="Note (optional)"
            placeholder="Her size, the color she liked, when to get it…"
            value={notes}
            onChange={setNotes}
            maxLength={NOTES_MAX}
            rows={3}
          />

          {error && (
            <p role="alert" className="text-sm text-error-primary">
              {error}
            </p>
          )}

          {confirmingDelete && idea && (
            <div className="rounded-lg bg-error-primary p-3">
              <p role="alert" className="text-sm text-primary">
                Delete &ldquo;{idea.title}&rdquo;? You can&apos;t undo this.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="destructive" size="sm" disabled={saving} onClick={remove}>
                  Delete it
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          )}

          <DialogFooter sticky>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
              Cancel
            </Button>
            {editing && !confirmingDelete && (
              <Button
                type="button"
                variant="destructive-outline"
                disabled={saving}
                onClick={() => setConfirmingDelete(true)}
                className="order-first sm:mr-auto"
              >
                Delete
              </Button>
            )}
            {/* Saving while the link is still being read keeps what's
                filled in so far. */}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save" : "Save idea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

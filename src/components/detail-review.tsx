"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemImage } from "@/components/item-image";
import { chooseDetailValue, finishDetailReview } from "@/lib/actions/item-details";
import { DETAIL_FIELD_NAMES, detailReviewHeading, type DetailField, type ShownSide } from "@/lib/item-details";
import type { ListPageDetailChange, ListPageDetailReview } from "@/lib/list-page-types";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

interface DetailReviewProps {
  registryId: string;
  /** Filled-in details nobody has reviewed yet (src/lib/item-details-server.ts). */
  reviews: ListPageDetailReview[];
  /** Stories pass stand-ins for these, so nothing is saved. */
  chooseAction?: typeof chooseDetailValue;
  finishAction?: typeof finishDetailReview;
  className?: string;
}

/**
 * Shown above the items on a list's page after the extension filled in
 * details (MissingDetailsNotice) or found new prices (PriceCheck). Where a read replaced something, such as a
 * name guessed from the link, it shows the new value and the old one, and
 * either can be picked. What only filled an empty field is folded away below,
 * since it rarely needs a look. Done hides it all; the items keep what they
 * show.
 */
export function DetailReview({
  registryId,
  reviews,
  chooseAction = chooseDetailValue,
  finishAction = finishDetailReview,
  className,
}: DetailReviewProps) {
  const [saving, setSaving] = useState<string | null>(null);
  // The items Done was clicked for. Filling in more items later shows the review again.
  const [finishedFor, setFinishedFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const itemsKey = reviews.map((r) => r.itemId).join(",");

  if (reviews.length === 0 || finishedFor === itemsKey) return null;

  // An item with any replaced value goes in the main list, with all its changes.
  const replaced = reviews.filter((r) => r.changes.some((c) => c.before !== null));
  const filled = reviews.filter((r) => r.changes.every((c) => c.before === null));

  const choose = async (review: ListPageDetailReview, change: ListPageDetailChange, side: ShownSide) => {
    const key = `${review.itemId}:${change.field}`;
    setSaving(key);
    setError("");
    const result = await chooseAction(registryId, review.itemId, change.field, side).catch(() => ({
      error: "Couldn't save that. Try again.",
    }));
    setSaving(null);
    if (result?.error) setError(result.error);
  };

  const finish = async () => {
    setSaving("finish");
    setError("");
    const result = await finishAction(
      registryId,
      reviews.map((r) => r.itemId),
    ).catch(() => ({ error: "Couldn't save that. Try again." }));
    setSaving(null);
    if (result?.error) setError(result.error);
    else setFinishedFor(itemsKey);
  };

  const changeRow = (review: ListPageDetailReview, change: ListPageDetailChange) => (
    <ChangeRow
      key={change.field}
      review={review}
      change={change}
      saving={saving === `${review.itemId}:${change.field}`}
      disabled={saving !== null}
      onChoose={(side) => choose(review, change, side)}
    />
  );

  return (
    <section
      aria-labelledby="detail-review-heading"
      className={cn("space-y-4 rounded-xl border border-success-200 dark:border-success-800 bg-primary p-3.5", className)}
    >
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-700 dark:text-success-300" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id="detail-review-heading" className="text-sm font-semibold text-primary">
            {detailReviewHeading(reviews)}
          </h3>
          {replaced.length > 0 && (
            <p className="text-sm text-secondary">
              {replaced.length === 1
                ? "Its old value is below, so you can switch back."
                : "Their old values are below, so you can switch back."}
            </p>
          )}
        </div>
      </div>

      {replaced.length > 0 && (
        <ul className="space-y-3 sm:pl-6.5">
          {replaced.map((review) =>
            // A name change shows the name twice, so it takes the whole card.
            review.changes.some((c) => c.field === "title") ? (
              <li key={review.itemId} className="flex gap-3 rounded-lg border border-secondary p-3">
                <Thumbnail review={review} />
                <div className="min-w-0 flex-1 space-y-3">{review.changes.map((change) => changeRow(review, change))}</div>
              </li>
            ) : (
              // Otherwise the item on the left and its choices on the right, from small screens up.
              <li
                key={review.itemId}
                className="grid gap-3 rounded-lg border border-secondary p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-start"
              >
                <div className="flex min-w-0 gap-3">
                  <Thumbnail review={review} />
                  <p className="min-w-0 text-sm font-semibold text-primary sm:pt-0.5">{review.title}</p>
                </div>
                <div className="min-w-0 space-y-3">{review.changes.map((change) => changeRow(review, change))}</div>
              </li>
            ),
          )}
        </ul>
      )}

      {filled.length > 0 && (
        <details className="group sm:pl-6.5">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-secondary [&::-webkit-details-marker]:hidden">
            {replaced.length === 0
              ? "See what was filled in"
              : filled.length === 1
                ? "See what was filled in on 1 more item"
                : `See what was filled in on ${filled.length} more items`}
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="space-y-3 pt-2">
            {filled.map((review) => (
              <li key={review.itemId} className="flex gap-3 rounded-lg border border-secondary p-3">
                <Thumbnail review={review} />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-semibold text-primary">{review.title}</p>
                  {review.changes.map((change) => changeRow(review, change))}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="text-sm text-error-primary sm:pl-6.5">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 sm:pl-6.5">
        <Button size="sm" onClick={finish} disabled={saving !== null}>
          {saving === "finish" ? "Saving…" : "Done"}
        </Button>
      </div>
    </section>
  );
}

function Thumbnail({ review }: { review: ListPageDetailReview }) {
  // Only from small screens up, to leave room for long names on a phone.
  return (
    <div className="hidden shrink-0 sm:block">
      {review.imageUrl ? (
        <img
          src={review.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-12 rounded-md bg-tertiary object-cover"
        />
      ) : (
        <ItemImage imageUrl={null} title={review.title} size="sm" className="!size-12 !rounded-md" />
      )}
    </div>
  );
}

function shownValue(field: DetailField, value: string | number | null) {
  if (value === null) return <span className="text-tertiary">None</span>;
  if (field === "price") return formatPrice(Number(value));
  if (field === "image_url") {
    return <img src={String(value)} alt="" className="size-12 rounded-md bg-tertiary object-cover" />;
  }
  return String(value);
}

/** A value as a screen reader says it, in a choice's name. */
function spokenValue(field: DetailField, value: string | number | null): string {
  if (value === null) return "none";
  if (field === "price") return formatPrice(Number(value));
  if (field === "image_url") return "a photo";
  return String(value);
}

interface ChangeRowProps {
  review: ListPageDetailReview;
  change: ListPageDetailChange;
  saving: boolean;
  disabled: boolean;
  onChoose: (side: ShownSide) => void;
}

/**
 * One field's change. A replaced value lists the new and the old as a choice
 * of two. A filled-in one has a button to take it out.
 */
function ChangeRow({ review, change, saving, disabled, onChoose }: ChangeRowProps) {
  const name = DETAIL_FIELD_NAMES[change.field];
  const lowerName = name.toLowerCase();

  if (change.before === null) {
    const showing = change.shown === "after";
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="w-12 shrink-0 text-tertiary">{name}</span>
        <span className={cn("min-w-0 break-words text-primary", !showing && "text-tertiary line-through")}>
          {shownValue(change.field, change.after)}
        </span>
        <span className="text-xs text-tertiary">{showing ? "Was empty" : "Taken out"}</span>
        <Button
          variant="ghost"
          size="xs"
          disabled={disabled}
          aria-label={showing ? `Take out the ${lowerName} of ${review.title}` : `Add back the ${lowerName} of ${review.title}`}
          onClick={() => onChoose(showing ? "before" : "after")}
        >
          {saving ? "Saving…" : showing ? "Take out" : "Add back"}
        </Button>
      </div>
    );
  }

  const options: { side: ShownSide; label: string; value: string | number | null }[] = [
    { side: "after", label: "New", value: change.after },
    { side: "before", label: "Old", value: change.before },
  ];
  // A choice of two: the one picked is what the item shows. Clicking anywhere
  // on the other row switches to it.
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-sm text-tertiary">
        {name}
        <span className="sr-only"> of {review.title}</span>
      </legend>
      {options.map((option) => {
        const picked = change.shown === option.side;
        return (
          <label
            key={option.side}
            className={cn(
              "flex min-h-10 items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring",
              picked
                ? "border-brand-solid bg-brand-solid/5 ring-1 ring-brand-solid ring-inset"
                : "border-secondary hover:border-primary",
              disabled ? "cursor-default" : "cursor-pointer",
            )}
          >
            <input
              type="radio"
              name={`${review.itemId}-${change.field}`}
              value={option.side}
              checked={picked}
              onChange={() => onChoose(option.side)}
              aria-label={`${option.label} ${lowerName}: ${spokenValue(change.field, option.value)}`}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border",
                picked ? "border-brand-solid bg-brand-solid" : "border-primary bg-primary",
              )}
            >
              {picked && <span className="size-1.5 rounded-full bg-primary" />}
            </span>
            <span className={cn("w-8 shrink-0 font-semibold", picked ? "text-primary" : "text-tertiary")}>{option.label}</span>
            <span className={cn("min-w-0 flex-1 break-words", picked ? "text-primary" : "text-secondary")}>
              {shownValue(change.field, option.value)}
            </span>
            {saving && picked && <span className="shrink-0 text-xs text-tertiary">Saving…</span>}
          </label>
        );
      })}
    </fieldset>
  );
}

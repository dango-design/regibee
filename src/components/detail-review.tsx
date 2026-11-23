"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemImage } from "@/components/item-image";
import { chooseDetailValue, finishDetailReview } from "@/lib/actions/item-details";
import { DETAIL_FIELD_NAMES, type DetailField, type ShownSide } from "@/lib/item-details";
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
 * details (MissingDetailsNotice). Where a read replaced something, such as a
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

  const total = reviews.length;
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
      className={cn("space-y-4 rounded-xl border border-success-200 bg-primary p-3.5", className)}
    >
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-700" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id="detail-review-heading" className="text-sm font-semibold text-primary">
            {total === 1 ? "Filled in details for 1 item" : `Filled in details for ${total} items`}
          </h3>
          <p className="text-sm text-secondary">
            {replaced.length === 0
              ? "Everything filled in was empty before."
              : replaced.length === 1
                ? "One item already had something the store has differently. Its old value is kept below, so you can switch back."
                : `${replaced.length} items already had something the store has differently. Their old values are kept below, so you can switch back.`}
          </p>
        </div>
      </div>

      {replaced.length > 0 && (
        <ul className="space-y-3 sm:pl-6.5">
          {replaced.map((review) => (
            <li key={review.itemId} className="flex gap-3 rounded-lg border border-secondary p-3">
              <Thumbnail review={review} />
              <div className="min-w-0 flex-1 space-y-3">
                {/* A name change shows the name twice; otherwise say which item it is. */}
                {!review.changes.some((c) => c.field === "title") && (
                  <p className="text-sm font-semibold text-primary">{review.title}</p>
                )}
                {review.changes.map((change) => changeRow(review, change))}
              </div>
            </li>
          ))}
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
        <p className="text-sm text-tertiary">Items keep what they show now.</p>
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

interface ChangeRowProps {
  review: ListPageDetailReview;
  change: ListPageDetailChange;
  saving: boolean;
  disabled: boolean;
  onChoose: (side: ShownSide) => void;
}

/**
 * One field's change. A replaced value lists the new and the old, with a
 * button on the one not showing. A filled-in one has a button to take it out.
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
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm text-tertiary">{name}</legend>
      {options.map((option) => {
        const showing = change.shown === option.side;
        return (
          <div
            key={option.side}
            className={cn(
              "flex items-center gap-x-3 rounded-md px-2.5 py-2 text-sm",
              showing ? "bg-success-50 ring-1 ring-success-200 ring-inset" : "bg-secondary",
            )}
          >
            <span className={cn("w-9 shrink-0 font-semibold", showing ? "text-success-800" : "text-tertiary")}>
              {option.label}
            </span>
            <span className={cn("min-w-0 flex-1 break-words", showing ? "text-primary" : "text-secondary")}>
              {shownValue(change.field, option.value)}
            </span>
            {showing ? (
              <span className="shrink-0 text-xs font-semibold text-success-800">Showing</span>
            ) : (
              <Button
                variant="outline"
                size="xs"
                className="shrink-0"
                disabled={disabled}
                aria-label={`Use the ${option.label.toLowerCase()} ${lowerName} for ${review.title}`}
                onClick={() => onChoose(option.side)}
              >
                {saving ? "Saving…" : `Use ${option.label.toLowerCase()}`}
              </Button>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

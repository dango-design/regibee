// Filling in items' details later, on a list's screen: the website's
// MissingDetailsNotice and DetailReview (src/components/missing-details-notice.tsx
// and src/components/detail-review.tsx), in their words.
//
// Some stores block Regibee's server, so an item added on the website without
// the browser extension can have a link and no photo or price. The website
// reads those links with the extension. The app reads them itself, in the
// hidden web view it uses for the add item form, then saves what it found
// through the same server action.

import { useRef, useState } from "react";
import { Alert, View } from "react-native";

import { DETAIL_FIELD_NAMES, type DetailField, type ShownSide } from "@shared/item-details";
import type { ListPageDetailChange, ListPageDetailReview, ListPageMissingDetails } from "@shared/list-page-types";

import { ItemImage } from "@/components/item-image";
import { Notice } from "@/components/notice";
import { ProductReader } from "@/components/product-reader";
import { Button, ProgressBar, Text } from "@/components/ui";
import { errorMessage, saveReadDetails, useChooseDetailValue, useFinishDetailReview, useRefreshList } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import type { ReadProduct } from "@/lib/product";
import { radius, spacing, useTheme } from "@/lib/theme";

/**
 * "3 items are missing a photo or price", with a button that reads each
 * item's link, one at a time, and fills in what's missing. The review below
 * it then shows what changed.
 */
export function MissingDetailsNotice({ registryId, items }: { registryId: string; items: ListPageMissingDetails[] }) {
  const theme = useTheme();
  const refresh = useRefreshList();
  // The items as they were when the button was tapped. The list reloads as
  // items are saved, which changes `items`.
  const [queue, setQueue] = useState<ListPageMissingDetails[] | null>(null);
  const [index, setIndex] = useState(0);
  const [notRead, setNotRead] = useState(0);
  const [stopping, setStopping] = useState(false);
  const stopped = useRef(false);
  const failed = useRef(0);

  function start() {
    stopped.current = false;
    failed.current = 0;
    setStopping(false);
    setNotRead(0);
    setIndex(0);
    setQueue(items);
  }

  async function onResult(product: ReadProduct | null) {
    if (!queue) return;
    const item = queue[index];
    // The server needs a name to tell that the page was a product page.
    if (product?.title) {
      try {
        await saveReadDetails(registryId, item.id, item.external_url, product);
      } catch {
        failed.current++;
      }
    } else {
      failed.current++;
    }
    if (stopped.current || index + 1 >= queue.length) {
      setNotRead(failed.current);
      setQueue(null);
      refresh(registryId);
      return;
    }
    setIndex(index + 1);
  }

  if (queue) {
    const total = queue.length;
    const current = queue[index];
    return (
      <View
        style={{ backgroundColor: theme.tintSoft, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md }}
        accessibilityLiveRegion="polite"
      >
        <ProductReader key={current.id} url={current.external_url} onResult={onResult} />
        <Text variant="subhead" style={{ fontWeight: "600" }}>
          Reading {Math.min(index + 1, total)} of {total} from the store…
        </Text>
        <ProgressBar value={total > 0 ? index / total : 0} />
        <Text variant="footnote" tone="secondary">
          Keep this screen open until it&apos;s done.
        </Text>
        <View style={{ flexDirection: "row" }}>
          <Button
            title={stopping ? "Stopping…" : "Stop after this one"}
            size="small"
            variant="secondary"
            disabled={stopping}
            onPress={() => {
              stopped.current = true;
              setStopping(true);
            }}
          />
        </View>
      </View>
    );
  }

  if (items.length === 0) return null;
  const one = items.length === 1;

  return (
    <Notice
      icon="image"
      tone="tint"
      title={one ? "1 item is missing a photo or price" : `${items.length} items are missing a photo or price`}
      message={`Regibee can fill ${one ? "it" : "them"} in from the store. You can undo changes after.`}
      action={{ title: one ? "Fill it in" : "Fill them in", onPress: start }}
    >
      {notRead > 0 ? (
        <Text variant="footnote" tone="danger" style={{ paddingLeft: 46 }}>
          {notRead === 1 ? "1 item couldn't be read." : `${notRead} items couldn't be read.`} Try again later.
        </Text>
      ) : null}
    </Notice>
  );
}

/**
 * "Filled in details for 3 items": what filling in changed. A value that
 * replaced another lists the new and the old, with a button on the one not
 * showing. A value that filled an empty field has a button to take it out.
 */
export function DetailReview({ registryId, reviews }: { registryId: string; reviews: ListPageDetailReview[] }) {
  const theme = useTheme();
  const choose = useChooseDetailValue(registryId);
  const finish = useFinishDetailReview(registryId);
  const [showFilled, setShowFilled] = useState(false);
  // "itemId:field" while one choice saves.
  const [saving, setSaving] = useState<string | null>(null);

  if (reviews.length === 0) return null;

  // An item with any replaced value goes in the main list, with all its changes.
  const replaced = reviews.filter((r) => r.changes.some((c) => c.before !== null));
  const filled = reviews.filter((r) => r.changes.every((c) => c.before === null));
  const total = reviews.length;
  const busy = saving !== null || finish.isPending;

  function pick(review: ListPageDetailReview, change: ListPageDetailChange, side: ShownSide) {
    const key = `${review.itemId}:${change.field}`;
    setSaving(key);
    choose.mutate(
      { itemId: review.itemId, field: change.field, side },
      {
        onError: (e) => Alert.alert("Couldn't save that", errorMessage(e)),
        onSettled: () => setSaving(null),
      }
    );
  }

  const card = (review: ListPageDetailReview, showTitle: boolean) => (
    <View key={review.itemId} style={{ backgroundColor: theme.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md }}>
      {showTitle ? (
        <Text variant="subhead" style={{ fontWeight: "600" }}>
          {review.title}
        </Text>
      ) : null}
      {review.changes.map((change) => (
        <ChangeRow
          key={change.field}
          review={review}
          change={change}
          saving={saving === `${review.itemId}:${change.field}`}
          disabled={busy}
          onChoose={(side) => pick(review, change, side)}
        />
      ))}
    </View>
  );

  return (
    <Notice
      icon="checkCircle"
      tone="success"
      title={total === 1 ? "Filled in details for 1 item" : `Filled in details for ${total} items`}
      message={
        replaced.length === 0
          ? undefined
          : replaced.length === 1
            ? "Its old value is below, so you can switch back."
            : "Their old values are below, so you can switch back."
      }
    >
      {/* A name change shows the name twice; otherwise say which item it is. */}
      {replaced.map((review) => card(review, !review.changes.some((c) => c.field === "title")))}

      {filled.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row" }}>
            <Button
              title={
                showFilled
                  ? "Hide what was filled in"
                  : replaced.length === 0
                    ? "See what was filled in"
                    : filled.length === 1
                      ? "See what was filled in on 1 more item"
                      : `See what was filled in on ${filled.length} more items`
              }
              size="small"
              variant="ghost"
              onPress={() => setShowFilled((shown) => !shown)}
            />
          </View>
          {showFilled ? filled.map((review) => card(review, true)) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" }}>
        <Button
          title="Done"
          size="small"
          loading={finish.isPending}
          disabled={busy}
          onPress={() =>
            finish.mutate(
              reviews.map((r) => r.itemId),
              { onError: (e) => Alert.alert("Couldn't save that", errorMessage(e)) }
            )
          }
        />
      </View>
    </Notice>
  );
}

function ShownValue({ field, value, faded }: { field: DetailField; value: string | number | null; faded?: boolean }) {
  if (value === null) {
    return (
      <Text variant="footnote" tone="tertiary" style={{ flex: 1 }}>
        None
      </Text>
    );
  }
  if (field === "image_url") {
    return (
      <View style={{ flex: 1, opacity: faded ? 0.5 : 1 }}>
        <ItemImage uri={String(value)} size={48} />
      </View>
    );
  }
  return (
    <Text
      variant="footnote"
      tone={faded ? "tertiary" : "primary"}
      style={{ flex: 1, textDecorationLine: faded ? "line-through" : "none" }}
    >
      {field === "price" ? formatPrice(Number(value)) : String(value)}
    </Text>
  );
}

function ChangeRow({
  review,
  change,
  saving,
  disabled,
  onChoose,
}: {
  review: ListPageDetailReview;
  change: ListPageDetailChange;
  saving: boolean;
  disabled: boolean;
  onChoose: (side: ShownSide) => void;
}) {
  const theme = useTheme();
  const name = DETAIL_FIELD_NAMES[change.field];
  const lowerName = name.toLowerCase();

  // Filled an empty field: it can be taken out, and added back.
  if (change.before === null) {
    const showing = change.shown === "after";
    return (
      <View style={{ gap: 4 }}>
        <Text variant="caption" tone="tertiary">
          {name} · {showing ? "Was empty" : "Taken out"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <ShownValue field={change.field} value={change.after} faded={!showing} />
          <Button
            title={showing ? "Take out" : "Add back"}
            accessibilityLabel={showing ? `Take out the ${lowerName} of ${review.title}` : `Add back the ${lowerName} of ${review.title}`}
            size="small"
            variant="ghost"
            loading={saving}
            disabled={disabled}
            onPress={() => onChoose(showing ? "before" : "after")}
          />
        </View>
      </View>
    );
  }

  const options: { side: ShownSide; label: string; value: string | number | null }[] = [
    { side: "after", label: "New", value: change.after },
    { side: "before", label: "Old", value: change.before },
  ];
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" tone="tertiary">
        {name}
      </Text>
      {options.map((option) => {
        const showing = change.shown === option.side;
        return (
          <View
            key={option.side}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              minHeight: 44,
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
              borderRadius: radius.sm,
              backgroundColor: showing ? theme.successSoft : theme.surfaceAlt,
            }}
          >
            <Text variant="footnote" tone={showing ? "success" : "tertiary"} style={{ width: 34, fontWeight: "600" }}>
              {option.label}
            </Text>
            <ShownValue field={change.field} value={option.value} />
            {showing ? (
              <Text variant="caption" tone="success" style={{ fontWeight: "600" }}>
                Showing
              </Text>
            ) : (
              <Button
                title={`Use ${option.label.toLowerCase()}`}
                accessibilityLabel={`Use the ${option.label.toLowerCase()} ${lowerName} for ${review.title}`}
                size="small"
                variant="secondary"
                loading={saving}
                disabled={disabled}
                onPress={() => onChoose(option.side)}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

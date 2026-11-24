"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { ExternalLink, ShoppingBag, Undo2 } from "lucide-react";
import { ItemImage } from "@/components/item-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { UsedConditionTag } from "@/components/ui/used-condition-tag";
import { toggleParentPurchased } from "@/lib/actions/registry";
import { EditItemDialog } from "@/components/edit-item-dialog";
import { GiftDetailModal, type Purchase } from "@/components/gift-detail-modal";
import { StoreRegistryLine } from "@/components/store-registry-line";
import { ownerItemStatus } from "@/lib/gifts";
import type { RetailerRegistry, StoreId } from "@/lib/retailers";
import { formatPrice } from "@/lib/money";
import { cx } from "@/lib/utils/cx";

interface ItemCardProps {
  item: {
    id: string;
    title: string;
    external_url: string | null;
    image_url: string | null;
    price: number | null;
    quantity_needed: number;
    quantity_fulfilled: number;
    is_essential: boolean;
    is_parent_purchased: boolean;
    is_open_to_used: boolean;
    minimum_condition: string | null;
    notes: string | null;
    category_id: string | null;
  };
  registryId: string;
  isOwner?: boolean;
  categories?: { id: string; name: string }[];
  zipCode?: string;
  highlightId?: string;
  purchases?: Purchase[];
  selfPurchaseButtonLabel?: string;
  registryType?: "baby" | "personal";
  eventType?: string | null;
  /** The owner's linked store registries, for baby registries. They name the
   *  store registry the item's link counts toward, and go to the edit
   *  dialog's store link notice. Leave unset to show neither. */
  linkedRegistries?: RetailerRegistry[];
  storesWithRegistryLinks?: StoreId[];
  /** The titles of the owner's other lists this item is on, if any. */
  otherLists?: string[];
}

export function ItemCard({ item, registryId, isOwner, categories = [], zipCode, highlightId, purchases, selfPurchaseButtonLabel = "Mark as bought by parent", registryType = "baby", eventType = null, linkedRegistries, storesWithRegistryLinks, otherLists }: ItemCardProps) {
  const [toggling, startToggle] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [giftDetailOpen, setGiftDetailOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHighlighted = highlightId === item.id;
  const isFulfilled = item.quantity_fulfilled >= item.quantity_needed;
  // The app's item row shows the same status (src/lib/gifts.ts).
  const status = ownerItemStatus(item, purchases);
  const hasGifts = (purchases || []).some((p) => p.status !== "cancelled");

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  // The action returns before the page's updated item arrives. In a
  // transition, `toggling` stays true until the new item is on screen, so the
  // card doesn't show the old button again in between.
  const handleToggleParentPurchased = () => {
    startToggle(async () => {
      await toggleParentPurchased(item.id, registryId, !item.is_parent_purchased);
    });
  };

  // For the owner, a click anywhere on the card opens the item to edit. The
  // title is the button that does it, so keyboards can too (see
  // clickable-card in globals.css).
  return (
    <>
    <Card
      ref={cardRef}
      className={cx(
        "py-0 gap-0 rounded-2xl",
        isOwner && "group/card clickable-card",
        item.is_parent_purchased && "bg-secondary",
      )}
      style={isHighlighted ? { animation: "highlight-pulse 1.5s ease-in-out 3" } : undefined}
    >
      <CardContent className="flex h-full flex-col justify-between gap-4 p-4">
        <div className="flex gap-3">
          {/* A fulfilled item fades its image, not the whole card, so its text keeps 4.5:1 contrast. */}
          <div className={`relative size-[106px] shrink-0 ${isFulfilled && !item.is_parent_purchased ? "opacity-60" : ""}`}>
            {item.image_url ? (
              <div className="flex size-[106px] items-center justify-center rounded-[10px] bg-tertiary">
                {/* Photos load as they near the screen (see item-image.tsx). */}
                <img
                  src={item.image_url}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="size-[106px] rounded-[10px] object-cover"
                />
              </div>
            ) : (
              <ItemImage
                imageUrl={null}
                title={item.title}
                categoryName={categories.find((c) => c.id === item.category_id)?.name}
                size="md"
                className="!size-[106px] !rounded-[10px]"
              />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <h3 className="text-sm font-medium min-w-0 flex-1 break-words">
                {isOwner ? (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => setEditOpen(true)}
                    className="card-link block w-full cursor-pointer text-left"
                  >
                    {item.title}
                  </button>
                ) : (
                  item.title
                )}
              </h3>
              <div className="min-w-0 max-w-[45%] shrink">
                {status.tag?.kind === "purchased-by-you" && (
                  <Tag variant="purchased-by-you" className="max-w-full overflow-hidden text-ellipsis block">{status.tag.label}</Tag>
                )}
                {status.tag && status.tag.kind !== "purchased-by-you" && (
                  hasGifts ? (
                    // Opens who gave it, not the editor.
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => setGiftDetailOpen(true)}
                      className="card-action block max-w-full cursor-pointer rounded-full outline-focus-ring hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <Tag variant={status.tag.kind} className="max-w-full overflow-hidden text-ellipsis block">
                        {status.tag.label}
                      </Tag>
                    </button>
                  ) : (
                    <Tag variant="gifted">{status.tag.label}</Tag>
                  )
                )}
              </div>
            </div>

            {(item.is_essential || item.is_open_to_used) && (
              <div className="flex w-full min-w-0 gap-2.5 flex-wrap">
                {item.is_essential && (
                  <Tag variant="most-wanted">Most wanted</Tag>
                )}
                {item.is_open_to_used && (
                  <UsedConditionTag condition={item.minimum_condition} />
                )}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              {item.price && (
                <span className="text-sm font-semibold">
                  {formatPrice(item.price)}
                </span>
              )}
              <span className="text-xs">{status.quantity}</span>
            </div>

            {/* Gifts of an item the owner bought go as money, not through the link. */}
            {linkedRegistries && !item.is_parent_purchased && (
              <StoreRegistryLine
                url={item.external_url}
                linkedStores={linkedRegistries.map((r) => r.store)}
              />
            )}

            {item.notes && (
              <p className="text-sm whitespace-pre-line">{item.notes}</p>
            )}

            {isOwner && otherLists && otherLists.length > 0 && (
              <p className="text-xs text-tertiary">
                Also on {otherLists.length <= 2 ? otherLists.join(" and ") : `${otherLists[0]} and ${otherLists.length - 1} more lists`}
              </p>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {item.external_url && (
              <Button
                variant="outline"
                className="card-action"
                onClick={() => window.open(item.external_url!, '_blank', 'noopener,noreferrer')}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  Shop
                </span>
              </Button>
            )}
            {!isFulfilled && !item.is_parent_purchased && (
              <Button
                variant="outline"
                className="card-action"
                onClick={handleToggleParentPurchased}
                disabled={toggling}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 shrink-0" />
                  {toggling ? "Saving..." : selfPurchaseButtonLabel}
                </span>
              </Button>
            )}
            {item.is_parent_purchased && (
              <Button
                variant="outline"
                className="card-action"
                onClick={handleToggleParentPurchased}
                disabled={toggling}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Undo2 className="h-4 w-4 shrink-0" />
                  Mark as unpurchased
                </span>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    {isOwner && (
      <EditItemDialog
        item={item}
        registryId={registryId}
        categories={categories}
        zipCode={zipCode}
        registryType={registryType}
        eventType={eventType as never}
        open={editOpen}
        onOpenChange={setEditOpen}
        linkedRegistries={linkedRegistries}
        storesWithRegistryLinks={storesWithRegistryLinks}
        otherLists={otherLists}
      />
    )}
    {purchases && purchases.length > 0 && (
      <GiftDetailModal
        open={giftDetailOpen}
        onOpenChange={setGiftDetailOpen}
        itemTitle={item.title}
        purchases={purchases}
      />
    )}
    </>
  );
}

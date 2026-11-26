"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sortIntoCategories, undoCategorySort, type CategorySortResult } from "@/lib/actions/categories";

interface SortIntoCategoriesButtonProps {
  registryId: string;
  /** How many of the list's items have no category. */
  count: number;
  /** Stories pass stand-ins, so nothing is saved. */
  sortAction?: typeof sortIntoCategories;
  undoAction?: typeof undoCategorySort;
}

/**
 * Next to the heading of a list's items with no category. It puts each one in
 * the category that fits it best, adding the categories the list doesn't
 * have yet (src/lib/actions/categories.ts). A message then says what it did,
 * with an Undo button.
 */
export function SortIntoCategoriesButton({
  registryId,
  count,
  sortAction = sortIntoCategories,
  undoAction = undoCategorySort,
}: SortIntoCategoriesButtonProps) {
  const [sorting, setSorting] = useState(false);
  if (count === 0) return null;

  const sort = async () => {
    setSorting(true);
    const result: CategorySortResult = await sortAction(registryId).catch(() => ({ error: "Not sorted" }));
    setSorting(false);
    if (result.error) {
      toast.error("We couldn't sort the items. Try again.");
      return;
    }
    const sorted = result.sorted ?? 0;
    const undo = result.undo;
    if (sorted === 0 || !undo) {
      toast(count === 1 ? "We couldn't tell which category this item fits." : "We couldn't tell which categories these items fit.", {
        description: "Choose one on each item instead.",
      });
      return;
    }
    const added = result.added ?? 0;
    const left = count - sorted;
    const parts = [
      added === 0 ? null : added === 1 ? "Added 1 new category." : `Added ${added} new categories.`,
      left === 0 ? null : left === 1 ? "1 item didn't fit one." : `${left} items didn't fit one.`,
    ].filter(Boolean);
    toast.success(sorted === 1 ? "Sorted 1 item into a category" : `Sorted ${sorted} items into categories`, {
      description: parts.join(" ") || undefined,
      duration: 10000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undone = await undoAction(registryId, undo).catch(() => ({ error: "Not undone" }));
          if (undone.error) toast.error("We couldn't undo the sort. Try again.");
          else toast("Put the items back.");
        },
      },
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={sort} disabled={sorting}>
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {sorting ? "Sorting…" : "Sort into categories"}
      </span>
    </Button>
  );
}

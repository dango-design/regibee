"use client";

import { useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { setFundsPosition } from "@/lib/actions/registry";
import type { FundsPosition } from "@/lib/gifts";

/**
 * The "…" menu by a list's Gift Funds heading. It moves the funds above the
 * items or after them, on the owner's page and the guests'.
 */
export function FundsPositionMenu({
  registryId,
  position,
  action = setFundsPosition,
}: {
  registryId: string;
  position: FundsPosition;
  /** A stand-in for the server action. Stories pass one. */
  action?: typeof setFundsPosition;
}) {
  const [pending, startTransition] = useTransition();
  const next: FundsPosition = position === "top" ? "bottom" : "top";

  return (
    <RowActionsMenu
      label="Gift fund options"
      disabled={pending}
      actions={[
        next === "bottom"
          ? { id: "bottom", label: "Move after the items", icon: ArrowDown }
          : { id: "top", label: "Move above the items", icon: ArrowUp },
      ]}
      onAction={() =>
        startTransition(async () => {
          const { error } = await action(registryId, next);
          if (error) toast.error(error);
        })
      }
    />
  );
}

"use client";

import type { FC } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { cx } from "@/lib/utils/cx";

export interface RowAction {
  id: string;
  label: string;
  icon?: FC<{ className?: string }>;
  /** Shown in red, for an action that removes or blocks someone or deletes something. */
  destructive?: boolean;
}

/**
 * A "…" button at the end of a row in a list, such as a follower or a guest.
 * It holds the actions people rarely need, like Remove or Block, so they
 * don't show on every row and can't be clicked by accident. Keep the row's
 * main action as its own button beside it.
 *
 * A destructive choice should still ask before it runs. The menu only picks
 * the action; `onAction` gets its id.
 */
export function RowActionsMenu({
  label,
  actions,
  onAction,
  disabled = false,
  className,
}: {
  /** Read by screen readers, such as "More actions for Alex Kim". */
  label: string;
  actions: RowAction[];
  onAction: (id: string) => void;
  disabled?: boolean;
  /** Such as `card-action`, so a click on a clickable card opens the menu, not the card. */
  className?: string;
}) {
  if (actions.length === 0) return null;
  // Non-destructive actions first, then a line, then the destructive ones.
  const plain = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);
  return (
    <Dropdown.Root>
      <Button variant="ghost" size="icon" aria-label={label} disabled={disabled} className={cx("size-8 text-tertiary", className)}>
        <MoreHorizontal className="size-4" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="w-auto min-w-52 max-w-80">
        <Dropdown.Menu aria-label={label} selectionMode="none" onAction={(key) => onAction(String(key))}>
          {plain.map((a) => (
            <Dropdown.Item key={a.id} id={a.id} icon={a.icon} label={a.label} />
          ))}
          {plain.length > 0 && destructive.length > 0 && <Dropdown.Separator />}
          {destructive.map((a) => (
            <Dropdown.Item key={a.id} id={a.id} icon={a.icon} label={a.label} destructive />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

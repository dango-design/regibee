"use client";

import { useTransition } from "react";
import { Button as AriaButton, GridList, GridListItem, useDragAndDrop } from "react-aria-components";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ManagerAvatars } from "@/components/manager-avatars";
import { RegistryIcon } from "@/components/registry-icon";
import type { DashboardManager } from "@/lib/dashboard-page-types";
import { moveList } from "@/lib/list-order";
import { occasionTheme } from "@/lib/occasion-theme";
import type { PersonalEventType, RegistryType } from "@/lib/types";
import { cx } from "@/lib/utils/cx";

export interface OrderableList {
  id: string;
  title: string;
  registry_type: RegistryType;
  event_type: PersonalEventType | null;
  managers?: DashboardManager[];
}

export type SaveListOrder = (ids: string[]) => Promise<{ error?: string | null; success?: boolean } | undefined | void>;

const ICON_BUTTON =
  "flex size-9 items-center justify-center rounded-full text-tertiary transition hover:bg-secondary hover:text-secondary disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/**
 * A list of lists to put in order: drag a row by its handle, or move it with
 * its arrows (the keyboard works too). Each change saves straight away, and
 * goes back if it doesn't save. The My registries tab uses it for the
 * person's own order, and the Account page for their profile's.
 */
export function ListOrderEditor({
  lists,
  order,
  onOrderChange,
  save,
  label,
}: {
  lists: OrderableList[];
  /** The ids, in the order shown. The parent keeps it, so its cards follow. */
  order: string[];
  onOrderChange: (order: string[]) => void;
  save: SaveListOrder;
  /** Names the list for screen readers, like "Order of your lists". */
  label: string;
}) {
  const [, startTransition] = useTransition();
  const byId = new Map(lists.map((list) => [list.id, list]));
  const shown = order.map((id) => byId.get(id)).filter((list): list is OrderableList => Boolean(list));

  const commit = (next: string[]) => {
    const before = order;
    onOrderChange(next);
    startTransition(async () => {
      const result = await save(next);
      if (result && result.error) {
        onOrderChange(before);
        toast.error(result.error);
      }
    });
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": byId.get(String(key))?.title ?? "" })),
    onReorder(event) {
      const moving = [...event.keys].map(String);
      const rest = order.filter((id) => !moving.includes(id));
      let index = rest.indexOf(String(event.target.key));
      if (index < 0) return;
      if (event.target.dropPosition === "after") index += 1;
      rest.splice(index, 0, ...moving);
      commit(rest);
    },
  });

  return (
    <GridList
      aria-label={label}
      items={shown}
      // Rows are cached by item. Each row's arrows depend on its place, so
      // draw them again when the order changes.
      dependencies={[order.join(",")]}
      dragAndDropHooks={dragAndDropHooks}
      className="flex flex-col gap-2"
    >
      {(list) => {
        const index = order.indexOf(list.id);
        const theme = occasionTheme(list.registry_type, list.event_type);
        return (
          <GridListItem
            id={list.id}
            textValue={list.title}
            className={({ isDragging, isFocusVisible }) =>
              cx(
                "flex items-center gap-2 rounded-2xl border border-secondary bg-primary py-2 pr-2 pl-1 shadow-xs outline-none",
                isDragging && "opacity-50",
                isFocusVisible && "ring-2 ring-focus-ring",
              )
            }
          >
            <AriaButton slot="drag" aria-label={`Drag ${list.title}`} className={cx(ICON_BUTTON, "cursor-grab")}>
              <GripVertical aria-hidden="true" className="size-4.5" />
            </AriaButton>
            <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", theme.bg)}>
              <RegistryIcon
                registryType={list.registry_type}
                eventType={list.event_type}
                className={cx("size-4.5", theme.icon)}
              />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-primary">{list.title}</span>
            <ManagerAvatars managers={list.managers ?? []} className="shrink-0" />
            <AriaButton
              aria-label={`Move ${list.title} up`}
              isDisabled={index <= 0}
              onPress={() => commit(moveList(order, list.id, -1))}
              className={ICON_BUTTON}
            >
              <ArrowUp aria-hidden="true" className="size-4.5" />
            </AriaButton>
            <AriaButton
              aria-label={`Move ${list.title} down`}
              isDisabled={index >= order.length - 1}
              onPress={() => commit(moveList(order, list.id, 1))}
              className={ICON_BUTTON}
            >
              <ArrowDown aria-hidden="true" className="size-4.5" />
            </AriaButton>
          </GridListItem>
        );
      }}
    </GridList>
  );
}

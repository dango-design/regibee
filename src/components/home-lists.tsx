"use client";

import { useState } from "react";
import { DashboardRegistryCard } from "@/components/dashboard-registry-card";
import { HomeSection } from "@/components/home-section";
import { ListOrderEditor, type SaveListOrder } from "@/components/list-order-editor";
import { orderLists } from "@/lib/list-order";
import { cx } from "@/lib/utils/cx";
import type { HomeList } from "@/components/dashboard-home";

/**
 * "Your lists" on the My registries tab: every list the person owns or helps
 * manage, in their own order. Reorder swaps the cards for a list to drag or
 * move with arrows, and Done brings the cards back in the new order.
 */
export function HomeLists({
  lists,
  save,
  today,
  basePath,
  gridClassName,
}: {
  lists: HomeList[];
  /** Saves the new order. The demo passes one that saves nothing. */
  save: SaveListOrder;
  /** YYYY-MM-DD, for the cards' countdowns. */
  today: string;
  /** Put in front of every link. The demo passes "/demo". */
  basePath: string;
  gridClassName: string;
}) {
  const [order, setOrder] = useState(() => lists.map((list) => list.id));
  const [reordering, setReordering] = useState(false);
  // A new list from the server, or one taken away, follows the saved order.
  const shown = orderLists(lists, order);

  return (
    <HomeSection
      id="your-lists"
      title="Your lists"
      action={
        lists.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setOrder(shown.map((list) => list.id));
              setReordering((value) => !value);
            }}
            className={cx(
              "rounded-full px-3 py-1 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
              reordering
                ? "bg-brand-solid text-primary_on-brand hover:bg-brand-solid_hover"
                : "text-brand-tertiary hover:bg-brand-primary",
            )}
          >
            {reordering ? "Done" : "Reorder"}
          </button>
        )
      }
    >
      {reordering ? (
        <div className="max-w-2xl">
          <ListOrderEditor
            lists={shown}
            order={shown.map((list) => list.id)}
            onOrderChange={setOrder}
            save={save}
            label="Order of your lists"
          />
        </div>
      ) : (
        <div className={gridClassName}>
          {shown.map((list) => (
            <DashboardRegistryCard
              key={list.id}
              title={list.title}
              registryType={list.registry_type}
              eventType={list.event_type}
              eventDate={list.event_date}
              today={today}
              totalItems={list.totalItems}
              fulfilledItems={list.fulfilledItems}
              progress={list.progress}
              giftsThisWeek={list.giftsThisWeek}
              manageHref={`${basePath}/dashboard/registry/${list.id}`}
              photoUrl={list.photo_url}
              isPrivate={list.is_private}
              reservationsHidden={list.reservationsHidden}
              managers={list.managers}
              headingLevel={3}
            />
          ))}
        </div>
      )}
    </HomeSection>
  );
}

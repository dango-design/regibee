"use client";

import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventDetails } from "@/lib/events";

export type BannerEvent = Pick<EventDetails, "id" | "title" | "event_date" | "event_type"> & {
  slug?: string;
  /**
   * Whether the viewer hosts it. Hosts open the event's dashboard. Anyone
   * else sees the guest page, and can unlink this registry. Left out, it
   * counts as hosted.
   */
  canManage?: boolean;
  /**
   * A guest added this registry to the event as their wishlist, and no host
   * linked it. It comes off on that guest's RSVP, so there's no Unlink button.
   */
  guestList?: boolean;
};

function planHref(registryId: string, basePath: string) {
  return `${basePath}/dashboard/events/new?registry=${registryId}`;
}

/**
 * The quiet "Plan an event" button in a registry page's header. The page
 * shows it once the owner has dismissed the "Planning a party?" part of the
 * card under the title (OwnerListTop), so planning an event is still one
 * click away.
 */
export function PlanEventButton({ registryId, basePath = "" }: { registryId: string; basePath?: string }) {
  return (
    <Button variant="ghost" asChild>
      <Link href={planHref(registryId, basePath)}>
        <span className="inline-flex items-center gap-1.5">
          <CalendarPlus className="h-4 w-4 shrink-0" />
          Plan an event
        </span>
      </Link>
    </Button>
  );
}

"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFollow, type FollowButtonState } from "@/components/follow-button";
import type { cancelFollow, requestFollow } from "@/lib/actions/follows";
import { initialsFor } from "@/lib/initials";

export interface OwnerChipProps {
  /** The owner's name, as on their profile. */
  name: string;
  /** Their profile page. */
  path: string;
  /** The id from their profile link, for following them. */
  publicId: string;
  /**
   * How the viewer follows them. Null when the viewer is the owner, who gets
   * the chip alone.
   */
  state: FollowButtonState | null;
  /** Where logging in comes back to. */
  returnTo: string;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
  /** Stand-ins for the follow server actions, for stories and the demo. */
  requestAction?: typeof requestFollow;
  cancelAction?: typeof cancelFollow;
}

/**
 * Who shared a wishlist: their initials and name, linking to their profile.
 * A Follow button sits beside it only while there's something to do. Once
 * the viewer follows them, "Following" shows inside the chip as a plain fact:
 * unfollowing is rare, and their profile page still offers it.
 */
export function OwnerChip({
  name,
  path,
  publicId,
  state,
  returnTo,
  basePath = "",
  requestAction,
  cancelAction,
}: OwnerChipProps) {
  const follow = useFollow({
    publicId,
    name,
    state: state ?? "none",
    requestAction,
    cancelAction,
  });
  const current = state === null ? null : follow.state;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      <Link
        href={path}
        className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-brand-200 bg-primary py-0 pr-3.5 pl-1 text-sm font-semibold text-primary transition-colors hover:border-brand-300"
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700"
        >
          {initialsFor(name)}
        </span>
        <span className="truncate">{name}</span>
        {current === "approved" && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-500">
            <Check className="size-3.5" aria-hidden="true" />
            Following
          </span>
        )}
      </Link>

      {current === "none" && (
        <Button size="sm" onClick={follow.toggle} disabled={follow.busy}>
          <span className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            Follow<span className="sr-only"> {name}</span>
          </span>
        </Button>
      )}
      {current === "signed-out" && (
        <Button size="sm" asChild>
          <Link href={`/login?redirect=${encodeURIComponent(returnTo)}`}>
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              Follow<span className="sr-only"> {name}</span>
            </span>
          </Link>
        </Button>
      )}
      {current === "pending" && (
        <span className="text-sm text-tertiary">
          Requested ·{" "}
          <button
            type="button"
            onClick={follow.toggle}
            disabled={follow.busy}
            aria-label={`Withdraw your request to follow ${name}`}
            className="cursor-pointer font-medium text-tertiary underline underline-offset-2 hover:text-secondary disabled:cursor-default disabled:opacity-50"
          >
            Withdraw
          </button>
        </span>
      )}
      {current === "blocked" && (
        <span className="text-sm text-tertiary">
          You blocked {name} ·{" "}
          <Link
            href={`${basePath}/dashboard/account#blocked`}
            className="font-medium text-tertiary underline underline-offset-2 hover:text-secondary"
          >
            Unblock
          </Link>
        </span>
      )}
      {follow.error && <p className="basis-full text-xs text-error-primary">{follow.error}</p>}
      {follow.dialog}
    </div>
  );
}

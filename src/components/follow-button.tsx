"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { SwitchHorizontal01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { cancelFollow, requestFollow } from "@/lib/actions/follows";

export type FollowButtonState = "signed-out" | "none" | "pending" | "approved" | "blocked";

/** The states a signed-in viewer can change by clicking the button. */
export type FollowToggleState = "none" | "pending" | "approved";

/** Stand-ins for the follow server actions, for stories and the demo. */
export interface FollowActions {
  requestAction?: typeof requestFollow;
  cancelAction?: typeof cancelFollow;
}

/**
 * Follow state for one person, and the click that changes it. FollowButton
 * uses it, and so does the people search, which lays out the hint itself.
 *
 * Following happens on the click. Withdrawing a request or unfollowing asks
 * first, in `dialog`, which the caller must render. The dialog stays open
 * while the action runs and shows its error if it fails.
 */
export function useFollow<State extends FollowButtonState>({
  publicId,
  name,
  state: initialState,
  requestAction = requestFollow,
  cancelAction = cancelFollow,
}: {
  publicId: string;
  name: string;
  state: State;
  requestAction?: typeof requestFollow;
  cancelAction?: typeof cancelFollow;
}) {
  const [state, setState] = useState<State | FollowToggleState>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // What the dialog asks. It's kept after the dialog closes, so its words
  // don't change while it fades out.
  const [asking, setAsking] = useState<"withdraw" | "unfollow">("unfollow");
  const [askOpen, setAskOpen] = useState(false);
  const [askError, setAskError] = useState("");

  const follow = async () => {
    setBusy(true);
    setError("");
    const result = await requestAction(publicId);
    if (result?.error) {
      setError(result.error);
    } else {
      setState("pending");
    }
    setBusy(false);
  };

  const cancel = async () => {
    setBusy(true);
    setAskError("");
    const result = await cancelAction(publicId);
    setBusy(false);
    if (result?.error) {
      setAskError(result.error);
      return;
    }
    setAskOpen(false);
    setState("none");
  };

  const toggle = () => {
    if (state === "none") {
      void follow();
    } else if (state === "pending" || state === "approved") {
      setError("");
      setAskError("");
      setAsking(state === "pending" ? "withdraw" : "unfollow");
      setAskOpen(true);
    }
  };

  const dialog = (
    <ConfirmActionDialog
      open={askOpen}
      onOpenChange={setAskOpen}
      title={asking === "withdraw" ? `Withdraw your request to follow ${name}?` : `Unfollow ${name}?`}
      description={
        asking === "withdraw"
          ? "You can ask again later from their profile."
          : "You'll stop seeing their private registries."
      }
      confirmLabel={asking === "withdraw" ? "Withdraw" : "Unfollow"}
      destructive={asking === "unfollow"}
      working={busy}
      error={askError}
      onConfirm={cancel}
    />
  );

  return { state, busy, error, toggle, dialog };
}

/**
 * Follow, Requested or Following, for a signed-in viewer. "Follow back" when
 * the person already follows the viewer.
 */
export function FollowToggle({
  state,
  busy,
  onClick,
  followsYou = false,
}: {
  state: FollowToggleState;
  busy: boolean;
  onClick: () => void;
  followsYou?: boolean;
}) {
  return (
    <Button size="sm" variant={state === "none" ? "default" : "outline"} onClick={onClick} disabled={busy}>
      {state === "none" ? (followsYou ? "Follow back" : "Follow") : state === "pending" ? "Requested" : "Following"}
    </Button>
  );
}

/**
 * Shows that the viewer and this person are friends: they follow each other,
 * with both follows approved. Friends is also a choice for who sees a list on
 * a profile (PROFILE_AUDIENCE in src/lib/list-access.ts), so the badge uses
 * the same word. It said "Mutual" before that choice existed.
 */
export function MutualBadge() {
  return (
    <span
      title="You follow each other"
      className="inline-flex shrink-0 items-center gap-1 self-center rounded-full bg-brand-primary px-2 py-0.5 text-xs font-medium text-brand-secondary"
    >
      <SwitchHorizontal01 aria-hidden="true" className="size-3" />
      Friends
    </span>
  );
}

/**
 * One tap to follow back someone who follows you. Once both follows are
 * approved, this shows the Friends badge instead. Following back is a request
 * like any other: the other person approves it.
 */
export function FollowBackButton({
  publicId,
  name,
  status: initialStatus,
  requestAction = requestFollow,
  onFollowed,
}: {
  publicId: string;
  name: string;
  /** How the viewer follows this person now: null when they don't. */
  status: "pending" | "approved" | null;
  requestAction?: typeof requestFollow;
  /** Called once the request is sent, so a list can show it too. */
  onFollowed?: () => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (status === "approved") {
    return <MutualBadge />;
  }
  if (status === "pending") {
    return <span className="self-center text-sm text-tertiary">Requested</span>;
  }

  const followBack = async () => {
    setBusy(true);
    setError("");
    const result = await requestAction(publicId);
    if (result?.error) {
      setError(result.error);
    } else {
      setStatus("pending");
      onFollowed?.();
    }
    setBusy(false);
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size="sm" onClick={followBack} disabled={busy}>
        Follow back<span className="sr-only"> {name}</span>
      </Button>
      {error && <span className="text-xs text-error-primary">{error}</span>}
    </span>
  );
}

/**
 * Goes after the "waiting for approval" hint, because nothing on the
 * Requested button says that clicking it withdraws the request. It runs the
 * same toggle, so it asks first too.
 */
export function WithdrawRequest({
  name,
  busy,
  onClick,
}: {
  name: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={`Withdraw your request to follow ${name}`}
      className="cursor-pointer font-medium text-brand-tertiary hover:underline disabled:cursor-default disabled:opacity-50"
    >
      Withdraw
    </button>
  );
}

export function FollowButton({
  publicId,
  name,
  state: initialState,
  returnTo,
  requestAction,
  cancelAction,
  followsYou = false,
  basePath = "",
}: {
  /** The id from the person's profile link. */
  publicId: string;
  /** The person's name, for the hints under the button. */
  name: string;
  state: FollowButtonState;
  /** Where to come back to after logging in. */
  returnTo: string;
  requestAction?: typeof requestFollow;
  cancelAction?: typeof cancelFollow;
  /** The person follows the viewer, with the viewer's approval. */
  followsYou?: boolean;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
}) {
  const { state, busy, error, toggle, dialog } = useFollow({
    publicId,
    name,
    state: initialState,
    requestAction,
    cancelAction,
  });

  if (state === "signed-out") {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button size="sm" asChild>
          <Link href={`/login?redirect=${encodeURIComponent(returnTo)}`}>Follow</Link>
        </Button>
        <p className="text-xs text-tertiary">Log in to ask to follow {name}.</p>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button size="sm" variant="outline" disabled>
          Blocked
        </Button>
        <p className="text-xs text-tertiary">
          You blocked {name}.{" "}
          <Link href={`${basePath}/dashboard/account#blocked`} className="font-medium text-brand-tertiary hover:underline">
            Unblock
          </Link>
        </p>
      </div>
    );
  }

  const hint = {
    none: followsYou ? `${name} follows you. They approve every follower.` : `${name} approves every follower.`,
    pending: `Waiting for ${name} to approve.`,
    approved: followsYou
      ? "You follow each other."
      : `You can see ${name}'s private registries.`,
  }[state];

  return (
    <div className="flex flex-col items-center gap-1">
      <FollowToggle state={state} busy={busy} onClick={toggle} followsYou={followsYou} />
      <p className="text-xs text-tertiary">
        {hint}
        {state === "pending" && (
          <>
            {" "}
            <WithdrawRequest name={name} busy={busy} onClick={toggle} />
          </>
        )}
      </p>
      {error && <p className="text-xs text-error-primary">{error}</p>}
      {dialog}
    </div>
  );
}

/**
 * Follow, on one row of a guest list: the host's list on an event's manage
 * page, and everyone's wishlists on the event's own page. It's small, with
 * no hint under it, since a row has little room. Like every follow, it's a
 * request the other person approves.
 *
 * Once the viewer follows the guest it says so as a plain fact, or shows the
 * Friends badge: unfollowing is rare, and the guest's profile still offers it.
 */
export function GuestFollowButton({
  publicId,
  name,
  state: initialState,
  followsYou = false,
  requestAction,
  cancelAction,
  className,
}: {
  /** The id from the guest's profile link. */
  publicId: string;
  name: string;
  state: FollowToggleState;
  /** The guest follows the viewer, with the viewer's approval. */
  followsYou?: boolean;
  requestAction?: typeof requestFollow;
  cancelAction?: typeof cancelFollow;
  className?: string;
}) {
  const { state, busy, error, toggle, dialog } = useFollow({
    publicId,
    name,
    state: initialState,
    requestAction,
    cancelAction,
  });

  return (
    <span className={`inline-flex shrink-0 flex-col items-start gap-1 ${className ?? ""}`}>
      {state === "approved" ? (
        followsYou ? (
          <MutualBadge />
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-tertiary">
            <Check aria-hidden="true" className="size-3.5" />
            Following
          </span>
        )
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="max-sm:min-h-11"
          onClick={toggle}
          disabled={busy}
          title={state === "pending" ? `Waiting for ${name} to approve` : undefined}
        >
          {state === "pending" ? (
            "Requested"
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
              {followsYou ? "Follow back" : "Follow"}
            </span>
          )}
          <span className="sr-only"> {name}</span>
        </Button>
      )}
      {error && <span className="max-w-48 text-xs text-error-primary">{error}</span>}
      {dialog}
    </span>
  );
}

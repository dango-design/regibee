"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, UserMinus, UserX } from "lucide-react";
import { SECTION_SCROLL_MARGIN, SectionTitle } from "@/components/section-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { FollowBackButton, MutualBadge } from "@/components/follow-button";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu, type RowAction } from "@/components/row-actions-menu";
import {
  approveFollower,
  blockUser,
  cancelFollow,
  removeFollower,
  requestFollow,
  unblockUser,
} from "@/lib/actions/follows";
import type { FollowPerson, PersonSummary } from "@/lib/follows";
import { displayName, profilePath } from "@/lib/profile-link";

function PersonLabel({ person, basePath }: { person: PersonSummary; basePath: string }) {
  return (
    <Link
      href={`${basePath}${profilePath(person)}`}
      className="min-w-0 break-words text-sm font-medium text-primary hover:underline"
    >
      {displayName(person)}
    </Link>
  );
}

function PersonRow({
  person,
  actions,
  basePath,
  mutual = false,
}: {
  person: PersonSummary;
  actions: React.ReactNode;
  basePath: string;
  /** The account and this person follow each other. */
  mutual?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* At least 8rem, so on a narrow screen the buttons wrap under the name
          instead of squeezing it. Rare actions, like Remove and Block, are in
          the row's "…" menu, not buttons, so they can't be clicked by accident. */}
      <div className="flex min-w-0 grow basis-32 flex-wrap items-center gap-x-2 gap-y-1">
        <PersonLabel person={person} basePath={basePath} />
        {mutual && <MutualBadge />}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

/** The cards, so an error shows in the one whose button caused it. */
type CardName = "requests" | "followers" | "following" | "blocked";

/** An action from a row's "…" menu, waiting for the person to confirm it. */
type Asking = { kind: "block" | "remove" | "unfollow" | "withdraw"; person: PersonSummary };

const blockChoice: RowAction = { id: "block", label: "Block", icon: Ban, destructive: true };

/**
 * The Account page's follow requests, followers, people followed and blocked
 * people, one card each. Each card is a section of the page, with its own id
 * that the page's navigation links to.
 */
export function FollowLists({
  requests: initialRequests,
  followers: initialFollowers,
  following: initialFollowing,
  blocked: initialBlocked = [],
  approveAction = approveFollower,
  removeAction = removeFollower,
  cancelAction = cancelFollow,
  blockAction = blockUser,
  unblockAction = unblockUser,
  followAction = requestFollow,
  basePath = "",
  onCountsChange,
}: {
  requests: FollowPerson[];
  followers: FollowPerson[];
  following: FollowPerson[];
  blocked?: PersonSummary[];
  approveAction?: typeof approveFollower;
  removeAction?: typeof removeFollower;
  cancelAction?: typeof cancelFollow;
  blockAction?: typeof blockUser;
  unblockAction?: typeof unblockUser;
  /** Follows someone back. */
  followAction?: typeof requestFollow;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
  /** Hears how many requests are waiting and how many people are blocked, as they change. */
  onCountsChange?: (counts: { requests: number; blocked: number }) => void;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [followers, setFollowers] = useState(initialFollowers);
  const [following, setFollowing] = useState(initialFollowing);
  const [blocked, setBlocked] = useState(initialBlocked);
  // Requests approved on this page. They stay in the requests card with a
  // Follow back button, since that's where the approver is looking.
  const [justApproved, setJustApproved] = useState<FollowPerson[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // An error shows in the card whose button caused it, next to that button.
  const [error, setError] = useState<{ card: CardName; message: string } | null>(null);

  useEffect(() => {
    onCountsChange?.({ requests: requests.length, blocked: blocked.length });
  }, [onCountsChange, requests.length, blocked.length]);

  const act = async (
    key: string,
    card: CardName,
    action: () => ReturnType<typeof approveFollower>,
    onDone: () => void,
  ) => {
    setBusy(key);
    setError(null);
    const result = await action();
    if (result?.error) {
      setError({ card, message: result.error });
    } else {
      onDone();
    }
    setBusy(null);
  };

  const errorIn = (card: CardName) =>
    error?.card === card && (
      <p role="alert" className="text-sm text-error-primary">
        {error.message}
      </p>
    );

  const without = <T extends PersonSummary>(list: T[], person: PersonSummary) =>
    list.filter((p) => p.public_id !== person.public_id);

  // The menu action waiting for confirmation, and its error. Its dialog shows
  // the error, since the dialog stays open until the action is done.
  const [asking, setAsking] = useState<Asking | null>(null);
  const [working, setWorking] = useState(false);
  const [askError, setAskError] = useState("");

  const ask = (kind: Asking["kind"], person: PersonSummary) => {
    setError(null);
    setAskError("");
    setAsking({ kind, person });
  };

  const confirmAsked = async () => {
    if (!asking) return;
    const { kind, person } = asking;
    setWorking(true);
    setAskError("");
    const result =
      kind === "block"
        ? await blockAction(person.public_id)
        : kind === "remove"
          ? await removeAction(person.public_id)
          : await cancelAction(person.public_id);
    setWorking(false);
    if (result?.error) {
      setAskError(result.error);
      return;
    }
    setAsking(null);
    if (kind === "block") {
      setRequests((list) => without(list, person));
      setJustApproved((list) => without(list, person));
      setFollowers((list) => without(list, person));
      setFollowing((list) => without(list, person));
      setBlocked((list) => [{ public_id: person.public_id, full_name: person.full_name }, ...without(list, person)]);
    } else if (kind === "remove") {
      setFollowers((list) => without(list, person));
      setJustApproved((list) => without(list, person));
    } else {
      setFollowing((list) => without(list, person));
    }
  };

  const askedName = asking ? displayName(asking.person) : "";
  const dialog = !asking
    ? null
    : asking.kind === "block"
      ? {
          title: `Block ${askedName}?`,
          description:
            "They'll be removed from your followers and the people you follow. They won't be able to ask to follow you or find you in search. You can unblock them later.",
          confirmLabel: "Block",
        }
      : asking.kind === "remove"
        ? {
            title: `Remove ${askedName} from your followers?`,
            description:
              "They'll stop seeing the registries you show to followers on your profile, and your birthday. They can ask to follow you again.",
            confirmLabel: "Remove",
          }
        : asking.kind === "withdraw"
          ? {
              title: `Withdraw your request to follow ${askedName}?`,
              description: "You can ask again later from their profile.",
              confirmLabel: "Withdraw",
            }
          : {
              title: `Unfollow ${askedName}?`,
              description: "You'll stop seeing the registries they show to followers on their profile.",
              confirmLabel: "Unfollow",
            };

  // The "…" menu at the end of a row.
  const rowMenu = (person: PersonSummary, actions: RowAction[]) => (
    <RowActionsMenu
      label={`More actions for ${displayName(person)}`}
      actions={actions}
      disabled={busy !== null}
      onAction={(id) => ask(id as Asking["kind"], person)}
    />
  );

  // How the account follows this person: null when it doesn't.
  const followingStatus = (person: PersonSummary) =>
    following.find((p) => p.public_id === person.public_id)?.status ?? null;

  // Both follows approved. `followers` holds only approved follows.
  const isMutual = (person: PersonSummary) =>
    followingStatus(person) === "approved" && followers.some((p) => p.public_id === person.public_id);

  // Keyed by status, so the button starts over when the status changes
  // somewhere else on the page, like after unfollowing.
  const followBack = (person: PersonSummary) => (
    <FollowBackButton
      key={followingStatus(person) ?? "none"}
      publicId={person.public_id}
      name={displayName(person)}
      status={followingStatus(person)}
      requestAction={followAction}
      onFollowed={() =>
        setFollowing((list) => [
          { public_id: person.public_id, full_name: person.full_name, status: "pending" },
          ...without(list, person),
        ])
      }
    />
  );

  return (
    <>
      {/* Always here, even with nothing waiting: links to follow requests
          land on this card, and it says so when there are none. */}
      <Card id="follow-requests" className={SECTION_SCROLL_MARGIN}>
        <CardHeader>
          <SectionTitle sectionId="follow-requests">Follow requests</SectionTitle>
          <CardDescription>
            People you approve can see the registries you show to followers on your profile, and your birthday.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.length + justApproved.length === 0 && (
            <p className="text-sm text-tertiary">
              No follow requests right now. When someone asks to follow you, you can approve or decline them here.
            </p>
          )}
          {justApproved.map((person) => (
            <PersonRow
              basePath={basePath}
              key={person.public_id}
              person={person}
              mutual={isMutual(person)}
              actions={
                <>
                  <span className="self-center text-sm text-tertiary">Approved</span>
                  {!isMutual(person) && followBack(person)}
                </>
              }
            />
          ))}
          {requests.map((person) => (
            <PersonRow
              basePath={basePath}
              key={person.public_id}
              person={person}
              actions={
                <>
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() =>
                      act(`approve-${person.public_id}`, "requests", () => approveAction(person.public_id), () => {
                        setRequests(without(requests, person));
                        setJustApproved((list) => [...list, { ...person, status: "approved" }]);
                        setFollowers([{ ...person, status: "approved" }, ...followers]);
                      })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      act(`decline-${person.public_id}`, "requests", () => removeAction(person.public_id), () =>
                        setRequests(without(requests, person)),
                      )
                    }
                  >
                    Decline
                  </Button>
                  {rowMenu(person, [blockChoice])}
                </>
              }
            />
          ))}
          {errorIn("requests")}
        </CardContent>
      </Card>

      <Card id="followers" className={SECTION_SCROLL_MARGIN}>
        <CardHeader>
          <SectionTitle sectionId="followers">Followers</SectionTitle>
          <CardDescription>
            They can see the registries you show to followers on your profile, and your birthday. Follow them
            back to see theirs. Friends are the ones you follow too: they also see the registries you show only
            to friends.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {followers.length === 0 ? (
            <p className="text-sm text-tertiary">
              No followers yet. Share your profile link, or let people find you in search.
            </p>
          ) : (
            followers.map((person) => (
              <PersonRow
                basePath={basePath}
                key={person.public_id}
                person={person}
                mutual={isMutual(person)}
                actions={
                  <>
                    {!isMutual(person) && followBack(person)}
                    {rowMenu(person, [
                      { id: "remove", label: "Remove follower", icon: UserMinus, destructive: true },
                      blockChoice,
                    ])}
                  </>
                }
              />
            ))
          )}
          {errorIn("followers")}
        </CardContent>
      </Card>

      <Card id="following" className={SECTION_SCROLL_MARGIN}>
        <CardHeader>
          <SectionTitle sectionId="following">Following</SectionTitle>
          <CardDescription>
            People whose registries you follow. See them all on your{" "}
            <Link href={`${basePath}/dashboard/following`} className="font-medium text-brand-tertiary hover:underline">
              Following page
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {following.length === 0 ? (
            <p className="text-sm text-tertiary">
              You&apos;re not following anyone yet. Find people on your{" "}
              <Link href={`${basePath}/dashboard/following`} className="font-medium text-brand-tertiary hover:underline">
                Following page
              </Link>
              , or open someone&apos;s profile link and tap Follow.
            </p>
          ) : (
            following.map((person) => (
              <PersonRow
                basePath={basePath}
                key={person.public_id}
                person={person}
                mutual={isMutual(person)}
                actions={
                  <>
                    {person.status === "pending" && (
                      <span className="self-center text-sm text-tertiary">Requested</span>
                    )}
                    {rowMenu(person, [
                      person.status === "pending"
                        ? { id: "withdraw", label: "Withdraw request", icon: UserX }
                        : { id: "unfollow", label: "Unfollow", icon: UserX, destructive: true },
                    ])}
                  </>
                }
              />
            ))
          )}
          {errorIn("following")}
        </CardContent>
      </Card>

      {blocked.length > 0 && (
        <Card id="blocked" className={SECTION_SCROLL_MARGIN}>
          <CardHeader>
            <SectionTitle sectionId="blocked">Blocked</SectionTitle>
            <CardDescription>
              They can&apos;t ask to follow you or find you in search, and your profile is hidden from
              them while they&apos;re signed in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {blocked.map((person) => (
              <PersonRow
                basePath={basePath}
                key={person.public_id}
                person={person}
                actions={
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      act(`unblock-${person.public_id}`, "blocked", () => unblockAction(person.public_id), () =>
                        setBlocked(without(blocked, person)),
                      )
                    }
                  >
                    Unblock
                  </Button>
                }
              />
            ))}
            {errorIn("blocked")}
          </CardContent>
        </Card>
      )}

      {dialog && (
        <ConfirmActionDialog
          open
          onOpenChange={(open) => !open && setAsking(null)}
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirmLabel}
          destructive={asking?.kind !== "withdraw"}
          working={working}
          error={askError}
          onConfirm={confirmAsked}
        />
      )}
    </>
  );
}

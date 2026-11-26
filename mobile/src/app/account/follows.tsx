// Follow requests, followers, who you follow, and who you blocked: the
// website's FollowLists on the Account page (src/components/follow-lists.tsx),
// with the same actions and confirmations.

import { router, Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";

import type { FollowPerson, PersonSummary } from "@shared/people-page-types";
import { displayName, profilePath } from "@shared/profile-link";

import { Button, Card, Divider, ErrorState, haptic, LoadingState, Pill, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useAccountPage, useRunPeopleAction } from "@/lib/people-data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";

export default function FollowsScreen() {
  const theme = useTheme();
  const page = useAccountPage();
  const pull = usePullToRefresh(page.refetch);
  const { run } = useRunPeopleAction();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Requests approved here. They stay in the requests card with a Follow back
  // button, since that's where the approver is looking.
  const [justApproved, setJustApproved] = useState<FollowPerson[]>([]);
  const data = page.data;

  if (!data) {
    return page.isError ? <ErrorState message={errorMessage(page.error)} onRetry={() => page.refetch()} /> : <LoadingState />;
  }

  const { requests, followers, following, blocked } = data.follows;
  // How the account follows this person: undefined when it doesn't.
  const followingStatus = (person: PersonSummary) => following.find((p) => p.public_id === person.public_id)?.status;
  const isMutual = (person: PersonSummary) =>
    following.some((p) => p.public_id === person.public_id && p.status === "approved") &&
    followers.some((p) => p.public_id === person.public_id);

  async function act(key: string, action: string, publicId: string, onDone?: () => void) {
    setBusy(key);
    setError(null);
    try {
      await run(action, publicId);
      haptic("success");
      onDone?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const confirm = (title: string, button: string, onPress: () => void) =>
    Alert.alert(title, undefined, [
      { text: "Cancel", style: "cancel" },
      { text: button, style: "destructive", onPress },
    ]);

  const block = (person: PersonSummary) =>
    confirm(
      `Block ${displayName(person)}? You'll stop following each other, and they can't ask to follow you.`,
      "Block",
      () =>
        act(`block-${person.public_id}`, "follows.blockUser", person.public_id, () =>
          setJustApproved((list) => list.filter((p) => p.public_id !== person.public_id))
        )
    );

  // Following back is a request like any other. While it waits it says
  // "Requested", as on the website.
  const followBack = (person: PersonSummary) =>
    followingStatus(person) === "pending" ? (
      <RowNote>Requested</RowNote>
    ) : followingStatus(person) ? null : (
      <Button
        title="Follow back"
        size="small"
        variant="secondary"
        disabled={busy !== null}
        onPress={() => act(`follow-${person.public_id}`, "follows.requestFollow", person.public_id)}
      />
    );

  const blockButton = (person: PersonSummary) => (
    <Button title="Block" size="small" variant="ghost" disabled={busy !== null} onPress={() => block(person)} />
  );

  return (
    <>
      <Stack.Screen options={{ title: "Follows" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            {...pull}
            tintColor={theme.tint}
          />
        }
      >
        {error ? (
          <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {/* Always here, even with nothing waiting, as on the website. */}
        <Card>
          <Text variant="title" style={{ fontSize: 20 }}>
            Follow requests
          </Text>
          <Text variant="footnote" tone="secondary">
            People you approve see your birthday and the lists you show followers.
          </Text>
          {requests.length + justApproved.length === 0 ? (
            <Text variant="footnote" tone="tertiary">
              No follow requests right now.
            </Text>
          ) : null}
          {justApproved.map((person) => (
            <PersonRow key={person.public_id} person={person} mutual={isMutual(person)}>
              <RowNote>Approved</RowNote>
              {isMutual(person) ? null : followBack(person)}
            </PersonRow>
          ))}
          {requests
            .filter((p) => !justApproved.some((a) => a.public_id === p.public_id))
            .map((person) => (
              <PersonRow key={person.public_id} person={person}>
                <Button
                  title="Approve"
                  size="small"
                  disabled={busy !== null}
                  onPress={() =>
                    act(`approve-${person.public_id}`, "follows.approveFollower", person.public_id, () =>
                      setJustApproved((list) => [...list, { ...person, status: "approved" }])
                    )
                  }
                />
                <Button
                  title="Decline"
                  size="small"
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => act(`decline-${person.public_id}`, "follows.removeFollower", person.public_id)}
                />
                {blockButton(person)}
              </PersonRow>
            ))}
        </Card>

        <Card>
          <Text variant="title" style={{ fontSize: 20 }}>
            Followers
          </Text>
          <Text variant="footnote" tone="secondary">
            They see your birthday and the lists you show followers. Friends, the ones you follow back, also see lists you
            show friends.
          </Text>
          {followers.length === 0 ? (
            <Text variant="footnote" tone="tertiary">
              No followers yet.
            </Text>
          ) : (
            followers.map((person) => (
              <PersonRow key={person.public_id} person={person} mutual={isMutual(person)}>
                {isMutual(person) ? null : followBack(person)}
                <Button
                  title="Remove"
                  size="small"
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() =>
                    confirm(
                      `Remove ${displayName(person)}? They'll stop seeing your private registries and your birthday.`,
                      "Remove",
                      () => act(`remove-${person.public_id}`, "follows.removeFollower", person.public_id)
                    )
                  }
                />
                {blockButton(person)}
              </PersonRow>
            ))
          )}
        </Card>

        <Card>
          <Text variant="title" style={{ fontSize: 20 }}>
            Following
          </Text>
          {following.length === 0 ? (
            <Text variant="footnote" tone="tertiary">
              You&apos;re not following anyone yet. Find people on your{" "}
              <Text variant="footnote" tone="tint" onPress={() => router.navigate("/following")}>
                Following page
              </Text>
              .
            </Text>
          ) : (
            following.map((person) => (
              <PersonRow
                key={person.public_id}
                person={person}
                mutual={isMutual(person)}
                detail={person.status === "pending" ? "Requested" : undefined}
              >
                <Button
                  title={person.status === "pending" ? "Withdraw" : "Unfollow"}
                  size="small"
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() =>
                    confirm(
                      person.status === "pending"
                        ? `Withdraw your request to follow ${displayName(person)}?`
                        : `Unfollow ${displayName(person)}? You'll stop seeing their private registries.`,
                      person.status === "pending" ? "Withdraw" : "Unfollow",
                      () => act(`unfollow-${person.public_id}`, "follows.cancelFollow", person.public_id)
                    )
                  }
                />
              </PersonRow>
            ))
          )}
        </Card>

        {blocked.length > 0 ? (
          <Card>
            <Text variant="title" style={{ fontSize: 20 }}>
              Blocked
            </Text>
            <Text variant="footnote" tone="secondary">
              They can&apos;t follow you, find you in search, or see your profile while signed in.
            </Text>
            {blocked.map((person) => (
              <PersonRow key={person.public_id} person={person}>
                <Button
                  title="Unblock"
                  size="small"
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => act(`unblock-${person.public_id}`, "follows.unblockUser", person.public_id)}
                />
              </PersonRow>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}

/** A short word beside a row's buttons, such as "Approved" or "Requested". */
function RowNote({ children }: { children: string }) {
  return (
    <Text variant="footnote" tone="tertiary" style={{ alignSelf: "center" }}>
      {children}
    </Text>
  );
}

function PersonRow({
  person,
  mutual,
  detail,
  children,
}: {
  person: PersonSummary;
  mutual?: boolean;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Divider />
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
        <Text
          variant="subhead"
          style={{ fontWeight: "600", flexShrink: 1 }}
          accessibilityRole="link"
          onPress={() => openSite(profilePath(person))}
        >
          {displayName(person)}
        </Text>
        {mutual ? <Pill label="Friends" tone="success" /> : null}
        {detail ? (
          <Text variant="footnote" tone="tertiary">
            · {detail}
          </Text>
        ) : null}
      </View>
      {children ? <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>{children}</View> : null}
    </View>
  );
}

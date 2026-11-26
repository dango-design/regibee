// The step after a guest says they're coming to an everyone-gives-everyone
// event: add the wishlist the others will shop from. The website's
// RsvpWishlistStep (src/components/rsvp-wishlist-step.tsx), with the same
// choices and words, sending the website's events.saveEventWishlist.
//
// Signed in, the guest picks one of their lists or makes a new one. Signed
// out, a Regibee wishlist takes an account, so they make one or sign in, as
// on the website. The RSVP stays saved meanwhile, under their link.

import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { storeName } from "@shared/events";
import type { InvitationPageData, RsvpWishlistData } from "@shared/invitation-page-types";

import { Icon } from "@/components/icon";
import { Button, haptic, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { useRunEventAction } from "@/lib/events-data";
import { radius, spacing, useTheme } from "@/lib/theme";

import { useInvitationColors } from "./colors";
import { openInvitationLink } from "./sections";

type Choice = { registryId?: string; makeNew?: boolean; addRegistryId?: string; removeRegistryId?: string };

const ownListPath = (id: string) => `/dashboard/registry/${id}`;

export function WishlistStep({ page, wishlist, token }: { page: InvitationPageData; wishlist: RsvpWishlistData; token: string }) {
  const theme = useTheme();
  const colors = useInvitationColors(wishlist.themeColor, page.event.event_type);
  const { run } = useRunEventAction();
  const { demo, endDemo } = useSession();
  const { current, giftIdeas, more = [], account } = wishlist;
  const hasSomething = Boolean(current || giftIdeas);
  const [choosing, setChoosing] = useState(!hasSomething);
  const [adding, setAdding] = useState(false);
  // Which button is saving: a list's id, "new", or "remove:" and a list's id.
  const [busy, setBusy] = useState<string | null>(null);
  const [justMade, setJustMade] = useState(false);
  const [error, setError] = useState("");

  const lists = account?.lists ?? [];
  // Another list goes beside a Regibee wishlist.
  const canAddMore = Boolean(account && current?.title);
  const otherLists = lists.filter((list) => list.id !== current?.ownListId && !more.some((m) => m.id === list.id));
  // No fill, under a line, unless the host picked a color for the invitation.
  const box = colors.hostColor
    ? { backgroundColor: colors.fill, borderRadius: radius.md, padding: spacing.lg }
    : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: spacing.lg };
  const ink = colors.hostColor ? colors.ink : theme.tint;

  // The sign-in and sign-up screens open only signed out, so the demo ends first.
  function goToAccount(path: "/sign-in" | "/sign-up") {
    if (demo) endDemo();
    router.push(path);
  }

  async function save(choice: Choice, key: string) {
    setBusy(key);
    setError("");
    try {
      // The invitation reloads with the saved list once the action is done.
      await run("events.saveEventWishlist", { slug: page.slug, token, ...choice });
      haptic("success");
      setChoosing(false);
      setAdding(false);
      setJustMade(Boolean(choice.makeNew));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const heading = (title: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={[styles.circle, { backgroundColor: colors.hostColor ? theme.surface : theme.surfaceAlt }]}>
        <Icon name="gift" size={17} color={ink} />
      </View>
      <Text variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
    </View>
  );

  const listRow = (key: string, title: string, action: React.ReactNode) => (
    <View key={key} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text variant="callout" style={{ flex: 1, fontWeight: "600" }}>
        {title}
      </Text>
      {action}
    </View>
  );

  const errorLine = error ? (
    <Text variant="footnote" tone="danger" accessibilityRole="alert">
      {error}
    </Text>
  ) : null;

  if (!choosing && hasSomething) {
    return (
      <View style={[box, { gap: spacing.md }]}>
        {heading("Your wishlist")}
        <View style={{ gap: 4 }}>
          {current ? (
            <Text variant="footnote" tone="secondary">
              {current.title ?? `A list on ${storeName(current.url)}`}
            </Text>
          ) : (
            <Text variant="footnote" tone="secondary">
              No list, just gift ideas.
            </Text>
          )}
          {giftIdeas ? (
            <Text variant="footnote" tone="secondary">
              <Text variant="footnote" style={{ fontWeight: "600" }}>
                Gift ideas:{" "}
              </Text>
              {giftIdeas}
            </Text>
          ) : null}
          {justMade && current?.ownListId ? (
            <Text variant="footnote" tone="tertiary">
              Add a few things so everyone knows what to get you.
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {current?.ownListId ? (
            <Button
              title="Add things to your list"
              size="small"
              variant={justMade ? "primary" : "secondary"}
              onPress={() => openInvitationLink(ownListPath(current.ownListId!))}
            />
          ) : null}
          <Button title={current ? "Change" : "Add a wishlist"} size="small" variant="secondary" onPress={() => setChoosing(true)} />
        </View>

        {more.length > 0 || canAddMore ? (
          <View style={{ gap: spacing.sm }}>
            {more.length > 0 ? (
              <>
                <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                  Also on the invitation
                </Text>
                {more.map((list) =>
                  listRow(
                    list.id,
                    list.title,
                    <View style={{ flexDirection: "row", gap: spacing.xs }}>
                      {list.ownListId ? (
                        <Button
                          title="Open"
                          size="small"
                          variant="secondary"
                          accessibilityLabel={`Open ${list.title}`}
                          onPress={() => openInvitationLink(ownListPath(list.ownListId!))}
                        />
                      ) : null}
                      <Button
                        title="Take off"
                        size="small"
                        variant="ghost"
                        accessibilityLabel={`Take off ${list.title}`}
                        disabled={busy !== null && busy !== `remove:${list.id}`}
                        loading={busy === `remove:${list.id}`}
                        onPress={() => save({ removeRegistryId: list.id }, `remove:${list.id}`)}
                      />
                    </View>,
                  ),
                )}
              </>
            ) : null}

            {canAddMore && !adding ? (
              <View style={{ gap: 2 }}>
                <Button
                  title="Add another list"
                  icon="add"
                  size="small"
                  variant="ghost"
                  style={{ alignSelf: "flex-start" }}
                  disabled={busy !== null}
                  onPress={() => setAdding(true)}
                />
                {more.length === 0 ? (
                  <Text variant="footnote" tone="tertiary">
                    Like a list for your child.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {canAddMore && adding ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                  Add another of your lists
                </Text>
                {otherLists.length > 0 ? (
                  otherLists.map((list) =>
                    listRow(
                      list.id,
                      list.title,
                      <Button
                        title="Add this list"
                        size="small"
                        variant="secondary"
                        accessibilityLabel={`Add ${list.title}`}
                        disabled={busy !== null && busy !== list.id}
                        loading={busy === list.id}
                        onPress={() => save({ addRegistryId: list.id }, list.id)}
                      />,
                    ),
                  )
                ) : (
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="footnote" tone="tertiary">
                      You have no other lists to add. Make a new list, then come back here to add it.
                    </Text>
                    <Button title="Make a new list" size="small" variant="secondary" style={{ alignSelf: "flex-start" }} onPress={() => router.push("/new")} />
                  </View>
                )}
                <Button
                  title="Cancel"
                  size="small"
                  variant="ghost"
                  style={{ alignSelf: "flex-start" }}
                  disabled={busy !== null}
                  onPress={() => {
                    setAdding(false);
                    setError("");
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {errorLine}
      </View>
    );
  }

  return (
    <View style={[box, { gap: spacing.lg }]}>
      {heading(current ? "Change your wishlist" : "Now add your wishlist")}
      {account ? (
        <>
          {lists.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                Use one of your lists
              </Text>
              {lists.map((list) =>
                listRow(
                  list.id,
                  list.title,
                  current?.ownListId === list.id ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Icon name="check" size={14} color={theme.success} />
                      <Text variant="footnote" tone="success">
                        Linked
                      </Text>
                    </View>
                  ) : (
                    <Button
                      title="Use this list"
                      size="small"
                      variant="secondary"
                      accessibilityLabel={`Use ${list.title}`}
                      disabled={busy !== null && busy !== list.id}
                      loading={busy === list.id}
                      onPress={() => save({ registryId: list.id }, list.id)}
                    />
                  ),
                ),
              )}
            </View>
          ) : null}
          <View style={{ gap: spacing.xs }}>
            {/* With lists to pick from, picking one is the main thing to do, so
                making another is a quieter button. */}
            <Button
              title={lists.length > 0 ? "Make a new wishlist" : "Make my wishlist"}
              icon="add"
              size="medium"
              variant={lists.length > 0 ? "ghost" : "primary"}
              style={lists.length > 0 ? { alignSelf: "flex-start" } : undefined}
              disabled={busy !== null && busy !== "new"}
              loading={busy === "new"}
              onPress={() => save({ makeNew: true }, "new")}
            />
          </View>
        </>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Button title="Make a free wishlist" size="medium" onPress={() => goToAccount("/sign-up")} />
            <Button title="Log in" size="medium" variant="secondary" onPress={() => goToAccount("/sign-in")} />
          </View>
          <Text variant="footnote" tone="tertiary">
            Already have a Regibee list? Log in to pick it.
          </Text>
        </View>
      )}
      {errorLine}
      {hasSomething ? (
        <Button
          title="Keep my wishlist as it is"
          size="small"
          variant="ghost"
          style={{ alignSelf: "flex-start" }}
          disabled={busy !== null}
          onPress={() => {
            setChoosing(false);
            setError("");
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
});

// A group's page: its people, its gift exchange each year, its events and the
// lists shared with it. The website's GroupManager
// (src/components/group-manager.tsx), from the same loader.

import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";

import { formatShortEventDate, isEmail, parseGuestList } from "@shared/events";
import { emailLabel } from "@shared/guest-emails";

import { NavRow } from "@/components/nav-row";
import { Button, Card, Divider, ErrorState, Field, haptic, IconButton, LoadingState, Section, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useGroupPage, useRunEventAction } from "@/lib/events-data";
import { initials } from "@/lib/format";
import { SITE_URL } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const theme = useTheme();
  const page = useGroupPage(groupId);
  const { run } = useRunEventAction();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const pastePreview = useMemo(() => parseGuestList(pasted), [pasted]);
  const data = page.data;

  if (!data) {
    return page.isError ? <ErrorState message={errorMessage(page.error)} onRetry={() => page.refetch()} /> : <LoadingState />;
  }

  const { group, members, events, sharedLists } = data;
  const exchanges = events.filter((e) => e.hasExchange);
  // Newest first. One that hasn't drawn names yet is this year's.
  const current = exchanges[0] && !exchanges[0].drawn ? exchanges[0] : null;
  const lastExchange = exchanges.find((e) => e.drawn);

  async function attempt<R>(key: string, work: () => Promise<R>, done?: (result: R) => string | void) {
    setBusy(key);
    setNotice(null);
    try {
      const result = await work();
      haptic("success");
      const text = done?.(result);
      if (text) setNotice({ text, error: false });
      return result;
    } catch (e) {
      setNotice({ text: errorMessage(e), error: true });
      return null;
    } finally {
      setBusy(null);
    }
  }

  const addedText = (r: { added: number; alreadyListed: number }) =>
    `${r.added === 1 ? "Added 1 person" : `Added ${r.added} people`}${r.alreadyListed ? `. ${r.alreadyListed} already in the group.` : ""}`;

  function addOne() {
    if (!name.trim()) {
      setNotice({ text: "Add the person's name.", error: true });
      return;
    }
    if (email.trim() && !isEmail(email.trim())) {
      setNotice({ text: "That email address doesn't look right.", error: true });
      return;
    }
    attempt(
      "add",
      () => run<{ added: number; alreadyListed: number }>("groups.addGroupMembers", group.id, [{ name: name.trim(), email: email.trim() || null }]),
      (r) => {
        setName("");
        setEmail("");
        return addedText(r);
      }
    );
  }

  function addPasted() {
    if (pastePreview.guests.length === 0) {
      setNotice({ text: "Paste one person per line, like: Glinda Upland, glinda@example.com", error: true });
      return;
    }
    attempt(
      "add",
      () => run<{ added: number; alreadyListed: number }>("groups.addGroupMembers", group.id, pastePreview.guests),
      (r) => {
        setPasted("");
        return addedText(r);
      }
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: group.name }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
      >
        {renaming !== null ? (
          <Card>
            <Field label="Rename the group" value={renaming} onChangeText={setRenaming} maxLength={80} autoFocus />
            <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
              <Button title="Cancel" size="small" variant="ghost" onPress={() => setRenaming(null)} />
              <Button
                title="Save"
                size="small"
                loading={busy === "rename"}
                disabled={!renaming.trim()}
                onPress={() => attempt("rename", () => run("groups.renameGroup", group.id, renaming.trim()), () => void setRenaming(null))}
              />
            </View>
          </Card>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text variant="display" style={{ flex: 1 }}>
              {group.name}
            </Text>
            <IconButton icon="edit" accessibilityLabel="Rename the group" onPress={() => setRenaming(group.name)} />
          </View>
        )}

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="headline">People</Text>
            <Button title={pasting ? "Add one at a time" : "Paste a list"} size="small" variant="ghost" onPress={() => setPasting(!pasting)} />
          </View>
          {pasting ? (
            <>
              <Field
                value={pasted}
                onChangeText={setPasted}
                multiline
                accessibilityLabel="People to add"
                placeholder={"Glinda Upland, glinda@example.com\nElphaba Thropp <elphie@example.com>\nNessa Thropp"}
                hint="One person per line: a name and an email address."
              />
              <Button title="Add people" size="medium" loading={busy === "add"} onPress={addPasted} />
            </>
          ) : (
            <>
              <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
              <Field
                label="Email (optional)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={addOne}
              />
              <Button title="Add" icon="add" size="medium" loading={busy === "add"} onPress={addOne} />
            </>
          )}
          {members.map((member, index) => (
            <View key={member.id}>
              {index === 0 ? <Divider /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: theme.tintSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text variant="caption" tone="tint" style={{ fontWeight: "700" }}>
                    {initials(member.name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="subhead">{member.name}</Text>
                  {member.email || member.email_hidden ? (
                    <Text variant="caption" tone="tertiary">
                      {emailLabel(member)}
                    </Text>
                  ) : null}
                </View>
                <IconButton
                  icon="close"
                  color={theme.textTertiary}
                  accessibilityLabel={`Remove ${member.name}`}
                  onPress={() => attempt(`remove-${member.id}`, () => run("groups.removeGroupMember", group.id, member.id))}
                />
              </View>
            </View>
          ))}
        </Card>

        {notice ? (
          <Text variant="footnote" tone={notice.error ? "danger" : "success"} accessibilityLiveRegion="polite">
            {notice.text}
          </Text>
        ) : null}

        <Card>
          <Text variant="headline">Gift exchange</Text>
          <Text variant="footnote" tone="secondary">
            {current
              ? "This year's exchange is started. Add people from its guest list, and draw names when everyone's in."
              : lastExchange
                ? "Starts a new exchange with everyone in the group. It keeps last time's budget and pairs who shouldn't draw each other, and nobody draws the same person as last time."
                : "Makes an event with everyone in the group as guests and a Secret Santa draw. Set the date and budget next."}
          </Text>
          {!current && lastExchange ? (
            <Text variant="footnote" tone="tertiary">
              Last time:{" "}
              <Text
                variant="footnote"
                tone="tint"
                onPress={() => router.push({ pathname: "/events/[eventId]", params: { eventId: lastExchange.id } })}
              >
                {lastExchange.title}
              </Text>
              {lastExchange.event_date ? ` · ${formatShortEventDate(lastExchange.event_date)}` : ""}
            </Text>
          ) : null}
          {current ? (
            <Button
              title="Open this year's exchange"
              size="medium"
              onPress={() => router.push({ pathname: "/events/[eventId]", params: { eventId: current.id } })}
            />
          ) : (
            <Button
              title={lastExchange ? "Start this year's exchange" : "Start a gift exchange"}
              size="medium"
              disabled={members.length === 0}
              loading={busy === "exchange"}
              onPress={() =>
                attempt(
                  "exchange",
                  () => run<{ id: string }>("events.startGroupExchange", group.id),
                  (r) => void router.push({ pathname: "/events/[eventId]", params: { eventId: r.id } })
                )
              }
            />
          )}
        </Card>

        {events.length > 0 ? (
          <Section title="Events with this group">
            {events.map((event, index) => (
              <View key={event.id}>
                {index > 0 ? <Divider inset={52} /> : null}
                <NavRow
                  icon="party"
                  label={event.title}
                  detail={event.event_date ? formatShortEventDate(event.event_date) : undefined}
                  onPress={() => router.push({ pathname: "/events/[eventId]", params: { eventId: event.id } })}
                />
              </View>
            ))}
          </Section>
        ) : null}

        {sharedLists.length > 0 ? (
          <Section title="Lists shared with this group">
            {sharedLists.map((list, index) => (
              <View key={list.id}>
                {index > 0 ? <Divider inset={52} /> : null}
                <NavRow icon="gift" label={list.title} external onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/r/${list.slug}`)} />
              </View>
            ))}
          </Section>
        ) : (
          <View style={{ gap: spacing.xs }}>
            <Text variant="headline">Lists shared with this group</Text>
            <Text variant="footnote" tone="tertiary">
              None yet. Share a wishlist from its Settings page, and people here see it on their Following page.
            </Text>
          </View>
        )}

        <Button
          title="Delete group"
          icon="trash"
          variant="danger"
          loading={busy === "delete"}
          onPress={() =>
            Alert.alert(`Delete “${group.name}”?`, "Events keep their guests. Shared lists stop being shared with these people.", [
              { text: "Keep it", style: "cancel" },
              {
                text: "Delete group",
                style: "destructive",
                onPress: () => attempt("delete", () => run("groups.deleteGroup", group.id), () => void router.back()),
              },
            ])
          }
        />
      </ScrollView>
    </>
  );
}

// A group's page: its people, its gift exchange each year, its events and the
// lists shared with it. The website's GroupManager
// (src/components/group-manager.tsx), from the same loader.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { deletePhrase } from "@shared/delete-confirmation";
import { formatShortEventDate, isEmail, parseGuestList } from "@shared/events";
import { emailLabel } from "@shared/guest-emails";
import { memberCountLabel } from "@shared/groups";

import { ConfirmDelete } from "@/components/confirm-delete";
import { CAN_PICK_CONTACTS, useContactPicker } from "@/components/contact-picker";
import { HeaderMenu } from "@/components/header-menu";
import { NavRow } from "@/components/nav-row";
import { Button, Card, Divider, ErrorState, Field, haptic, IconButton, LoadingState, Section, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useGroupPage, useRunEventAction } from "@/lib/events-data";
import { initials } from "@/lib/format";
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const pastePreview = useMemo(() => parseGuestList(pasted), [pasted]);
  // A contact goes into the form, to check and add.
  const contacts = useContactPicker(
    (pickedName, pickedEmail) => {
      setPasting(false);
      setNotice(null);
      setName(pickedName);
      setEmail(pickedEmail);
    },
    (text) => setNotice({ text, error: true })
  );
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

  async function deleteGroup() {
    setBusy("delete");
    setDeleteError(null);
    try {
      await run("groups.deleteGroup", group.id);
      haptic("success");
      setConfirmingDelete(false);
      router.back();
    } catch (e) {
      setDeleteError(errorMessage(e));
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
        setPasting(false);
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
        <Text variant="subhead" tone="tertiary" style={{ marginTop: -spacing.md }}>
          {memberCountLabel(members.length)}. Invite the whole group from an event's guest list, run a gift exchange with it, or share a
          wishlist with it.
        </Text>

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="headline">People</Text>
            <Button title={pasting ? "Add one at a time" : "Paste a list"} size="small" variant="ghost" onPress={() => setPasting(!pasting)} />
          </View>
          <Text variant="footnote" tone="tertiary">
            Anyone here with a Regibee account under this email sees the lists you share with the group.
          </Text>
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
              {pasted.trim() ? (
                <Text variant="footnote" tone="tertiary">
                  {pastePreview.guests.length === 1 ? "1 person" : `${pastePreview.guests.length} people`} ready to add
                  {pastePreview.skipped.length > 0
                    ? `. ${pastePreview.skipped.length === 1 ? "1 line" : `${pastePreview.skipped.length} lines`} couldn't be read`
                    : ""}
                </Text>
              ) : null}
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
              {CAN_PICK_CONTACTS ? (
                <Button
                  title="Add from contacts"
                  icon="contacts"
                  size="small"
                  variant="secondary"
                  disabled={busy === "add"}
                  onPress={contacts.open}
                  style={{ alignSelf: "flex-start" }}
                />
              ) : null}
            </>
          )}
          {members.length === 0 ? (
            <Text variant="footnote" tone="tertiary">
              Nobody in this group yet.
            </Text>
          ) : null}
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
                {/* In a menu, not a button on every row, as on the website. It
                    doesn't ask first: nobody is emailed, and adding them back is quick. */}
                <HeaderMenu
                  size="small"
                  accessibilityLabel={`More actions for ${member.name}`}
                  title={member.name}
                  choices={[
                    {
                      label: "Remove from group",
                      icon: "personRemove",
                      destructive: true,
                      onPress: () => attempt(`remove-${member.id}`, () => run("groups.removeGroupMember", group.id, member.id)),
                    },
                  ]}
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
                {/* The owner's own list: it opens its page in the app, as the website opens its manage page. */}
                <NavRow icon="gift" label={list.title} onPress={() => router.push({ pathname: "/registry/[id]", params: { id: list.id } })} />
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
          onPress={() => {
            setDeleteError(null);
            setConfirmingDelete(true);
          }}
        />
      </ScrollView>
      <ConfirmDelete
        visible={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={`Delete “${group.name}”?`}
        message="Events keep their guests. Shared lists stop being shared with these people. This can't be undone."
        // A group with people in it asks the owner to type a sentence first.
        phrase={members.length > 0 ? deletePhrase("group") : null}
        confirmLabel="Delete group"
        cancelLabel="Keep it"
        working={busy === "delete"}
        error={deleteError}
        onConfirm={deleteGroup}
      />
      {contacts.sheet}
    </>
  );
}

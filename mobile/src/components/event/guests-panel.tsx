// An event's guest list for its hosts: RSVP counts, adding guests, sending
// invitations and reminders, and each guest's details. The website's
// EventGuestManager (src/components/event-guest-manager.tsx), in its words,
// running the same server actions.

import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";

import type { EventPageData } from "@shared/events-page-types";
import { exchangeKind, isEmail, parseGuestList, RSVP_LABELS, summarizeRsvps, type EventGuest, type ParsedGuest, type RsvpStatus } from "@shared/events";
import { filledGuestRows, readGuestRows } from "@shared/guest-input";
import { canEmail, emailLabel } from "@shared/guest-emails";
import { memberCountLabel } from "@shared/groups";
import { answerLabel, answerLines, mealCounts, storedAnswers } from "@shared/rsvp-questions";

import { ChoiceSheet } from "@/components/choice-sheet";
import { InviteFollowed } from "@/components/event/invite-followed";
import { Button, Card, Chip, Divider, Field, haptic, IconButton, Pill, Stepper, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useRunEventAction } from "@/lib/events-data";
import { initials } from "@/lib/format";
import { SITE_URL } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/lib/theme";

type Filter = "all" | RsvpStatus;

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_TONE = { yes: "success", maybe: "accent", no: "neutral", pending: "tint" } as const;

/** "Added 2 guests. 1 already on the list." */
function addedText(added: number, skipped: number) {
  return `${added === 1 ? "Added 1 guest" : `Added ${added} guests`}${skipped ? `. ${skipped} already on the list.` : ""}`;
}

function csvCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The website's "Download CSV", as text to share from the phone. */
function guestListCsv(data: EventPageData) {
  const { guests, questions, signupsByGuest: signups } = data;
  const askKids = data.event.ask_kids;
  const hasExchange = Boolean(data.exchange);
  const coming = (g: EventGuest) => g.rsvp_status === "yes" || g.rsvp_status === "maybe";
  const rows = [
    [
      "Name",
      "Email",
      "RSVP",
      "People",
      ...(askKids ? ["Kids"] : []),
      ...(hasExchange ? ["Gift exchange"] : []),
      ...(signups ? ["Signed up for"] : []),
      ...questions.map((q) => q.label),
      "Note",
      "Invited",
    ],
    ...guests.map((g) => [
      g.name,
      g.email ?? (g.email_hidden ? "Private" : null),
      RSVP_LABELS[g.rsvp_status],
      coming(g) ? g.party_size : "",
      ...(askKids ? [coming(g) ? g.kids_count : ""] : []),
      ...(hasExchange ? [g.in_exchange ? "In" : ""] : []),
      ...(signups ? [(signups[g.id] ?? []).join("; ")] : []),
      ...questions.map((q) => {
        const answer = storedAnswers(g.answers)[q.id];
        return Array.isArray(answer) ? answer.filter(Boolean).join("; ") : (answer ?? "");
      }),
      g.rsvp_note,
      g.invited_at ? new Date(g.invited_at).toISOString().slice(0, 10) : "",
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function GuestsPanel({ data }: { data: EventPageData }) {
  const theme = useTheme();
  const { run } = useRunEventAction();
  const { event, guests } = data;
  const summary = summarizeRsvps(guests);
  const [filter, setFilter] = useState<Filter>("all");
  // The add guests form: a name and an optional email on each row, like the
  // website's GuestRowsForm (src/components/guest-rows-form.tsx).
  const nextRowId = useRef(1);
  const [rows, setRows] = useState<{ id: number; name: string; email: string }[]>(() => [{ id: 0, name: "", email: "" }]);
  const [invalid, setInvalid] = useState<{ id: number; field: "name" | "email"; text: string } | null>(null);
  // The row the host just added, to type in next.
  const [focusRowId, setFocusRowId] = useState<number | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // The name for "Save as a group", while it's being typed.
  const [groupDraft, setGroupDraft] = useState<string | null>(null);
  const [pickingFollowed, setPickingFollowed] = useState(false);
  // Which list of choices is open: the host's groups, or their other events.
  const [choosing, setChoosing] = useState<"group" | "copy" | null>(null);
  // Builds of the website before it sent these get none.
  const followedPeople = data.followedPeople ?? [];

  // When the panel opened, for "at most one reminder a day".
  const [now] = useState(() => Date.now());
  // Matches sendEventInvites: guests who already replied, including people
  // who added themselves from the event link, don't need the invitation. A
  // guest whose email is private still gets it (src/lib/guest-emails.ts).
  const uninvited = guests.filter((g) => canEmail(g) && !g.invited_at && g.rsvp_status === "pending");
  const remindable = guests.filter(
    (g) =>
      canEmail(g) &&
      g.invited_at &&
      g.rsvp_status === "pending" &&
      (!g.reminded_at || now - Date.parse(g.reminded_at) >= 24 * 60 * 60 * 1000)
  );
  const withoutEmail = guests.filter((g) => !canEmail(g)).length;
  const shown = filter === "all" ? guests : guests.filter((g) => g.rsvp_status === filter);
  const pastePreview = useMemo(() => parseGuestList(pasted), [pasted]);
  const meals = mealCounts(
    data.questions,
    guests.map((g) => ({ rsvp_status: g.rsvp_status, answers: storedAnswers(g.answers) }))
  );
  const kidsComing = guests.filter((g) => g.rsvp_status === "yes").reduce((sum, g) => sum + (g.kids_count ?? 0), 0);
  const everyoneGives = exchangeKind(data.exchange) === "everyone";

  async function attempt<R>(key: string, work: () => Promise<R>, done?: (result: R) => string | void) {
    setBusy(key);
    setMessage(null);
    try {
      const result = await work();
      haptic("success");
      const text = done?.(result);
      if (text) setMessage({ text, error: false });
      return result;
    } catch (e) {
      setMessage({ text: errorMessage(e), error: true });
      return null;
    } finally {
      setBusy(null);
    }
  }

  function add(list: ParsedGuest[], from: "rows" | "pasted") {
    return attempt(
      "add",
      () => run<{ added: number; alreadyListed: number }>("events.addEventGuests", event.id, list),
      (r) => {
        if (from === "rows") setRows([{ id: nextRowId.current++, name: "", email: "" }]);
        else {
          setPasted("");
          setPasting(false);
        }
        return addedText(r.added, r.alreadyListed);
      }
    );
  }

  function changeRow(id: number, field: "name" | "email", value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    if (invalid?.id === id && invalid.field === field) setInvalid(null);
  }

  function addRow() {
    const id = nextRowId.current++;
    setRows((current) => [...current, { id, name: "", email: "" }]);
    setFocusRowId(id);
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
    if (invalid?.id === id) setInvalid(null);
  }

  function addRows() {
    const result = readGuestRows(rows);
    if (result.guests === null) {
      haptic("warning");
      setInvalid({ id: rows[result.row].id, field: result.field, text: result.error });
      return;
    }
    setInvalid(null);
    add(result.guests, "rows");
  }

  function addPasted() {
    if (pastePreview.guests.length === 0) {
      setMessage({ text: "Paste one guest per line, like: Glinda Upland, glinda@example.com", error: true });
      return;
    }
    add(pastePreview.guests, "pasted");
  }

  function send(kind: "invite" | "remind") {
    const count = kind === "invite" ? uninvited.length : remindable.length;
    Alert.alert(
      kind === "invite"
        ? `Email the invitation to ${count === 1 ? "1 guest" : `${count} guests`} now?`
        : `Remind ${count === 1 ? "1 guest who hasn't" : `${count} guests who haven't`} replied?`,
      data.replyToEmail ? `If they reply to the email, it goes to ${data.replyToEmail}.` : "Each guest gets their own RSVP link.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () =>
            attempt(
              kind,
              () => run<{ sent: number }>(kind === "invite" ? "events.sendEventInvites" : "events.sendEventReminders", event.id),
              (r) =>
                kind === "invite"
                  ? `Sent ${r.sent === 1 ? "1 invitation" : `${r.sent} invitations`}`
                  : `Sent ${r.sent === 1 ? "1 reminder" : `${r.sent} reminders`}`
            ),
        },
      ]
    );
  }

  // These are sheets, not system alerts: Android's alert shows at most three
  // buttons, and a host can have more groups or events than that.
  const groupChoices = data.groups.map((group) => ({
    key: group.id,
    label: `${group.name} (${memberCountLabel(group.memberCount)})`,
    onPress: () => {
      attempt(
        "group",
        () => run<{ added: number; alreadyListed: number }>("events.inviteGroupToEvent", event.id, group.id),
        (r) => addedText(r.added, r.alreadyListed)
      );
    },
  }));

  function inviteFollowed(publicIds: string[]) {
    attempt(
      "followed",
      () => run<{ added: number; alreadyListed: number }>("events.inviteFollowedPeople", event.id, publicIds),
      (r) => {
        setPickingFollowed(false);
        return addedText(r.added, r.alreadyListed);
      }
    );
  }

  const copyChoices = data.copySources.map((source) => ({
    key: source.id,
    label: `${source.title} (${source.guestCount === 1 ? "1 guest" : `${source.guestCount} guests`})`,
    onPress: () => {
      attempt(
        "copy",
        () => run<{ added: number; alreadyListed: number }>("events.copyGuestsFromEvent", event.id, source.id),
        (r) => addedText(r.added, r.alreadyListed)
      );
    },
  }));

  function saveAsGroup() {
    const groupName = groupDraft?.trim() ?? "";
    if (!groupName) return;
    attempt(
      "group-save",
      () => run<{ groupId: string }>("events.saveGuestListAsGroup", event.id, groupName),
      (r) => {
        setGroupDraft(null);
        router.push({ pathname: "/events/group/[groupId]", params: { groupId: r.groupId } });
        return `Saved “${groupName}” as a group`;
      }
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.stats}>
        <Stat
          label="Going"
          value={summary.attending}
          detail={`${summary.yes === 1 ? "1 RSVP" : `${summary.yes} RSVPs`}${
            event.ask_kids && kidsComing > 0 ? `, ${kidsComing} ${kidsComing === 1 ? "kid" : "kids"}` : ""
          }`}
        />
        <Stat label="Maybe" value={summary.maybeHeadcount} detail={summary.maybe === 1 ? "1 RSVP" : `${summary.maybe} RSVPs`} />
        <Stat label="Can't go" value={summary.no} />
        <Stat label="No reply" value={summary.pending} detail={`${summary.invited} of ${summary.guests} invited`} />
      </View>
      {meals.map(({ question, counts, unanswered }) => (
        <Card key={question.id}>
          <Text variant="subhead" style={{ fontWeight: "600" }}>
            {question.label}, for everyone going
          </Text>
          <Text variant="footnote" tone="secondary">
            {counts.map((c) => `${c.option}: ${c.count}`).join(" · ")}
            {unanswered > 0 ? ` · ${unanswered === 1 ? "1 RSVP" : `${unanswered} RSVPs`} without an answer` : ""}
          </Text>
        </Card>
      ))}

      {uninvited.length > 0 || remindable.length > 0 ? (
        <Card>
          <Text variant="subhead" style={{ fontWeight: "600" }}>
            {uninvited.length > 0
              ? `${uninvited.length === 1 ? "1 guest hasn't" : `${uninvited.length} guests haven't`} been sent the invitation`
              : `${remindable.length === 1 ? "1 guest hasn't" : `${remindable.length} guests haven't`} replied yet`}
          </Text>
          <Text variant="footnote" tone="secondary">
            {uninvited.length > 0
              ? "Each guest gets the invitation by email with their own RSVP link."
              : "Send a friendly reminder. Each guest gets at most one a day."}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            {uninvited.length > 0 ? (
              <Button title="Send invitations" icon="send" size="small" loading={busy === "invite"} onPress={() => send("invite")} />
            ) : null}
            {remindable.length > 0 ? (
              <Button
                title={`Remind ${remindable.length}`}
                icon="bell"
                size="small"
                variant={uninvited.length > 0 ? "secondary" : "primary"}
                loading={busy === "remind"}
                onPress={() => send("remind")}
              />
            ) : null}
          </View>
        </Card>
      ) : null}
      {withoutEmail > 0 ? (
        <Text variant="footnote" tone="tertiary">
          {withoutEmail === 1 ? "1 guest has" : `${withoutEmail} guests have`} no email address. Copy their RSVP link from the
          guest&apos;s Edit button and text it to them.
        </Text>
      ) : null}

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="headline">Add guests</Text>
          <Button
            title={pasting ? "Type them in" : "Paste a list"}
            size="small"
            variant="ghost"
            onPress={() => {
              setPasting(!pasting);
              setFocusRowId(null);
            }}
          />
        </View>
        {pasting ? (
          <>
            <Field
              value={pasted}
              onChangeText={setPasted}
              multiline
              placeholder={"Glinda Upland, glinda@example.com\nElphaba Thropp <elphie@example.com>\nNessa Thropp"}
              hint="One guest per line: a name and an email address. Copy them from a spreadsheet or your contacts."
              autoCapitalize="words"
              accessibilityLabel="Guest list"
            />
            {pasted.trim() ? (
              <Text variant="footnote" tone="tertiary">
                {pastePreview.guests.length === 1 ? "1 guest" : `${pastePreview.guests.length} guests`} ready to add
                {pastePreview.skipped.length > 0
                  ? `. ${pastePreview.skipped.length === 1 ? "1 line" : `${pastePreview.skipped.length} lines`} couldn't be read: ${pastePreview.skipped.slice(0, 3).join("; ")}`
                  : ""}
              </Text>
            ) : null}
            <Button
              title="Add guests"
              icon="personAdd"
              size="medium"
              loading={busy === "add"}
              onPress={addPasted}
            />
          </>
        ) : (
          <>
            {rows.map((row, index) => {
              // The first row has the fields' labels. Each row after it has a
              // heading with a button that takes it away.
              const first = index === 0;
              const errorFor = (field: "name" | "email") =>
                invalid?.id === row.id && invalid.field === field ? invalid.text : null;
              return (
                <View key={row.id} style={{ gap: spacing.sm }}>
                  {first ? null : (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                        Guest {index + 1}
                      </Text>
                      <IconButton
                        icon="close"
                        size={18}
                        accessibilityLabel={`Remove guest ${index + 1}`}
                        onPress={() => removeRow(row.id)}
                      />
                    </View>
                  )}
                  <Field
                    label={first ? "Name" : undefined}
                    placeholder={first ? undefined : "Name"}
                    accessibilityLabel={first ? undefined : `Guest ${index + 1} name`}
                    value={row.name}
                    onChangeText={(value) => changeRow(row.id, "name", value)}
                    error={errorFor("name")}
                    autoFocus={row.id === focusRowId}
                    autoCapitalize="words"
                    textContentType="name"
                  />
                  <Field
                    label={first ? "Email (optional)" : undefined}
                    placeholder={first ? undefined : "Email (optional)"}
                    accessibilityLabel={first ? undefined : `Guest ${index + 1} email`}
                    value={row.email}
                    onChangeText={(value) => changeRow(row.id, "email", value)}
                    error={errorFor("email")}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    returnKeyType="done"
                    onSubmitEditing={addRows}
                  />
                </View>
              );
            })}
            <Button
              title="Add another guest"
              icon="add"
              size="small"
              variant="secondary"
              disabled={busy === "add"}
              onPress={addRow}
              style={{ alignSelf: "flex-start" }}
            />
            <Button
              title={filledGuestRows(rows) > 1 ? `Add ${filledGuestRows(rows)} guests` : "Add"}
              icon="personAdd"
              size="medium"
              loading={busy === "add"}
              onPress={addRows}
            />
          </>
        )}
        {followedPeople.length > 0 || data.groups.length > 0 || data.copySources.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {followedPeople.length > 0 ? (
              <Button
                title="Invite people you follow"
                icon="personAdd"
                size="small"
                variant="secondary"
                onPress={() => setPickingFollowed(true)}
              />
            ) : null}
            {data.groups.length > 0 ? (
              <Button title="Invite a group…" icon="people" size="small" variant="secondary" loading={busy === "group"} onPress={() => setChoosing("group")} />
            ) : null}
            {data.copySources.length > 0 ? (
              <Button
                title="Copy guests from another event…"
                icon="copy"
                size="small"
                variant="secondary"
                loading={busy === "copy"}
                onPress={() => setChoosing("copy")}
              />
            ) : null}
          </View>
        ) : null}
      </Card>

      {pickingFollowed ? (
        <InviteFollowed
          people={followedPeople}
          busy={busy === "followed"}
          onInvite={inviteFollowed}
          onClose={() => setPickingFollowed(false)}
        />
      ) : null}

      {message ? (
        <Text variant="footnote" tone={message.error ? "danger" : "success"} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="title" style={{ fontSize: 20 }}>
            Guest list
          </Text>
          {guests.length > 0 ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Button title="Save as a group" size="small" variant="ghost" onPress={() => setGroupDraft(event.title)} />
              <Button
                title="Share CSV"
                size="small"
                variant="ghost"
                onPress={() => Share.share({ message: guestListCsv(data), title: "guest-list.csv" })}
              />
            </View>
          ) : null}
        </View>
        {groupDraft !== null ? (
          <Card>
            <Text variant="headline">Save as a group</Text>
            <Text variant="footnote" tone="secondary">
              Keep these {guests.length === 1 ? "1 guest" : `${guests.length} guests`} as a group, like “The Chens” or “Book
              club”. Invite the whole group to your next event, run a gift exchange with it, or share a wishlist with it.
            </Text>
            <Field label="Group name" value={groupDraft} onChangeText={setGroupDraft} maxLength={80} autoFocus />
            <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
              <Button title="Cancel" size="small" variant="ghost" onPress={() => setGroupDraft(null)} />
              <Button title="Save group" size="small" loading={busy === "group-save"} disabled={!groupDraft.trim()} onPress={saveAsGroup} />
            </View>
          </Card>
        ) : null}
        {guests.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {(["all", "yes", "maybe", "no", "pending"] as Filter[]).map((value) => (
              <Chip
                key={value}
                label={`${value === "all" ? "All" : RSVP_LABELS[value]} (${value === "all" ? guests.length : summary[value]})`}
                selected={filter === value}
                onPress={() => setFilter(value)}
              />
            ))}
          </View>
        ) : null}
        {guests.length === 0 ? (
          <View style={{ gap: 2 }}>
            <Text variant="subhead" style={{ fontWeight: "600" }}>
              No guests yet
            </Text>
            <Text variant="footnote" tone="tertiary">
              Add your guests above, then send the invitation. Or share the event link, and guests who RSVP are added here.
            </Text>
          </View>
        ) : shown.length === 0 ? (
          <Text variant="footnote" tone="tertiary">
            No guests here yet.
          </Text>
        ) : (
          <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {shown.map((guest, index) => (
              <View key={guest.id}>
                {index > 0 ? <Divider inset={64} /> : null}
                {editingId === guest.id ? (
                  <GuestEditor data={data} guest={guest} onClose={() => setEditingId(null)} />
                ) : (
                  <GuestRow data={data} guest={guest} everyoneGives={everyoneGives} onEdit={() => setEditingId(guest.id)} />
                )}
              </View>
            ))}
          </View>
        )}
      </View>
      <ChoiceSheet visible={choosing === "group"} onClose={() => setChoosing(null)} title="Invite a group" choices={groupChoices} />
      <ChoiceSheet
        visible={choosing === "copy"}
        onClose={() => setChoosing(null)}
        title="Copy guests from another event"
        choices={copyChoices}
      />
    </View>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
      <Text variant="title" style={{ fontSize: 22 }}>
        {value}
      </Text>
      {detail ? (
        <Text variant="caption" tone="tertiary">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

function GuestRow({
  data,
  guest,
  everyoneGives,
  onEdit,
}: {
  data: EventPageData;
  guest: EventGuest;
  everyoneGives: boolean;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const coming = guest.rsvp_status === "yes" || guest.rsvp_status === "maybe";
  // Like the website, answers show only for guests who are or might be coming.
  const lines = coming ? answerLines(data.questions, storedAnswers(guest.answers), guest.name) : [];
  const signups = data.signupsByGuest?.[guest.id] ?? [];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${guest.name}`}
      onPress={() => {
        haptic();
        onEdit();
      }}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceAlt : "transparent" }]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.tintSoft }]}>
        <Text variant="footnote" tone="tint" style={{ fontWeight: "700" }}>
          {initials(guest.name)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text variant="subhead" style={{ fontWeight: "600" }}>
            {guest.name}
          </Text>
          <Pill
            tone={STATUS_TONE[guest.rsvp_status]}
            label={`${RSVP_LABELS[guest.rsvp_status]}${coming && guest.party_size > 1 ? ` · ${guest.party_size}` : ""}${
              data.event.ask_kids && coming && guest.kids_count > 0 ? ` (${guest.kids_count} ${guest.kids_count === 1 ? "kid" : "kids"})` : ""
            }`}
          />
          {data.exchange && guest.in_exchange ? (
            <Pill
              label={
                everyoneGives
                  ? guest.wishlist_url
                    ? "Wishlist added"
                    : "No wishlist yet"
                  : `Gift exchange${guest.wishlist_url || guest.gift_ideas ? " · wishlist added" : ""}`
              }
            />
          ) : null}
        </View>
        <Text variant="footnote" tone="tertiary" numberOfLines={1}>
          {emailLabel(guest)}
          {" · "}
          {guest.added_by_guest
            ? "RSVPed from the event link"
            : guest.invited_at
              ? `Invited ${formatShortDate(guest.invited_at)}${guest.reminded_at ? `, reminded ${formatShortDate(guest.reminded_at)}` : ""}`
              : "Not sent yet"}
        </Text>
        {lines.map((line) => (
          <Text key={line.label} variant="footnote" tone="secondary">
            <Text variant="footnote" style={{ fontWeight: "600" }}>
              {answerLabel(line.label)}
            </Text>{" "}
            {line.value}
          </Text>
        ))}
        {signups.length > 0 ? (
          <Text variant="footnote" tone="secondary">
            <Text variant="footnote" style={{ fontWeight: "600" }}>
              Signed up for:
            </Text>{" "}
            {signups.join(" · ")}
          </Text>
        ) : null}
        {guest.rsvp_note ? (
          <Text variant="footnote" tone="secondary" style={{ fontStyle: "italic" }}>
            “{guest.rsvp_note}”
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Follow, for a guest with a Regibee account this host may be shown: the
 * website's GuestFollowButton (src/components/follow-button.tsx). It's in the
 * guest's details, since the whole row is already one button.
 */
function GuestFollow({ guest, follow }: { guest: EventGuest; follow: NonNullable<EventGuest["follow"]> }) {
  const { run } = useRunEventAction();
  const [state, setState] = useState(follow.state);
  const [busy, setBusy] = useState(false);

  async function go(action: string, next: typeof state) {
    setBusy(true);
    try {
      await run(action, follow.publicId);
      haptic("success");
      setState(next);
    } catch (e) {
      Alert.alert("That didn't work", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (state === "approved") {
    return (
      <Text variant="footnote" tone="secondary">
        {follow.followsYou ? "You follow each other." : `You follow ${guest.name}.`}
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
      <Button
        size="small"
        variant="secondary"
        loading={busy}
        title={state === "pending" ? "Requested" : follow.followsYou ? "Follow back" : "Follow"}
        accessibilityLabel={`${state === "pending" ? "Requested" : follow.followsYou ? "Follow back" : "Follow"} ${guest.name}`}
        onPress={() => {
          if (state === "none") go("follows.requestFollow", "pending");
          else
            Alert.alert(`Withdraw your request to follow ${guest.name}?`, undefined, [
              { text: "Keep it", style: "cancel" },
              { text: "Withdraw", style: "destructive", onPress: () => go("follows.cancelFollow", "none") },
            ]);
        }}
      />
      <Text variant="footnote" tone="tertiary" style={{ flexShrink: 1 }}>
        {state === "pending" ? `Waiting for ${guest.name} to approve.` : `${guest.name} approves every follower.`}
      </Text>
    </View>
  );
}

/** A guest's details, opened from their row: the website's guest dialog. */
function GuestEditor({ data, guest, onClose }: { data: EventPageData; guest: EventGuest; onClose: () => void }) {
  const theme = useTheme();
  const { run } = useRunEventAction();
  const [name, setName] = useState(guest.name);
  const [email, setEmail] = useState(guest.email ?? "");
  const [rsvp, setRsvp] = useState<RsvpStatus>(guest.rsvp_status);
  const [party, setParty] = useState(Math.max(1, guest.party_size || 1));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  // The website offers up to the event's limit, or what the guest already has when that's more.
  const maxParty = Math.max(data.event.max_party_size || 1, guest.party_size || 1);
  const link = `${SITE_URL}/e/${data.event.slug}?g=${encodeURIComponent(guest.token)}`;

  async function attempt(key: string, work: () => Promise<unknown>, after?: () => void) {
    setBusy(key);
    setError(null);
    try {
      await work();
      haptic("success");
      after?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function save() {
    if (!name.trim()) {
      setError("Add the guest's name.");
      return;
    }
    // An email from the guest's account is theirs to change, not the host's.
    if (!guest.from_account && email.trim() && !isEmail(email.trim())) {
      setError("That email address doesn't look right.");
      return;
    }
    attempt(
      "save",
      async () => {
        if (name.trim() !== guest.name || (!guest.from_account && (email.trim().toLowerCase() || null) !== guest.email)) {
          await run("events.updateEventGuest", data.event.id, guest.id, { name: name.trim(), email: email.trim() || null });
        }
        // The number of people only counts for a guest who is or might be coming.
        if (rsvp !== guest.rsvp_status || ((rsvp === "yes" || rsvp === "maybe") && party !== guest.party_size)) {
          await run("events.setGuestRsvp", data.event.id, guest.id, rsvp, party);
        }
      },
      onClose
    );
  }

  return (
    <View style={[styles.editor, { backgroundColor: theme.surfaceAlt }]}>
      <Text variant="footnote" tone="tertiary">
        {guest.responded_at
          ? `Replied ${formatShortDate(guest.responded_at)}`
          : guest.invited_at
            ? `Invited ${formatShortDate(guest.invited_at)}, no reply yet`
            : "Not invited yet"}
      </Text>
      {guest.follow ? <GuestFollow guest={guest} follow={guest.follow} /> : null}
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      {guest.from_account ? (
        <View style={{ gap: 2 }}>
          <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
            Email
          </Text>
          <Text variant="callout" tone={guest.email ? undefined : "tertiary"}>
            {guest.email ?? "Private"}
          </Text>
          <Text variant="footnote" tone="tertiary">
            {guest.email_hidden
              ? "From their Regibee account. It stays private, and invitations still reach it."
              : "From their Regibee account. Only they can change it."}
          </Text>
        </View>
      ) : (
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      )}
      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
          RSVP
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {(["yes", "maybe", "no", "pending"] as RsvpStatus[]).map((status) => (
            <Chip key={status} label={RSVP_LABELS[status]} selected={rsvp === status} onPress={() => setRsvp(status)} />
          ))}
        </View>
      </View>
      {(rsvp === "yes" || rsvp === "maybe") && data.event.max_party_size > 1 ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
            People
          </Text>
          <Stepper value={party} onChange={setParty} min={1} max={maxParty} />
        </View>
      ) : null}
      {guest.rsvp_note ? (
        <Text variant="footnote" tone="secondary">
          Their note: “{guest.rsvp_note}”
        </Text>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
          Their RSVP link
        </Text>
        <Text variant="caption" tone="tertiary" selectable>
          {link}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          <Button
            title="Copy link"
            icon="copy"
            size="small"
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(link);
              haptic("success");
              Alert.alert("Copied", "Text it to them, or send it however you like.");
            }}
          />
          <Button title="Share" icon="share" size="small" variant="secondary" onPress={() => Share.share({ message: link })} />
          {canEmail(guest) ? (
            <Button
              title={guest.invited_at ? "Send invitation again" : "Send invitation"}
              icon="send"
              size="small"
              variant="secondary"
              loading={busy === "invite"}
              onPress={() => {
                setSentNotice(null);
                attempt(
                  "invite",
                  () => run("events.sendEventInvites", data.event.id, [guest.id]),
                  () => setSentNotice(`Sent the invitation to ${guest.name}`)
                );
              }}
            />
          ) : null}
        </View>
      </View>
      {error ? (
        <Text variant="footnote" tone="danger">
          {error}
        </Text>
      ) : sentNotice ? (
        <Text variant="footnote" tone="success" accessibilityLiveRegion="polite">
          {sentNotice}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <Button
          title="Remove guest"
          size="small"
          variant="danger"
          loading={busy === "remove"}
          onPress={() =>
            Alert.alert(`Remove ${guest.name}?`, undefined, [
              { text: "Keep", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: () => attempt("remove", () => run("events.removeEventGuest", data.event.id, guest.id), onClose),
              },
            ])
          }
        />
        <Button title="Cancel" size="small" variant="ghost" onPress={onClose} />
        <Button title="Save" size="small" loading={busy === "save"} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: "45%",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  list: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", gap: spacing.md, padding: spacing.md, alignItems: "flex-start" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  editor: { padding: spacing.md, gap: spacing.md },
});

// The host's side of an event's sign-up sheet, as the website's event page
// shows it (src/components/signup-sheet-manager.tsx), in its words.
// SignupStarter turns a sheet on from one of the presets. SignupPanel shows
// the rows, who took each spot and what they're bringing, and lets the host
// add, change or remove rows. Guests sign up from their RSVP. Every change
// runs the website's own server action (src/lib/actions/signups.ts).

import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";

import type { EventPageData } from "@shared/events-page-types";
import {
  formatSlotDate,
  MAX_SIGNUP_DAYS,
  MAX_SIGNUP_LABEL_LENGTH,
  MAX_SIGNUP_NEEDED,
  MAX_SIGNUP_NOTE_LENGTH,
  MAX_SIGNUP_TITLE_LENGTH,
  rowsForDays,
  SIGNUP_PRESETS,
  type HostSignupRow,
  type NewSignupRow,
  type SignupPreset,
} from "@shared/signups";

import { DateField } from "@/components/date-field";
import { HeaderMenu } from "@/components/header-menu";
import { Icon } from "@/components/icon";
import { Button, Card, Divider, Field, haptic, IconButton, Stepper, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useRunEventAction } from "@/lib/events-data";
import { radius, spacing, useTheme } from "@/lib/theme";

type RowChanges = { label: string; needed: number; slot_date: string | null };

function rowName(row: Pick<HostSignupRow, "label" | "slotDate">) {
  return row.slotDate ? `${formatSlotDate(row.slotDate)}: ${row.label}` : row.label;
}

/**
 * Runs the website's sign-up actions for one panel. Remembers which change is
 * running, so its button can show it, and keeps the error to show in the
 * panel, as the website does.
 */
function usePanelAction() {
  const { run } = useRunEventAction();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busy = working !== null;

  async function act(key: string, action: string, ...args: unknown[]): Promise<boolean> {
    if (busy) return false;
    setWorking(key);
    setError("");
    try {
      await run(action, ...args);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setWorking(null);
    }
  }

  return { act, working, busy, error };
}

// ── Turning it on ────────────────────────────────────────────

/** For an event with no sign-up sheet: pick what it's for, and it starts with those rows. */
export function SignupStarter({ eventId }: { eventId: string }) {
  const theme = useTheme();
  const { act, working, busy, error } = usePanelAction();
  const [open, setOpen] = useState(false);

  async function choose(preset: SignupPreset) {
    if (await act(preset, "signups.startSignupSheet", eventId, preset)) haptic("success");
  }

  return (
    <Card>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
          <Icon name="checklist" size={18} color={theme.onAccentSoft} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="headline">Sign-up sheet</Text>
          <Text variant="footnote" tone="tertiary">
            Ask guests to bring a dish, pick a day to drop off a meal, or help set up. They sign up when they RSVP.
          </Text>
          {open ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {(Object.keys(SIGNUP_PRESETS) as SignupPreset[]).map((preset) => (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy, busy: working === preset }}
                  accessibilityHint={SIGNUP_PRESETS[preset].hint}
                  disabled={busy}
                  onPress={() => {
                    haptic();
                    choose(preset);
                  }}
                  style={({ pressed }) => [
                    styles.preset,
                    { borderColor: pressed ? theme.textTertiary : theme.border, opacity: busy && working !== preset ? 0.6 : 1 },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {working === preset ? <ActivityIndicator size="small" color={theme.tint} /> : null}
                    <Text variant="subhead" style={{ fontWeight: "600" }}>
                      {SIGNUP_PRESETS[preset].label}
                    </Text>
                  </View>
                  <Text variant="footnote" tone="tertiary">
                    {SIGNUP_PRESETS[preset].hint}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                haptic();
                setOpen(true);
              }}
              style={({ pressed }) => ({ alignSelf: "flex-start", marginTop: 4, opacity: pressed ? 0.5 : 1 })}
            >
              <Text variant="subhead" tone="tint" style={{ fontWeight: "600" }}>
                Add a sign-up sheet
              </Text>
            </Pressable>
          )}
          {error ? (
            <Text variant="footnote" tone="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

// ── Managing it ──────────────────────────────────────────────

/**
 * The host's side of a sign-up sheet: the rows, who took each spot and what
 * they're bringing, and adding, changing or removing rows.
 */
export function SignupPanel({ data }: { data: EventPageData }) {
  if (!data.signupSheet) return null;
  return (
    <SheetManager
      eventId={data.event.id}
      sheet={data.signupSheet.sheet}
      rows={data.signupSheet.rows}
      mealTrain={data.mealTrain}
    />
  );
}

function SheetManager({
  eventId,
  sheet,
  rows,
  mealTrain,
}: {
  eventId: string;
  sheet: { title: string; note: string | null };
  rows: HostSignupRow[];
  /** A meal train: rows are days, and the address shows only to people who sign up. */
  mealTrain: boolean;
}) {
  const theme = useTheme();
  const { act, working, busy, error } = usePanelAction();
  const [editingSheet, setEditingSheet] = useState(false);
  const [title, setTitle] = useState(sheet.title);
  const [note, setNote] = useState(sheet.note ?? "");
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [adding, setAdding] = useState<"row" | "days" | null>(rows.length === 0 ? (mealTrain ? "days" : "row") : null);

  const spots = rows.reduce((sum, row) => sum + row.needed, 0);
  const taken = rows.reduce((sum, row) => sum + Math.min(row.claims.length, row.needed), 0);

  async function saveSheet() {
    if (await act("sheet", "signups.updateSignupSheet", eventId, { title, note })) setEditingSheet(false);
  }

  function removeSheet() {
    const claimed = rows.reduce((sum, row) => sum + row.claims.length, 0);
    Alert.alert(
      "Remove the sign-up sheet?",
      claimed
        ? `${claimed === 1 ? "1 person has" : `${claimed} people have`} signed up. Their sign-ups go too, and they aren't told.`
        : undefined,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove sheet",
          style: "destructive",
          onPress: async () => {
            // The website says "Sign-up sheet removed" in a toast. Here the
            // panel turns back into "Add a sign-up sheet", which shows it.
            if (await act("remove-sheet", "signups.deleteSignupSheet", eventId)) haptic("success");
          },
        },
      ]
    );
  }

  function removeRow(row: HostSignupRow) {
    const remove = () => act(`remove-${row.id}`, "signups.removeSignupRow", eventId, row.id);
    // Like the website, a row nobody signed up for goes without asking.
    if (row.claims.length === 0) {
      remove();
      return;
    }
    const names = row.claims.map((c) => c.name).join(", ");
    Alert.alert(`Remove "${rowName(row)}"?`, `${names} signed up for it. They aren't told.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: remove },
    ]);
  }

  function removeClaim(row: HostSignupRow, guestId: string, name: string) {
    Alert.alert(`Take ${name} off "${rowName(row)}"?`, "They aren't told.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Take off",
        style: "destructive",
        onPress: () => act(`claim-${row.id}-${guestId}`, "signups.removeSignupClaim", eventId, row.id, guestId),
      },
    ]);
  }

  return (
    <Card style={{ backgroundColor: theme.accentSoft, borderColor: theme.accentSoft }}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.surface }]}>
          <Icon name="checklist" size={18} color={theme.onAccentSoft} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" style={{ fontSize: 20, lineHeight: 26 }} accessibilityRole="header">
            {sheet.title}
          </Text>
          <Text variant="footnote" tone="tertiary">
            {rows.length === 0
              ? mealTrain
                ? "Add the days you need meals."
                : "Add what you'd like people to bring or do."
              : `${taken} of ${spots} ${spots === 1 ? "spot" : "spots"} taken`}
            {mealTrain ? " · The address shows only to people who sign up." : ""}
          </Text>
        </View>
        {!editingSheet ? (
          <Button
            title="Edit"
            icon="edit"
            size="small"
            variant="secondary"
            onPress={() => {
              // Start from the sheet as it is now, in case it changed since this panel opened.
              setTitle(sheet.title);
              setNote(sheet.note ?? "");
              setEditingSheet(true);
            }}
          />
        ) : null}
      </View>

      {editingSheet ? (
        <View style={[styles.box, { backgroundColor: theme.surface, padding: spacing.lg, gap: spacing.md }]}>
          <Field label="Name" value={title} onChangeText={setTitle} maxLength={MAX_SIGNUP_TITLE_LENGTH} />
          <Field
            label="Note to guests (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={MAX_SIGNUP_NOTE_LENGTH}
            placeholder="Label your dish so people know what's in it."
          />
          <View style={styles.buttons}>
            <Button title="Save" size="small" onPress={saveSheet} loading={working === "sheet"} disabled={busy} />
            <Button
              title="Cancel"
              size="small"
              variant="secondary"
              disabled={busy}
              onPress={() => {
                setTitle(sheet.title);
                setNote(sheet.note ?? "");
                setEditingSheet(false);
              }}
            />
            <Button
              title="Remove sheet"
              icon="trash"
              size="small"
              variant="danger"
              style={{ marginLeft: "auto" }}
              loading={working === "remove-sheet"}
              disabled={busy}
              onPress={removeSheet}
            />
          </View>
        </View>
      ) : sheet.note ? (
        <Text variant="subhead" tone="secondary">
          {sheet.note}
        </Text>
      ) : null}

      {rows.length > 0 ? (
        <View style={[styles.box, { backgroundColor: theme.surface }]}>
          {rows.map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <Divider /> : null}
              {editingRow === row.id ? (
                <View style={{ padding: spacing.md }}>
                  <RowForm
                    initial={row}
                    submitLabel="Save"
                    busy={busy}
                    saving={working === `edit-${row.id}`}
                    mealTrain={mealTrain}
                    onCancel={() => setEditingRow(null)}
                    onSubmit={async (changes) => {
                      const saved = await act(`edit-${row.id}`, "signups.updateSignupRow", eventId, row.id, changes);
                      if (saved) setEditingRow(null);
                      return saved;
                    }}
                  />
                </View>
              ) : (
                <SignupRow
                  row={row}
                  busy={busy}
                  onEdit={() => setEditingRow(row.id)}
                  onRemove={() => removeRow(row)}
                  onRemoveClaim={(guestId, name) => removeClaim(row, guestId, name)}
                />
              )}
            </View>
          ))}
        </View>
      ) : null}

      {adding === "row" ? (
        <View style={[styles.box, { backgroundColor: theme.surface, padding: spacing.lg }]}>
          <RowForm
            submitLabel="Add"
            busy={busy}
            saving={working === "add-row"}
            mealTrain={mealTrain}
            onCancel={rows.length > 0 ? () => setAdding(null) : undefined}
            onSubmit={(row) => act("add-row", "signups.addSignupRows", eventId, [row])}
          />
        </View>
      ) : null}
      {adding === "days" ? (
        <View style={[styles.box, { backgroundColor: theme.surface, padding: spacing.lg }]}>
          <DaysForm
            busy={busy}
            saving={working === "add-days"}
            mealTrain={mealTrain}
            onCancel={rows.length > 0 ? () => setAdding(null) : undefined}
            onSubmit={async (newRows) => {
              if (await act("add-days", "signups.addSignupRows", eventId, newRows)) setAdding(null);
            }}
          />
        </View>
      ) : null}
      {error ? (
        <Text variant="footnote" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.buttons}>
        {adding !== "row" ? (
          <Button title="Add a row" icon="add" size="small" variant="secondary" onPress={() => setAdding("row")} />
        ) : null}
        {adding !== "days" ? (
          <Button
            title="Add a row for each day"
            icon="calendar"
            size="small"
            variant="secondary"
            onPress={() => setAdding("days")}
          />
        ) : null}
      </View>
    </Card>
  );
}

/** One row of the sheet: what it is, how full it is, and who signed up. */
function SignupRow({
  row,
  busy,
  onEdit,
  onRemove,
  onRemoveClaim,
}: {
  row: HostSignupRow;
  busy: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onRemoveClaim: (guestId: string, name: string) => void;
}) {
  const theme = useTheme();
  const full = row.claims.length >= row.needed;
  const name = rowName(row);
  // IconButton and the menu have no disabled state, so their presses wait here while a change runs.
  const unlessBusy = (work: () => void) => () => {
    if (!busy) work();
  };

  return (
    <View style={{ padding: spacing.md, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subhead" style={{ fontWeight: "600" }}>
            {name}
          </Text>
          <Text variant="footnote" style={{ color: full ? theme.success : theme.textTertiary }}>
            {full ? "Full" : `${row.claims.length} of ${row.needed} taken`}
          </Text>
        </View>
        {/* Edit and Remove are in one "…" menu, as on the website, so a row
            isn't crowded with buttons and Remove isn't one stray tap away. */}
        <HeaderMenu
          size="small"
          accessibilityLabel={`More actions for ${name}`}
          title={name}
          choices={[
            { label: "Edit row", icon: "edit", onPress: unlessBusy(onEdit) },
            { label: "Remove row", icon: "trash", destructive: true, onPress: unlessBusy(onRemove) },
          ]}
        />
      </View>
      {row.claims.map((claim) => (
        <View key={claim.guestId} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Text variant="footnote" tone="secondary" style={{ flex: 1 }}>
            <Text variant="footnote" style={{ fontWeight: "600" }}>
              {claim.name}
            </Text>
            {claim.note ? ` · ${claim.note}` : ""}
          </Text>
          <IconButton
            icon="close"
            size={16}
            color={theme.textTertiary}
            accessibilityLabel={`Take ${claim.name} off ${name}`}
            onPress={unlessBusy(() => onRemoveClaim(claim.guestId, claim.name))}
          />
        </View>
      ))}
    </View>
  );
}

function RowForm({
  initial,
  submitLabel,
  busy,
  saving,
  mealTrain,
  onSubmit,
  onCancel,
}: {
  initial?: Pick<HostSignupRow, "label" | "needed" | "slotDate">;
  submitLabel: string;
  busy: boolean;
  saving: boolean;
  mealTrain: boolean;
  /** Says whether it saved. */
  onSubmit: (row: RowChanges) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [needed, setNeeded] = useState(initial?.needed ?? 1);
  const [date, setDate] = useState<string | null>(initial?.slotDate ?? null);

  async function submit() {
    const saved = await onSubmit({ label, needed, slot_date: date });
    // A new row's form stays open for the next one, empty. The day stays,
    // as on the website.
    if (saved && !initial) {
      setLabel("");
      setNeeded(1);
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Field
        label="What"
        value={label}
        onChangeText={setLabel}
        maxLength={MAX_SIGNUP_LABEL_LENGTH}
        placeholder={mealTrain ? "Dinner" : "Sides"}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <NumberField label="How many" value={needed} onChange={setNeeded} />
      <DateField label="Day (optional)" value={date} onChange={setDate} />
      <View style={styles.buttons}>
        <Button title={submitLabel} size="small" onPress={submit} loading={saving} disabled={busy} />
        {onCancel ? <Button title="Cancel" size="small" variant="secondary" onPress={onCancel} disabled={busy} /> : null}
      </View>
    </View>
  );
}

function DaysForm({
  busy,
  saving,
  mealTrain,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  saving: boolean;
  mealTrain: boolean;
  onSubmit: (rows: NewSignupRow[]) => Promise<void>;
  onCancel?: () => void;
}) {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [label, setLabel] = useState(mealTrain ? "Dinner" : "");
  const [needed, setNeeded] = useState(1);
  const [error, setError] = useState("");

  async function submit() {
    if (!label.trim()) {
      setError('Say what each day needs, like "Dinner".');
      return;
    }
    const rows = rowsForDays(from ?? "", to || from || "", label.trim(), needed || 1);
    if (!rows) {
      setError(`Pick a first and last day, up to ${MAX_SIGNUP_DAYS} days apart.`);
      return;
    }
    setError("");
    await onSubmit(rows);
  }

  return (
    <View style={{ gap: spacing.md }}>
      <DateField label="First day" value={from} onChange={setFrom} />
      <DateField label="Last day" value={to} onChange={setTo} hint="Leave empty for one day." />
      <Field
        label="Each day needs"
        value={label}
        onChangeText={setLabel}
        maxLength={MAX_SIGNUP_LABEL_LENGTH}
        placeholder="Dinner"
        returnKeyType="done"
      />
      <NumberField label="People each day" value={needed} onChange={setNeeded} />
      {error ? (
        <Text variant="footnote" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.buttons}>
        <Button title="Add days" size="small" onPress={submit} loading={saving} disabled={busy} />
        {onCancel ? <Button title="Cancel" size="small" variant="secondary" onPress={onCancel} disabled={busy} /> : null}
      </View>
    </View>
  );
}

/** How many people a row needs, with − and + where the website has a number field. */
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <View style={{ gap: 6, alignItems: "flex-start" }}>
      <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
        {label}
      </Text>
      <Stepper value={value} onChange={onChange} min={1} max={MAX_SIGNUP_NEEDED} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  headerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  box: { borderRadius: radius.md, overflow: "hidden" },
  buttons: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  preset: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
});

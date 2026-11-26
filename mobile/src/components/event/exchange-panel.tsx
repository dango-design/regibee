// The host's side of an event's gift exchange, as the website's event page
// shows it (src/components/exchange-manager.tsx), in its words. A name draw
// shows who's in, who won't draw each other, and the draw. An
// everyone-gives-everyone exchange shows who's taking part and who has added
// a wishlist. Every change runs the website's own server action.

import { useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import type { EventPageData } from "@shared/events-page-types";
import { exchangeKind, formatEventDate, MIN_EXCHANGE_PARTICIPANTS } from "@shared/events";

import { Icon, type IconName } from "@/components/icon";
import { Button, Card, Divider, haptic, IconButton, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useRunEventAction } from "@/lib/events-data";
import { radius, spacing, useTheme } from "@/lib/theme";

type Exchange = NonNullable<EventPageData["exchange"]>;
type Guest = EventPageData["guests"][number];

export function ExchangePanel({ data, onEditSettings }: { data: EventPageData; onEditSettings: () => void }) {
  // The website shows the panel only when the event has an exchange and its status.
  if (!data.exchange || !data.exchangeStatus) return null;
  if (exchangeKind(data.exchange) === "everyone") {
    return <EveryoneGivesPanel exchange={data.exchange} guests={data.guests} onEditSettings={onEditSettings} />;
  }
  return <DrawPanel data={data} exchange={data.exchange} status={data.exchangeStatus} onEditSettings={onEditSettings} />;
}

/** The panel's colored card, with its round icon, title, summary and "Change settings". */
function PanelCard({
  icon,
  title,
  summary,
  onEditSettings,
  children,
}: {
  icon: IconName;
  title: string;
  summary: string;
  onEditSettings: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card style={{ backgroundColor: theme.successSoft, borderColor: theme.successSoft }}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.surface }]}>
          <Icon name={icon} size={18} color={theme.success} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" style={{ fontSize: 20, lineHeight: 26 }} accessibilityRole="header">
            {title}
          </Text>
          {summary ? (
            <Text variant="footnote" tone="tertiary">
              {summary}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="link"
            hitSlop={10}
            onPress={() => {
              haptic();
              onEditSettings();
            }}
            style={({ pressed }) => ({ alignSelf: "flex-start", marginTop: 4, opacity: pressed ? 0.5 : 1 })}
          >
            <Text variant="subhead" tone="tint" style={{ fontWeight: "600" }}>
              Change settings
            </Text>
          </Pressable>
        </View>
      </View>
      {children}
    </Card>
  );
}

// ── Everyone gives everyone ──────────────────────────────────

/**
 * Who's taking part and who has added a wishlist. There's nothing to draw.
 * The host sees whether a guest added a list, not the list itself.
 */
function EveryoneGivesPanel({
  exchange,
  guests,
  onEditSettings,
}: {
  exchange: Exchange;
  guests: Guest[];
  onEditSettings: () => void;
}) {
  const theme = useTheme();
  const taking = guests.filter((g) => g.in_exchange);
  const withList = taking.filter((g) => g.wishlist_url);
  const waiting = guests.filter((g) => g.rsvp_status === "pending").length;

  return (
    <PanelCard
      icon="people"
      title="Everyone gives everyone"
      summary={exchange.budget ? `About ${exchange.budget} a gift` : ""}
      onEditSettings={onEditSettings}
    >
      <Text variant="callout">
        {taking.length === 0
          ? "Nobody is taking part yet."
          : `${taking.length === 1 ? "1 guest is" : `${taking.length} guests are`} taking part, and ${
              withList.length === taking.length
                ? "everyone has"
                : withList.length === 1
                  ? "1 has"
                  : `${withList.length} have`
            } added a wishlist.`}
        {waiting > 0 ? ` ${waiting === 1 ? "1 guest hasn't" : `${waiting} guests haven't`} answered yet.` : ""}
      </Text>

      {taking.length > 0 ? (
        <View style={styles.chips}>
          {taking.map((g) => (
            <View
              key={g.id}
              accessible
              accessibilityLabel={`${g.name}${g.wishlist_url ? ", has a wishlist" : ", no wishlist yet"}`}
              style={[styles.chip, { backgroundColor: theme.surface }]}
            >
              {g.wishlist_url ? (
                <Icon name="check" size={13} color={theme.success} weight="bold" />
              ) : (
                <View style={[styles.dot, { backgroundColor: theme.placeholder }]} />
              )}
              <Text variant="subhead">{g.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text variant="footnote" tone="tertiary">
        Guests see each other&apos;s lists and what&apos;s been reserved, but not what&apos;s reserved from their own
        until the day after the event. To take part yourself, add yourself as a guest.
      </Text>
    </PanelCard>
  );
}

// ── A name draw ──────────────────────────────────────────────

/**
 * Who's in, who shouldn't draw whom, and the draw. The host never sees who
 * drew whom; each person gets an email and sees their own on their RSVP link.
 */
function DrawPanel({
  data,
  exchange,
  status,
  onEditSettings,
}: {
  data: EventPageData;
  exchange: Exchange;
  status: NonNullable<EventPageData["exchangeStatus"]>;
  onEditSettings: () => void;
}) {
  const theme = useTheme();
  const eventId = data.event.id;
  const guests = data.guests;
  const exclusions = data.exclusions;
  const { run } = useRunEventAction();
  // Which change is running, so its button can show it. Every button waits while one runs.
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const busy = working !== null;

  const drawn = Boolean(exchange.drawn_at);
  const participants = guests.filter((g) => g.in_exchange);
  const others = guests.filter((g) => !g.in_exchange && g.rsvp_status !== "no");
  const nameOf = new Map(guests.map((g) => [g.id, g.name]));
  const enough = participants.length >= MIN_EXCHANGE_PARTICIPANTS;

  /** Runs one of the website's actions. Shows its error in the panel, as the website does. */
  async function act<R = unknown>(key: string, action: string, ...args: unknown[]): Promise<R | null> {
    if (busy) return null;
    setWorking(key);
    setError("");
    try {
      return (await run<R>(action, ...args)) ?? ({} as R);
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setWorking(null);
    }
  }

  async function draw(again: boolean) {
    const result = await act<{ emailed?: number; withoutEmail?: number }>("draw", "events.drawExchangeNames", eventId, { again });
    if (!result) return;
    haptic("success");
    const emailed = result.emailed ?? 0;
    // The website says this in a toast: "Names drawn. 3 people were emailed their person."
    Alert.alert("Names drawn", `${emailed === 1 ? "1 person was" : `${emailed} people were`} emailed their person.`);
  }

  async function undo() {
    if (await act("undo", "events.undoExchangeDraw", eventId)) {
      haptic("success");
      Alert.alert("The draw is undone.");
    }
  }

  function confirmDraw() {
    Alert.alert(
      `Draw names for ${participants.length} people?`,
      "Each gets an email with their person.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Draw names", onPress: () => draw(false) },
      ]
    );
  }

  function confirmAgain() {
    Alert.alert("Draw again?", "Everyone gets a new person by email.", [
      { text: "Cancel", style: "cancel" },
      { text: "Draw names", onPress: () => draw(true) },
    ]);
  }

  function confirmUndo() {
    Alert.alert("Undo the draw?", "Everyone's person is cleared. Nobody is emailed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Undo the draw", style: "destructive", onPress: undo },
    ]);
  }

  async function addPair() {
    if (await act("pair", "events.addExchangeExclusion", eventId, pairA, pairB)) {
      setPairA("");
      setPairB("");
    }
  }

  const summary = [
    exchange.budget ? `Budget ${exchange.budget}` : null,
    exchange.draw_by && !drawn ? `Draw by ${formatEventDate(exchange.draw_by)}` : null,
    exchange.mailed ? "Gifts are mailed" : "Gifts come to the party",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PanelCard icon="shuffle" title="Gift exchange" summary={summary} onEditSettings={onEditSettings}>
      {drawn ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="callout">
            Names were drawn on{" "}
            {new Date(exchange.drawn_at!).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Nobody else sees
            who drew whom, not even you.
          </Text>
          {status.withoutEmail > 0 ? (
            <Text variant="footnote" tone="secondary">
              {status.withoutEmail === 1 ? "1 person has" : `${status.withoutEmail} people have`} no email. Text them
              their RSVP link from the guest list.
            </Text>
          ) : null}
          {status.stale ? (
            <View style={[styles.warning, { backgroundColor: theme.accentSoft }]}>
              <Icon name="error" size={15} color={theme.onAccentSoft} />
              <Text variant="footnote" style={{ flex: 1, color: theme.onAccentSoft }}>
                Someone joined or left after the draw. Draw again to fix it.
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text variant="callout">
          {participants.length === 0
            ? "Nobody has joined yet."
            : `${participants.length === 1 ? "1 person is" : `${participants.length} people are`} in, and ${
                status.withWishlist === 1 ? "1 has" : `${status.withWishlist} have`
              } added a wishlist or gift ideas.`}
          {exchange.mailed && status.withoutAddress > 0
            ? ` ${status.withoutAddress === 1 ? "1 still needs" : `${status.withoutAddress} still need`} to add a shipping address.`
            : ""}
        </Text>
      )}

      {/* Who's in */}
      <View style={{ gap: spacing.sm }}>
        <SubHeading>Who&apos;s in</SubHeading>
        {participants.length > 0 ? (
          <View style={styles.chips}>
            {participants.map((g) => (
              <View key={g.id} style={[styles.chip, { backgroundColor: theme.surface }, !drawn && styles.chipWithButton]}>
                <Text variant="subhead">{g.name}</Text>
                {!drawn ? (
                  <IconButton
                    icon="close"
                    size={13}
                    color={theme.textTertiary}
                    accessibilityLabel={`Take ${g.name} out of the exchange`}
                    onPress={() => act("participant", "events.setExchangeParticipant", eventId, g.id, false)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {!drawn && others.length > 0 ? (
          <Picker
            label="Add someone from the guest list"
            placeholder="Add someone from the guest list…"
            value=""
            options={others.map((g) => ({ value: g.id, label: g.name }))}
            disabled={busy}
            onChoose={(guestId) => act("participant", "events.setExchangeParticipant", eventId, guestId, true)}
          />
        ) : null}
        {!drawn ? (
          <Text variant="footnote" tone="tertiary">
            To take part yourself, add yourself as a guest with your email.
          </Text>
        ) : null}
      </View>

      {/* Who won't draw each other */}
      {!drawn || exclusions.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SubHeading>Who won&apos;t draw each other</SubHeading>
          {exclusions.length > 0 ? (
            <View style={styles.chips}>
              {exclusions.map((x) => {
                const a = nameOf.get(x.guest_a) ?? "Someone";
                const b = nameOf.get(x.guest_b) ?? "someone";
                return (
                  <View
                    key={`${x.guest_a}-${x.guest_b}`}
                    style={[styles.chip, { backgroundColor: theme.surface }, !drawn && styles.chipWithButton]}
                  >
                    <Text variant="subhead">
                      {a} &amp; {b}
                    </Text>
                    {!drawn ? (
                      <IconButton
                        icon="close"
                        size={13}
                        color={theme.textTertiary}
                        accessibilityLabel={`Let ${a} and ${b} draw each other`}
                        onPress={() => act("exclusion", "events.removeExchangeExclusion", eventId, x.guest_a, x.guest_b)}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
          {!drawn && participants.length >= 2 ? (
            <View style={{ gap: spacing.sm }}>
              <Picker
                label="First person"
                placeholder="Choose someone…"
                value={pairA}
                options={participants.map((g) => ({ value: g.id, label: g.name }))}
                onChoose={(id) => {
                  setPairA(id);
                  if (id === pairB) setPairB("");
                }}
              />
              <Picker
                label="Second person"
                placeholder="…and someone else"
                value={pairB}
                options={participants.filter((g) => g.id !== pairA).map((g) => ({ value: g.id, label: g.name }))}
                onChoose={setPairB}
              />
              <Button
                title="Add"
                variant="secondary"
                size="medium"
                style={{ alignSelf: "flex-start" }}
                disabled={busy || !pairA || !pairB}
                loading={working === "pair"}
                onPress={addPair}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <Text variant="footnote" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {/* The draw */}
      {drawn ? (
        <View style={styles.buttons}>
          <Button
            title="Draw again"
            icon="shuffle"
            size="medium"
            variant={status.stale ? "primary" : "secondary"}
            disabled={busy}
            loading={working === "draw"}
            onPress={confirmAgain}
          />
          <Button
            title="Undo the draw"
            size="medium"
            variant="ghost"
            disabled={busy}
            loading={working === "undo"}
            onPress={confirmUndo}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.xs, alignItems: "flex-start" }}>
          <Button
            title="Draw names"
            icon="shuffle"
            size="medium"
            disabled={!enough || busy}
            loading={working === "draw"}
            onPress={confirmDraw}
          />
          {!enough ? (
            <Text variant="footnote" tone="tertiary">
              A gift exchange needs at least {MIN_EXCHANGE_PARTICIPANTS} people.
            </Text>
          ) : null}
        </View>
      )}
    </PanelCard>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }} accessibilityRole="header">
      {children}
    </Text>
  );
}

/**
 * A choice from the guest list, where the website has a select menu. It opens
 * a list of names in place, under the field, since the panel sits inside the
 * event page's scrolling view.
 */
function Picker({
  label,
  placeholder,
  value,
  options,
  onChoose,
  disabled,
}: {
  /** What a screen reader says the field is. */
  label: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onChoose: (value: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);

  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen?.label ?? placeholder}`}
        accessibilityState={{ expanded: open, disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={() => {
          haptic();
          setOpen((o) => !o);
        }}
        style={[styles.select, { backgroundColor: theme.surface, borderColor: theme.border, opacity: disabled ? 0.45 : 1 }]}
      >
        <Text variant="callout" numberOfLines={1} style={{ flex: 1, color: chosen ? theme.text : theme.placeholder }}>
          {chosen?.label ?? placeholder}
        </Text>
        <View style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }}>
          <Icon name="chevronRight" size={13} color={theme.textTertiary} weight="semibold" />
        </View>
      </Pressable>
      {open ? (
        <View style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {options.map((option, index) => (
            <View key={option.value}>
              {index > 0 ? <Divider inset={spacing.md} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: option.value === value }}
                onPress={() => {
                  haptic();
                  setOpen(false);
                  onChoose(option.value);
                }}
                style={({ pressed }) => [styles.menuRow, { backgroundColor: pressed ? theme.surfaceAlt : "transparent" }]}
              >
                <Text variant="callout" numberOfLines={1} style={{ flex: 1 }}>
                  {option.label}
                </Text>
                {option.value === value ? <Icon name="check" size={15} color={theme.tint} weight="semibold" /> : null}
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  headerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 32,
  },
  chipWithButton: { paddingRight: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  menu: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 46, paddingHorizontal: spacing.md },
});

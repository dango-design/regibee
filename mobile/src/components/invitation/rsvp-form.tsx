// The RSVP box on an invitation: the website's RsvpForm
// (src/components/rsvp-form.tsx), with the same answers, checks and words.
// It sends the website's own server action, events.submitRsvp, which saves
// the answer, takes sign-up spots and sends the guest's and host's emails.

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { InvitationPageData } from "@shared/invitation-page-types";
import { answerLabel, answerLines, plusOneCount, readAnswers, type RsvpAnswers, type RsvpQuestion } from "@shared/rsvp-questions";
import { describeClaim, formatSlotDate, MAX_CLAIM_NOTE_LENGTH, rowIsOpen, spotsLabel, type GuestSignupRow } from "@shared/signups";

import { Icon, type IconName } from "@/components/icon";
import { Button, Chip, Field, haptic, Stepper, SwitchRow, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useRunEventAction } from "@/lib/events-data";
import { radius, spacing, useTheme } from "@/lib/theme";

import { useSectionColors } from "./colors";
import { WishlistStep } from "./wishlist-step";

type Answer = "yes" | "maybe" | "no";

const PARTY_ANSWERS: { value: Answer; label: string; icon: IconName }[] = [
  { value: "yes", label: "Going", icon: "check" },
  { value: "maybe", label: "Maybe", icon: "info" },
  { value: "no", label: "Can't go", icon: "close" },
];

// A gift exchange with no get-together asks only whether you're in.
const EXCHANGE_ANSWERS: { value: Answer; label: string; icon: IconName }[] = [
  { value: "yes", label: "I'm in", icon: "check" },
  { value: "no", label: "Not this year", icon: "close" },
];

// A meal train has no get-together either: guests say whether they can help.
const MEAL_TRAIN_ANSWERS: { value: Answer; label: string; icon: IconName }[] = [
  { value: "yes", label: "I can help", icon: "check" },
  { value: "no", label: "Not this time", icon: "close" },
];

const SUMMARY: Record<Answer, string> = {
  yes: "You're going",
  maybe: "You might make it",
  no: "You can't make it",
};

function rowName(row: Pick<GuestSignupRow, "label" | "slotDate">) {
  return row.slotDate ? `${formatSlotDate(row.slotDate)}: ${row.label}` : row.label;
}

/** The answer just sent, shown until the reloaded invitation brings it back. */
interface Saved {
  status: Answer;
  partySize: number;
  kidsCount: number;
  note: string | null;
  inExchange: boolean;
  picks: Map<string, string>;
  answers: RsvpAnswers;
}

/** A bordered box with the RSVP's heading. */
function RsvpBox({ heading, children }: { heading: string; children?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text variant="title" accessibilityRole="header">
        {heading}
      </Text>
      {children}
    </View>
  );
}

/**
 * `onNewToken` gets the guest's own token after someone on the plain event
 * link RSVPs, so the screen can switch to their own link.
 */
export function RsvpForm({ page, onNewToken }: { page: InvitationPageData; onNewToken: (token: string) => void }) {
  const theme = useTheme();
  const mint = useSectionColors("mintSoft");
  const sunshine = useSectionColors("sunshineSoft");
  const { run } = useRunEventAction();
  const { rsvp } = page;
  const { guest, exchange, signup, mealTrain, questions, maxPartySize, askKids, passed } = rsvp;
  const token = page.guestToken;
  // Everyone gives everyone: everyone who's coming takes part, with a wishlist.
  const everyone = exchange?.kind === "everyone";
  const exchangeOnly = Boolean(exchange?.mailed) && !everyone;
  // No party to come to: no party size, and answers that fit.
  const noParty = exchangeOnly || mealTrain;
  const rows = signup?.rows ?? [];
  const minePicks = () => new Map(rows.filter((r) => r.mine).map((r) => [r.id, r.mine?.note ?? ""]));
  const [picks, setPicks] = useState<Map<string, string>>(minePicks);
  const [saved, setSaved] = useState<Saved | null>(null);
  const current: Saved | null =
    saved ??
    (guest && guest.status !== "pending"
      ? {
          status: guest.status as Answer,
          partySize: guest.partySize,
          kidsCount: guest.kidsCount ?? 0,
          note: guest.note,
          inExchange: Boolean(guest.inExchange),
          picks: minePicks(),
          answers: guest.answers ?? {},
        }
      : null);
  const responded = current?.status ?? null;
  const [editing, setEditing] = useState(!responded);
  const [answer, setAnswer] = useState<Answer | null>(responded);
  const [partySize, setPartySize] = useState(Math.max(guest?.partySize ?? 1, 1));
  const [kids, setKids] = useState(guest?.kidsCount ?? 0);
  const [note, setNote] = useState(guest?.note ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // New guests join the exchange unless they say otherwise.
  const [join, setJoin] = useState(guest?.status === "pending" || !guest ? true : Boolean(guest.inExchange));
  const [wishlistUrl, setWishlistUrl] = useState(guest?.wishlistUrl ?? "");
  const [giftIdeas, setGiftIdeas] = useState(guest?.giftIdeas ?? "");
  const [address, setAddress] = useState(guest?.shippingAddress ?? "");
  const [replies, setReplies] = useState<RsvpAnswers>(guest?.answers ?? {});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const answers = exchangeOnly ? EXCHANGE_ANSWERS : mealTrain ? MEAL_TRAIN_ANSWERS : PARTY_ANSWERS;
  const question = exchangeOnly ? "are you in?" : mealTrain ? "can you help?" : "can you make it?";
  const heading = guest ? `Hi ${guest.name}, ${question}` : question[0].toUpperCase() + question.slice(1);

  if (!guest && !rsvp.openRsvp) {
    return (
      <RsvpBox heading="RSVP">
        <Text variant="callout" tone="tertiary">
          To RSVP, open the link in your invitation email.
        </Text>
      </RsvpBox>
    );
  }

  if (current && !editing) {
    const size = current.partySize;
    const kidsText = askKids && current.kidsCount > 0 ? `, ${current.kidsCount} ${current.kidsCount === 1 ? "kid" : "kids"}` : "";
    const signedUp = rows
      .filter((row) => current.picks.has(row.id))
      .map((row) => describeClaim({ label: row.label, slotDate: row.slotDate, note: current.picks.get(row.id) || null }));
    const lines = current.status !== "no" ? answerLines(questions, current.answers, "You") : [];
    return (
      <RsvpBox
        heading={
          exchangeOnly
            ? current.status === "yes"
              ? "You're in the gift exchange"
              : "You're sitting this one out"
            : mealTrain
              ? current.status === "yes"
                ? "You're signed up to help"
                : "You're sitting this one out"
              : `${SUMMARY[current.status]}${current.status !== "no" && size > 1 ? ` (${size} people${kidsText})` : ""}`
        }
      >
        <Text variant="callout" tone="tertiary">
          {current.status === "no" ? "Thanks for letting the host know." : "Thanks! The host has your answer."}
        </Text>
        {everyone && current.status !== "no" && rsvp.wishlist && token ? <WishlistStep page={page} wishlist={rsvp.wishlist} token={token} /> : null}
        {exchange && !everyone && !exchangeOnly && current.status !== "no" ? (
          <Text variant="footnote" tone="secondary">
            {current.inExchange ? "You're in the gift exchange." : "You're not in the gift exchange."}
          </Text>
        ) : null}
        {exchange && !everyone && current.inExchange && !exchange.drawn ? (
          <Text variant="footnote" tone="tertiary">
            We&apos;ll email you who you&apos;re giving to when names are drawn.
          </Text>
        ) : null}
        {lines.length > 0 ? (
          <View style={{ gap: 2 }}>
            {lines.map((line) => (
              <Text key={line.label} variant="footnote" tone="secondary">
                <Text variant="footnote" style={{ fontWeight: "600" }}>
                  {answerLabel(line.label)}{" "}
                </Text>
                {line.value}
              </Text>
            ))}
          </View>
        ) : null}
        {signedUp.length > 0 ? (
          <View style={{ gap: 2 }}>
            <Text variant="footnote" style={{ fontWeight: "600" }}>
              You signed up for
            </Text>
            {signedUp.map((line) => (
              <Text key={line} variant="footnote" tone="secondary">
                • {line}
              </Text>
            ))}
          </View>
        ) : null}
        {current.note ? (
          <Text variant="footnote" tone="secondary">
            Your note: {current.note}
          </Text>
        ) : null}
        {!passed ? (
          <Button
            variant="secondary"
            size="medium"
            style={{ alignSelf: "flex-start" }}
            title={
              exchange && current.inExchange && !everyone
                ? "Change your answer or wishlist"
                : signup && current.status !== "no"
                  ? "Change RSVP or sign-ups"
                  : "Change RSVP"
            }
            onPress={() => setEditing(true)}
          />
        ) : null}
      </RsvpBox>
    );
  }

  if (passed) {
    return (
      <RsvpBox heading="This event has passed">
        <Text variant="callout" tone="tertiary">
          RSVPs are closed.
        </Text>
      </RsvpBox>
    );
  }

  const attending = answer === "yes" || answer === "maybe";
  const showPartySize = !noParty && maxPartySize > 1 && attending;
  const showKids = askKids && attending && !noParty;
  const showSignup = Boolean(signup) && attending;
  // After the draw nobody joins or leaves here, but people in it can still
  // update their wishlist and address.
  const alreadyIn = Boolean(guest?.inExchange);
  const canChooseJoin = Boolean(exchange) && !everyone && !exchangeOnly && !exchange?.drawn && attending;
  const inExchange = exchange
    ? everyone
      ? attending
      : exchange.drawn
        ? alreadyIn
        : exchangeOnly
          ? answer === "yes"
          : attending && join
    : false;
  const size = showPartySize ? partySize : 1;

  async function send() {
    if (!answer) {
      setError(
        exchangeOnly ? "Choose I'm in or Not this year." : mealTrain ? "Choose I can help or Not this time." : "Choose Going, Maybe or Can't go.",
      );
      return;
    }
    if (exchange?.mailed && inExchange && !address.trim()) {
      setError("Add a shipping address.");
      return;
    }
    if (mealTrain && answer === "yes" && picks.size === 0) {
      setError("Pick at least one day you can help.");
      return;
    }
    // The same check the server makes, so a missing answer shows at once.
    const checked = attending && questions.length > 0 ? readAnswers(questions, replies, size) : { answers: {} };
    if ("error" in checked) {
      setError(checked.error);
      return;
    }
    setSending(true);
    setError("");
    const kidsCount = showKids ? Math.min(kids, size) : 0;
    try {
      const result = await run<{ token?: string }>("events.submitRsvp", {
        slug: page.slug,
        token,
        name: guest ? undefined : name,
        email: guest ? undefined : email,
        status: answer,
        partySize: size,
        kidsCount,
        note,
        // When everyone gives everyone, the wishlist comes after, in its own step.
        exchange: exchange
          ? everyone
            ? { join: inExchange }
            : { join: inExchange, wishlistUrl, giftIdeas, shippingAddress: address }
          : undefined,
        signups: signup ? (answer === "no" ? [] : [...picks].map(([itemId, itemNote]) => ({ itemId, note: itemNote }))) : undefined,
        answers: checked.answers,
      });
      haptic("success");
      setSaved({
        status: answer,
        partySize: answer === "no" ? 0 : size,
        kidsCount,
        note: note.trim() || null,
        inExchange,
        picks: answer === "no" ? new Map() : new Map(picks),
        answers: checked.answers,
      });
      if (answer === "no") setPicks(new Map());
      setEditing(false);
      // Someone on the plain link now has their own: switch to it, so the
      // screen shows their answer and they can change it later.
      if (!token && result?.token) onNewToken(result.token);
    } catch (e) {
      haptic("warning");
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  const togglePick = (id: string) => {
    setError("");
    haptic();
    setPicks((now) => {
      const next = new Map(now);
      if (next.has(id)) next.delete(id);
      else next.set(id, "");
      return next;
    });
  };

  return (
    <RsvpBox heading={heading}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Your answer" style={{ flexDirection: "row", gap: spacing.sm }}>
        {answers.map(({ value, label, icon }) => {
          const selected = answer === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                haptic();
                setAnswer(value);
                setError("");
              }}
              style={({ pressed }) => [
                styles.answer,
                {
                  backgroundColor: selected ? theme.tint : theme.surface,
                  borderColor: selected ? theme.tint : theme.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Icon name={icon} size={16} color={selected ? theme.onTint : theme.text} weight="semibold" />
              <Text variant="subhead" style={{ fontWeight: "600", color: selected ? theme.onTint : theme.text }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!guest ? (
        <>
          <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={100} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            hint="We'll send your RSVP and a link to change it."
          />
        </>
      ) : null}

      {showPartySize ? (
        <CountRow
          label="How many people, including you?"
          value={partySize}
          display={partySize === 1 ? "Just me" : undefined}
          min={1}
          max={maxPartySize}
          onChange={(value) => {
            setPartySize(value);
            if (kids > value) setKids(value);
          }}
        />
      ) : null}
      {showKids ? (
        <CountRow label="How many are kids?" value={Math.min(kids, size)} display={kids === 0 ? "None" : undefined} min={0} max={size} onChange={setKids} />
      ) : null}

      {attending && questions.length > 0 ? (
        <QuestionFields
          questions={questions}
          answers={replies}
          onChange={(id, value) => {
            setError("");
            setReplies((now) => ({ ...now, [id]: value }));
          }}
          partySize={size}
        />
      ) : null}

      {showSignup && signup ? (
        <View style={[styles.tinted, { backgroundColor: sunshine.fill }]}>
          <View style={{ gap: 2 }}>
            <Text variant="callout" style={{ fontWeight: "600" }}>
              {mealTrain ? "Pick a day" : "I'll bring…"}
            </Text>
            <Text variant="footnote" tone="tertiary">
              {mealTrain
                ? "You'll see the drop-off address once you send."
                : "Optional."}
            </Text>
          </View>
          {rows.length === 0 ? (
            <Text variant="footnote" tone="tertiary">
              The host hasn&apos;t added anything to sign up for yet.
            </Text>
          ) : (
            rows.map((row) => {
              const picked = picks.has(row.id);
              const open = rowIsOpen(row);
              const disabled = !picked && !open;
              const status = row.passed && !row.mine ? "Over" : row.mine ? "Yours" : spotsLabel(row);
              const hint = [status, row.bringing.length > 0 ? `Bringing: ${row.bringing.join(", ")}` : null].filter(Boolean).join(" · ");
              return (
                <View key={row.id} style={{ gap: spacing.sm }}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: picked, disabled }}
                    accessibilityLabel={rowName(row)}
                    accessibilityHint={hint}
                    disabled={disabled}
                    onPress={() => togglePick(row.id)}
                    style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", opacity: disabled ? 0.5 : 1 }}
                  >
                    <Icon name={picked ? "checkbox" : "checkboxEmpty"} size={22} color={picked ? theme.tint : theme.textTertiary} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="callout" style={{ fontWeight: "600" }}>
                        {rowName(row)}
                      </Text>
                      <Text variant="footnote" tone="tertiary">
                        {hint}
                      </Text>
                    </View>
                  </Pressable>
                  {picked ? (
                    <View style={{ paddingLeft: 30 }}>
                      <Field
                        accessibilityLabel={`What you're ${mealTrain ? "making" : "bringing"} for ${rowName(row)}`}
                        value={picks.get(row.id) ?? ""}
                        onChangeText={(value) => setPicks((now) => new Map(now).set(row.id, value))}
                        maxLength={MAX_CLAIM_NOTE_LENGTH}
                        placeholder={mealTrain ? "What you're making (optional)" : "What you're bringing (optional)"}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      ) : null}

      {everyone && attending && !guest?.wishlistUrl && !guest?.giftIdeas ? (
        <View style={[styles.tinted, { backgroundColor: theme.surfaceAlt }]}>
          <Text variant="footnote" tone="secondary">
            Everyone gives everyone. You&apos;ll add your wishlist after you RSVP.
          </Text>
        </View>
      ) : null}

      {exchange && !everyone && (attending || exchangeOnly) && answer !== "no" ? (
        <View style={[styles.tinted, { backgroundColor: mint.fill, paddingHorizontal: canChooseJoin ? 0 : spacing.lg }]}>
          {canChooseJoin ? (
            <SwitchRow
              label="Join the gift exchange"
              value={join}
              onValueChange={setJoin}
            />
          ) : exchange.drawn && !alreadyIn ? (
            <Text variant="footnote" tone="secondary">
              Names have been drawn. Ask the host if you&apos;d like to join.
            </Text>
          ) : (
            <Text variant="callout" style={{ fontWeight: "600" }}>
              Your gift exchange details
            </Text>
          )}
          {inExchange ? (
            <View style={{ gap: spacing.md, paddingHorizontal: canChooseJoin ? spacing.lg : 0 }}>
              <Field
                label="Your wishlist (optional)"
                value={wishlistUrl}
                onChangeText={setWishlistUrl}
                placeholder="regibee.com/r/your-wishlist or any store's list"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                hint="Only the person who draws you sees it."
              />
              <Field
                label="Gift ideas (optional)"
                value={giftIdeas}
                onChangeText={setGiftIdeas}
                multiline
                maxLength={1000}
                placeholder="Cozy socks (size M), anything with cats, a good mystery novel"
              />
              {exchange.mailed ? (
                <Field
                  label="Shipping address"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  maxLength={300}
                  autoComplete="postal-address"
                  textContentType="fullStreetAddress"
                  placeholder={"Your name\n123 Main St\nSan Francisco, CA 94102"}
                  hint="Only the person who draws you sees it."
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <Field
        label="Note to the host (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
        placeholder={answer === "no" ? "Sorry to miss it!" : mealTrain ? "Happy to help!" : "Can't wait!"}
      />

      {error ? (
        <Text variant="footnote" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Button title={noParty ? "Send" : "Send RSVP"} loading={sending} onPress={send} />
        {responded ? <Button title="Cancel" variant="ghost" disabled={sending} onPress={() => setEditing(false)} /> : null}
      </View>
    </RsvpBox>
  );
}

/** A count with − and + buttons: the website's dropdown of numbers. */
function CountRow({
  label,
  value,
  display,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  /** What to say instead of the number, such as "Just me". */
  display?: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout">{label}</Text>
        {display ? (
          <Text variant="footnote" tone="tertiary">
            {display}
          </Text>
        ) : null}
      </View>
      <Stepper value={value} onChange={onChange} min={min} max={max} />
    </View>
  );
}

/**
 * The host's RSVP questions. A meal question asks once for each person
 * coming, and a plus-ones question asks for the name of each person but the guest.
 */
function QuestionFields({
  questions,
  answers,
  onChange,
  partySize,
}: {
  questions: RsvpQuestion[];
  answers: RsvpAnswers;
  onChange: (id: string, value: string | string[]) => void;
  partySize: number;
}) {
  const label = (q: RsvpQuestion) => (q.required ? q.label : `${q.label} (optional)`);
  const plusOnes = questions.find((q) => q.kind === "plus_ones");
  const names = plusOnes && Array.isArray(answers[plusOnes.id]) ? (answers[plusOnes.id] as string[]) : [];
  const listOf = (id: string, length: number) => {
    const value = answers[id];
    return Array.from({ length }, (_, i) => (Array.isArray(value) ? (value[i] ?? "") : ""));
  };
  const setAt = (id: string, length: number, index: number, value: string) => {
    const next = listOf(id, length);
    next[index] = value;
    onChange(id, next);
  };
  // Names first, so each meal can say who it's for.
  const ordered = [...questions].sort((a, b) => Number(b.kind === "plus_ones") - Number(a.kind === "plus_ones"));

  return (
    <View style={{ gap: spacing.lg }}>
      {ordered.map((q) => {
        if (q.kind === "plus_ones") {
          const count = plusOneCount(partySize);
          if (count === 0) return null;
          return (
            <View key={q.id} style={{ gap: spacing.sm }}>
              <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                {label(q)}
              </Text>
              {listOf(q.id, count).map((value, i) => (
                <Field
                  key={i}
                  accessibilityLabel={`Name of guest ${i + 2}`}
                  placeholder={`Guest ${i + 2}'s name`}
                  value={value}
                  onChangeText={(next) => setAt(q.id, count, i, next)}
                  maxLength={100}
                  autoCapitalize="words"
                />
              ))}
            </View>
          );
        }
        if (q.kind === "meal") {
          const people = Math.max(partySize, 1);
          return (
            <View key={q.id} style={{ gap: spacing.sm }}>
              <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                {label(q)}
              </Text>
              {listOf(q.id, people).map((pick, i) => (
                <View key={i} style={{ gap: 6 }}>
                  {people > 1 ? (
                    <Text variant="footnote" tone="tertiary">
                      For {i === 0 ? "you" : names[i - 1]?.trim() || `guest ${i + 1}`}
                    </Text>
                  ) : null}
                  <View accessibilityRole="radiogroup" accessibilityLabel={q.label} style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                    {q.options.map((option) => (
                      <Chip key={option} label={option} selected={pick === option} onPress={() => setAt(q.id, people, i, pick === option ? "" : option)} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          );
        }
        const value = typeof answers[q.id] === "string" ? (answers[q.id] as string) : "";
        return (
          <Field
            key={q.id}
            label={label(q)}
            value={value}
            onChangeText={(next) => onChange(q.id, next)}
            maxLength={500}
            multiline={q.kind === "diet"}
            placeholder={q.kind === "diet" ? "Vegetarian, no nuts" : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.lg, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  answer: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  tinted: { gap: spacing.md, borderRadius: radius.md, padding: spacing.lg },
});


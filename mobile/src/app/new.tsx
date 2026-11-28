// "Start something new": the website's New page
// (src/app/(protected)/dashboard/new/page.tsx) and its picker
// (src/components/plan-picker.tsx), with the same steps, choices, words and
// defaults. A gift list on its own opens the new list form with its type
// already chosen. An event asks what it is, who it's for and how gifts work,
// then the website's own startPlan makes it. Occasions where guests usually
// bring no gifts, like a potluck, skip the gifts question. Change both together.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { BackHandler, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AUDIENCE_LABELS,
  OCCASION_GROUPS,
  giftPlanLabel,
  giftPlanRows,
  listTitleFor,
  nameLabelFor,
  occasionFor,
  planNeedsEvent,
  startingGiftPlan,
  usuallyHasGifts,
  type Audience,
  type GiftPlan,
  type OccasionId,
  type OccasionTint,
} from "@shared/occasions";

import { DateField } from "@/components/date-field";
import { Icon, type IconName } from "@/components/icon";
import { KeyboardFooter, KeyboardScrollView, useKeyboardFooter } from "@/components/keyboard";
import { Button, EmptyState, ErrorState, Field, haptic, IconButton, LoadingState, Section, SwitchRow, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { idFromPath, usePlanPicker, useRunEventAction } from "@/lib/events-data";
import { radius, spacing, useTheme } from "@/lib/theme";

type Step = "what" | "who" | "gifts" | "name";
const STEPS: { id: Step; label: string }[] = [
  { id: "what", label: "What" },
  { id: "who", label: "Who it's for" },
  { id: "gifts", label: "Gifts" },
  { id: "name", label: "Name it" },
];

// Occasions that are usually a party. For the rest, someone making a list for
// themselves often wants only the list, so "Also make an invitation" starts off.
const LIST_FIRST: readonly OccasionId[] = ["birthday", "christmas", "holiday", "other"];

/** What startPlan takes. Copied from PlanInput in src/lib/actions/events.ts, which the app can't import. */
interface PlanInput {
  occasion: string;
  audience: Audience;
  name?: string;
  gifts: GiftPlan;
  invitation?: boolean;
  linkUrl?: string;
  registryId?: string;
  askEmail?: string;
  title: string;
  date?: string;
}

interface PlanPickerState {
  step: Step;
  occasion: OccasionId | null;
  audience: Audience | null;
  name: string;
  gifts: GiftPlan | null;
  invitation: boolean;
  linkUrl: string;
  /** One of your own lists, for "link". Picked instead of pasting a link. */
  registryId: string;
  askEmail: string;
  title: string;
  date: string;
}

const EMPTY: PlanPickerState = {
  step: "what",
  occasion: null,
  audience: null,
  name: "",
  gifts: null,
  invitation: true,
  linkUrl: "",
  registryId: "",
  askEmail: "",
  title: "",
  date: "",
};

/**
 * Gift lists that don't need an event. Each opens the new list form with its
 * type already chosen, so making one never asks about a party. The website
 * links to /dashboard/registry/new?type=…&occasion=… for these.
 */
const LISTS_ON_THEIR_OWN: { label: string; hint: string; params: { registryType: string; eventType?: string }; icon: IconName }[] = [
  { label: "Baby registry", hint: "For a new arrival", params: { registryType: "baby" }, icon: "baby" },
  { label: "Wedding registry", hint: "For the two of you", params: { registryType: "personal", eventType: "wedding" }, icon: "heart" },
  { label: "Wishlist", hint: "Birthday, Christmas, a new home, or anything", params: { registryType: "personal" }, icon: "gift" },
];

const PLAN_ICONS: Partial<Record<GiftPlan, IconName>> = {
  new_list: "gift",
  link: "link",
  ask: "mail",
  everyone: "people",
  exchange: "shuffle",
  signup: "checklist",
};

// Each occasion's dot, in the website's 100 shades (src/styles/theme.css, by
// way of src/lib/occasion-theme.ts).
const TINT_DOTS: Record<OccasionTint, string> = {
  blush: "#FFDFDF",
  sunshine: "#F7EFA9",
  mint: "#CDF6E9",
  teal: "#DEF1F4",
};

export default function NewPlanScreen() {
  const { demo } = useSession();
  const query = usePlanPicker();
  // The Events tab's New button sends first=events, so events show before gift lists.
  const { first } = useLocalSearchParams<{ first?: string }>();

  let body;
  if (demo) {
    // The website sends guests without an account straight to the list form.
    body = (
      <EmptyState
        icon="party"
        title="Events need an account"
        message="Make an account to plan events."
        action={<Button title="Make a gift list" icon="gift" size="medium" onPress={() => router.replace("/new-registry")} />}
      />
    );
  } else if (query.data) {
    body = <PlanPicker myName={query.data.myName} myLists={query.data.myLists} eventsFirst={first === "events"} />;
  } else if (query.error) {
    body = <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  } else {
    body = <LoadingState />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Start something new",
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => router.back()} />
              : undefined,
        }}
      />
      {body}
    </>
  );
}

/** A choice on the picker. A main choice has a picture, which turns into a check once chosen. */
function Choice({
  selected,
  onPress,
  label,
  hint,
  icon,
  compact = false,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  hint?: string;
  icon?: IconName;
  /** A smaller choice, for the ones after the main few. */
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        paddingHorizontal: compact ? spacing.md : spacing.lg,
        paddingVertical: compact ? spacing.sm : spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: selected ? theme.tint : theme.border,
        backgroundColor: selected ? theme.tintSoft : theme.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? theme.tint : theme.tintSoft,
          }}
        >
          <Icon name={selected ? "check" : icon} size={16} color={selected ? theme.onTint : theme.tint} weight="semibold" />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2, justifyContent: "center", minHeight: icon ? 36 : undefined }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {selected && !icon ? <Icon name="check" size={15} color={theme.tint} weight="bold" /> : null}
          <Text variant={compact ? "subhead" : "callout"} style={{ fontWeight: icon ? "600" : "500", flexShrink: 1 }}>
            {label}
          </Text>
        </View>
        {hint ? (
          <Text variant="footnote" tone="tertiary">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Heading({ title }: { title: string }) {
  return <Text variant="title">{title}</Text>;
}

function StepSection({ children }: { children: ReactNode }) {
  return <View style={{ gap: spacing.lg }}>{children}</View>;
}

/** Splits a group's occasions into rows of two. */
function pairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

/** One occasion on the first step, with its color dot. */
function OccasionButton({ id, selected, onPress }: { id: OccasionId; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const o = occasionFor(id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: selected ? theme.tint : theme.border,
        backgroundColor: theme.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: TINT_DOTS[o.tint] }} />
      <Text variant="subhead" style={{ fontWeight: "500", flexShrink: 1 }}>
        {o.label}
      </Text>
    </Pressable>
  );
}

/**
 * The picker. It starts with two kinds of thing to make:
 *
 * - A gift list on its own. These open the new list form, with no event.
 * - An event. Three questions (what, who it's for, how gifts work) and a
 *   name, then startPlan makes the event, with a gift list if the host wants
 *   one.
 */
function PlanPicker({
  myName,
  myLists,
  eventsFirst,
}: {
  myName: string;
  myLists: { id: string; title: string }[];
  /** Put events before gift lists. */
  eventsFirst: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardFooter = useKeyboardFooter();
  const { run } = useRunEventAction();
  const [state, setState] = useState<PlanPickerState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const occasion = state.occasion ? occasionFor(state.occasion) : null;
  const audiences = (occasion?.audiences ?? []) as readonly Audience[];
  const giftRows = state.audience ? giftPlanRows(state.audience, occasion) : { main: [], other: [] };
  // Someone else's list is theirs, so it's pasted. Every other plan can pick one of yours.
  const pickableLists = state.audience === "someone" ? [] : myLists;
  const pickedList = myLists.find((l) => l.id === state.registryId) ?? null;
  // A meal train has no day of its own; the date is its first drop-off day.
  const mealTrain = state.occasion === "meal_train";
  const nameLabel = state.audience ? nameLabelFor(state.audience) : null;
  const withEvent = state.gifts ? planNeedsEvent(state.gifts) || state.invitation : true;
  // The gifts step is optional. With nothing picked, its button skips it.
  const giftsPicked = Boolean(state.gifts && state.gifts !== "later");
  // A potluck or a game night usually has no gifts, so the picker doesn't ask.
  // The host can add them from the event later.
  const asksGifts = !state.occasion || usuallyHasGifts(state.occasion);
  const steps = asksGifts ? STEPS : STEPS.filter((s) => s.id !== "gifts");

  const update = (changes: Partial<PlanPickerState>) => {
    setError("");
    setState((current) => ({ ...current, ...changes }));
  };

  /** The title the last step starts with. */
  const suggestedTitle = (next: PlanPickerState) => {
    if (!next.occasion) return "";
    const chosen = occasionFor(next.occasion);
    const event = next.gifts ? planNeedsEvent(next.gifts) || next.invitation : true;
    return event ? chosen.titleFor(next.name) : listTitleFor(chosen, next.name);
  };

  const goTo = (step: Step, changes: Partial<PlanPickerState> = {}) => {
    const next = { ...state, ...changes, step };
    if (step === "name") next.title = suggestedTitle(next);
    setError("");
    setState(next);
  };

  const chooseOccasion = (id: OccasionId) => {
    const chosen = occasionFor(id);
    const only = chosen.audiences.length === 1 ? chosen.audiences[0] : null;
    const audience = only ?? (chosen.audiences.includes(state.audience as never) ? state.audience : chosen.audiences[0]);
    const changes: Partial<PlanPickerState> = {
      occasion: id,
      audience,
      invitation: !LIST_FIRST.includes(id),
      // Christmas and a holiday party start with each guest linking their own wishlist.
      gifts: audience ? startingGiftPlan(audience, chosen) : null,
    };
    if (only === "everyone") {
      // A gift exchange occasion is a Secret Santa: names are drawn.
      goTo("name", { ...changes, gifts: "exchange" });
    } else if (only && !chosen.gifts) {
      goTo("name", { ...changes, gifts: "later" });
    } else if (only) {
      goTo("gifts", changes);
    } else {
      goTo("who", { ...changes, name: changes.audience === "me" && !state.name ? myName : state.name });
    }
  };

  const chooseAudience = (audience: Audience) => {
    update({ audience, name: audience === "me" ? state.name || myName : state.name, gifts: startingGiftPlan(audience, occasion) });
  };

  const afterWho = () => {
    if (nameLabel && !state.name.trim() && state.audience !== "me") {
      setError(`Add ${state.audience === "someone" ? "their name" : state.audience === "child" ? "your child's name" : "your names"}.`);
      return;
    }
    if (!asksGifts) {
      goTo("name", { gifts: "later" });
      return;
    }
    goTo("gifts");
  };

  const afterGifts = () => {
    if (!giftsPicked) {
      goTo("name", { gifts: "later" });
      return;
    }
    if (state.gifts === "link" && !state.linkUrl.trim() && !pickedList) {
      setError(pickableLists.length > 0 ? "Pick one of your lists, or paste a link." : "Paste the link to the list.");
      return;
    }
    if (state.gifts === "ask" && !state.askEmail.trim()) {
      setError("Add their email address, so we can ask them.");
      return;
    }
    goTo("name");
  };

  /** Picks a gift plan, or unpicks it when it's already picked. */
  const pick = (plan: GiftPlan) => update({ gifts: state.gifts === plan ? null : plan });

  const back = () => {
    const order: Step[] = ["what", "who", "gifts", "name"];
    let index = order.indexOf(state.step) - 1;
    // Skip the steps the occasion answered by itself.
    if (order[index] === "gifts" && ((state.audience === "everyone" && audiences.length === 1) || !asksGifts)) index -= 1;
    if (order[index] === "who" && audiences.length === 1) index -= 1;
    goTo(order[Math.max(index, 0)]);
  };

  // Android's back button goes back a step, like the Back button, until the first step.
  useEffect(() => {
    if (Platform.OS !== "android" || state.step === "what" || saving) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => subscription.remove();
  });

  const make = async () => {
    if (!state.occasion || !state.audience || !state.gifts) return;
    setSaving(true);
    setError("");
    const input: PlanInput = {
      occasion: state.occasion,
      audience: state.audience,
      name: state.name,
      gifts: state.gifts,
      invitation: state.invitation,
      linkUrl: pickedList ? "" : state.linkUrl,
      registryId: pickedList?.id ?? "",
      askEmail: state.askEmail,
      title: state.title,
      date: state.date,
    };
    let href: string | undefined;
    try {
      href = (await run<{ href?: string } | null>("events.startPlan", input))?.href;
    } catch (e) {
      setSaving(false);
      setError(errorMessage(e));
      return;
    }
    if (!href) {
      setSaving(false);
      setError("That didn't work. Try again.");
      return;
    }
    haptic("success");
    const eventId = idFromPath(href, "/dashboard/events/");
    const listId = idFromPath(href, "/dashboard/registry/");
    if (eventId) {
      // Close this form, then open the new event.
      router.back();
      router.push({ pathname: "/events/[eventId]", params: { eventId: eventId } });
    } else if (listId) {
      // Close this form, then open the new list.
      router.back();
      router.push({ pathname: "/registry/[id]", params: { id: listId } });
    } else {
      router.back();
    }
  };

  const stepIndex = steps.findIndex((s) => s.id === state.step);

  // What the plan will make, for the last step.
  const summary: string[] = [];
  if (occasion && state.gifts) {
    if (withEvent) summary.push(`An invitation with RSVPs: “${state.title || suggestedTitle(state)}”`);
    if (state.gifts === "new_list") {
      const whose = state.audience === "child" ? "Their" : "Your";
      summary.push(
        withEvent
          ? `${whose} ${occasion.list.noun}, “${listTitleFor(occasion, state.name)}”, linked to the invitation`
          : `${whose} ${occasion.list.noun}`,
      );
      if (state.audience === "child") summary.push("You'll see what's reserved, since it's for your child");
    }
    if (state.gifts === "link") {
      summary.push(
        pickedList ? `Your list “${pickedList.title}”, linked to the invitation` : "The list you pasted, linked to the invitation. Its owners get an email.",
      );
    }
    if (state.gifts === "ask") summary.push(`An email to ${state.askEmail || "them"} asking for a ${occasion.list.noun}`);
    if (state.gifts === "exchange") summary.push("A Secret Santa draw. Set the budget and draw date next.");
    if (state.gifts === "everyone") {
      summary.push("Guests link their wishlists when they RSVP and see each other's");
    }
    if (state.gifts === "no_gifts") summary.push("A note on the invitation: “No gifts, please.”");
    if (state.gifts === "later" && asksGifts) summary.push("Nothing about gifts yet");
    // A potluck or a meal train always starts with its sheet, like a gift exchange with its draw.
    const startsSheet = Boolean(occasion.defaults && "signup" in occasion.defaults);
    if (state.gifts === "signup" || startsSheet) {
      summary.push(
        mealTrain
          ? state.date
            ? "A sign-up sheet with a dinner each day for a week. Guests pick a day, and only they see the drop-off address."
            : "A sign-up sheet. Add the days next. Guests pick a day, and only they see the drop-off address."
          : state.occasion === "potluck"
            ? "A sign-up sheet for mains, sides, desserts and drinks. Change the rows next."
            : "A sign-up sheet for things to bring. Change the rows next.",
      );
    }
    if ("defaults" in occasion && occasion.defaults && "askKids" in occasion.defaults) {
      summary.push("The RSVP asks how many kids are coming");
    }
  }

  // Gift lists on their own. They come first, or after events from the Events tab.
  const listsSection = (
    <StepSection>
      <Heading title={eventsFirst ? "Or make a gift list" : "Make a gift list"} />
      <View style={{ gap: spacing.sm }}>
        {LISTS_ON_THEIR_OWN.map((list) => (
          <Choice
            key={list.label}
            selected={false}
            icon={list.icon}
            label={list.label}
            hint={list.hint}
            onPress={() => router.replace({ pathname: "/new-registry", params: list.params })}
          />
        ))}
      </View>
    </StepSection>
  );

  return (
    <>
      <KeyboardScrollView bottomOffset={keyboardFooter.bottomOffset} contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        {state.step !== "what" ? (
          <View accessibilityLabel="Steps" style={{ flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg, rowGap: 4 }}>
            {steps.map((s, index) => {
              const current = index === stepIndex;
              const reached = index <= stepIndex;
              return (
                <View key={s.id} accessibilityState={{ selected: current }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: reached ? theme.tint : "transparent",
                      borderWidth: reached ? 0 : 1,
                      borderColor: theme.border,
                    }}
                  >
                    {index < stepIndex ? (
                      <Icon name="check" size={11} color={theme.onTint} weight="bold" />
                    ) : (
                      <Text variant="caption" style={{ color: reached ? theme.onTint : theme.textTertiary }}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    variant="footnote"
                    tone={current ? "primary" : index < stepIndex ? "secondary" : "tertiary"}
                    style={current ? { fontWeight: "600" } : undefined}
                  >
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {state.step === "what" ? (
          <>
            {eventsFirst ? null : listsSection}

            <StepSection>
              <Heading title={eventsFirst ? "Plan an event" : "Or plan an event"} />
              <View style={{ gap: spacing.lg }}>
                {OCCASION_GROUPS.map((group) => (
                  <View key={group.label} style={{ gap: spacing.sm }}>
                    <Text variant="footnote" tone="tertiary" style={{ fontWeight: "600" }} accessibilityRole="header">
                      {group.label}
                    </Text>
                    {pairs(group.ids).map((row) => (
                      <View key={row.join()} style={{ flexDirection: "row", gap: spacing.sm }}>
                        {row.map((id) => (
                          <OccasionButton key={id} id={id} selected={state.occasion === id} onPress={() => chooseOccasion(id)} />
                        ))}
                        {/* Keeps a lone last button half width. */}
                        {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </StepSection>
            {eventsFirst ? listsSection : null}
          </>
        ) : null}

        {state.step === "who" && occasion ? (
          <StepSection>
            <Heading title={`Who's the ${occasion.label.toLowerCase()} for?`} />
            <View style={{ gap: spacing.sm }}>
              {audiences.map((audience) => (
                <Choice key={audience} selected={state.audience === audience} onPress={() => chooseAudience(audience)} label={AUDIENCE_LABELS[audience]} />
              ))}
            </View>
            {nameLabel ? (
              <Field
                label={nameLabel}
                value={state.name}
                onChangeText={(name) => update({ name })}
                maxLength={100}
                placeholder={state.audience === "us" ? 'e.g., "Alex & Sam"' : 'e.g., "Remi"'}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={afterWho}
              />
            ) : null}
          </StepSection>
        ) : null}

        {state.step === "gifts" && occasion && state.audience ? (
          <StepSection>
            <Heading title="How do gifts work?" />
            {/* Gift lists first, large. Everything else after them, smaller. */}
            <View style={{ gap: spacing.sm }}>
              {giftRows.main.map((plan) => {
                const { label, hint } = giftPlanLabel(plan, state.audience!, occasion, pickableLists.length > 0);
                return (
                  <Choice key={plan} selected={state.gifts === plan} onPress={() => pick(plan)} label={label} hint={hint} icon={PLAN_ICONS[plan]} />
                );
              })}
            </View>
            {state.gifts === "link" && pickableLists.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <View style={{ gap: spacing.sm }}>
                  <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                    Your lists
                  </Text>
                  {pickableLists.map((list) => (
                    <Choice
                      key={list.id}
                      compact
                      selected={state.registryId === list.id}
                      onPress={() => update({ registryId: state.registryId === list.id ? "" : list.id, linkUrl: "" })}
                      label={list.title}
                    />
                  ))}
                </View>
                <Field
                  label="Or paste a link to anyone's list"
                  value={state.linkUrl}
                  onChangeText={(linkUrl) => update({ linkUrl, registryId: "" })}
                  placeholder="regibee.com/r/remi-and-max-1a2b"
                  hint="Guests will see the list, and its owners get an email."
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            ) : null}
            {state.gifts === "link" && pickableLists.length === 0 ? (
              <Field
                label="Link to the list"
                value={state.linkUrl}
                onChangeText={(linkUrl) => update({ linkUrl })}
                placeholder="regibee.com/r/remi-and-max-1a2b"
                hint="Guests will see the list, and its owners get an email."
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            ) : null}
            {state.gifts === "ask" ? (
              <Field
                label={`${state.name.trim() || "Their"}${state.name.trim() ? "'s" : ""} email`}
                value={state.askEmail}
                onChangeText={(askEmail) => update({ askEmail })}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                hint={`We'll email them a link to make a ${occasion.list.noun}.`}
              />
            ) : null}
            {state.gifts === "new_list" ? (
              <Section>
                <SwitchRow
                  label="Also make an invitation"
                  value={state.invitation}
                  onValueChange={(invitation) => update({ invitation })}
                />
              </Section>
            ) : null}
            {giftRows.other.length > 0 ? (
              <View accessibilityLabel="Or" style={{ gap: spacing.sm }}>
                <Text variant="footnote" tone="tertiary" style={{ fontWeight: "600" }}>
                  Or
                </Text>
                {giftRows.other.map((plan) => {
                  const { label, hint } = giftPlanLabel(plan, state.audience!, occasion);
                  return <Choice key={plan} compact selected={state.gifts === plan} onPress={() => pick(plan)} label={label} hint={hint} />;
                })}
              </View>
            ) : null}
          </StepSection>
        ) : null}

        {state.step === "name" && occasion ? (
          <StepSection>
            <Heading title={withEvent ? "Name your event" : "Name your list"} />
            <Field
              label={withEvent ? "Event name" : "List name"}
              value={state.title}
              onChangeText={(title) => update({ title })}
              maxLength={120}
              placeholder={occasion.titlePlaceholder}
              autoCapitalize="words"
            />
            <DateField
              label={mealTrain ? "First day (optional)" : "Date (optional)"}
              value={state.date || null}
              onChange={(date) => update({ date: date ?? "" })}
            />
            {summary.length > 0 ? (
              <View style={{ borderRadius: radius.lg, backgroundColor: theme.surfaceAlt, padding: spacing.lg, gap: spacing.sm }}>
                <Text variant="subhead" style={{ fontWeight: "600" }}>
                  This makes:
                </Text>
                <View style={{ gap: 6 }}>
                  {summary.map((line) => (
                    <View key={line} style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                      <View style={{ paddingTop: 2 }}>
                        <Icon name="check" size={14} color={theme.success} weight="bold" />
                      </View>
                      <Text variant="subhead" tone="secondary" style={{ flex: 1 }}>
                        {line}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </StepSection>
        ) : null}

        <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: spacing.lg }}>
          <Text variant="footnote" tone="tertiary">
            Or{" "}
            <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }} accessibilityRole="link" onPress={() => router.replace("/event-form")}>
              use the full event form
            </Text>
            .
          </Text>
        </View>
      </KeyboardScrollView>

      {state.step !== "what" ? (
        <KeyboardFooter {...keyboardFooter.footerProps} style={{ padding: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg), gap: spacing.sm }}>
          {error ? (
            <Text variant="footnote" tone="danger" style={{ textAlign: "center" }}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button title="Back" variant="secondary" onPress={back} disabled={saving} style={{ flex: 1 }} />
            {state.step === "who" ? <Button title="Next" onPress={afterWho} style={{ flex: 2 }} /> : null}
            {state.step === "gifts" ? <Button title={giftsPicked ? "Next" : "Skip"} onPress={afterGifts} style={{ flex: 2 }} /> : null}
            {state.step === "name" ? (
              <Button
                title={withEvent ? "Make the event" : "Make the list"}
                onPress={() => void make()}
                loading={saving}
                disabled={!state.title.trim()}
                style={{ flex: 2 }}
              />
            ) : null}
          </View>
        </KeyboardFooter>
      ) : null}
    </>
  );
}

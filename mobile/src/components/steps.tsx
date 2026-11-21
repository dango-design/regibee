// The steps of a create form: a stack of cards with one open at a time.
// Finishing a step opens the next one the person hasn't been to yet. The
// website's new event and new registry forms work the same way
// (src/components/step-sections.tsx), and both run on @shared/step-nav.
//
// Where the app differs: a closed step's fields aren't on screen, so the
// screen keeps every value itself, and opening a step scrolls it to the top.

import { useEffect, useReducer, useRef, type ReactNode } from "react";
import {
  LayoutAnimation,
  Pressable,
  Text as RNText,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ViewInstance,
} from "react-native";

import {
  stepFooterLabel,
  stepNavReducer,
  stepStatus,
  type StepInfo,
  type StepNav,
  type StepNavAction,
  type StepStatus,
} from "@shared/step-nav";

import { Icon } from "@/components/icon";
import { Button, haptic, Pill, Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

/** How long a choice stays on screen before its step closes, so the person sees what they picked. */
const ADVANCE_DELAY_MS = 350;

const animateNext = () => LayoutAnimation.configureNext(LayoutAnimation.create(200, "easeInEaseOut", "opacity"));

/** Runs a stack of steps: which one is open, moving on after a choice, and scrolling to the open one. */
export function useSteps<Id extends string>({
  order,
  start,
  steps,
  canFinish,
}: {
  /** The steps, in order. It can change, when a step only shows for some answers. */
  order: readonly Id[];
  start: StepNav<Id>;
  steps: Record<Id, StepInfo>;
  /** Called when the person finishes a step. Return false to keep it open, after showing why. */
  canFinish?: (id: Id) => boolean;
}) {
  const [nav, dispatch] = useReducer(
    (state: StepNav<Id>, action: StepNavAction<Id>) => stepNavReducer(order, state, action),
    start,
  );
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const cards = useRef<Partial<Record<Id, ViewInstance | null>>>({});
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Don't scroll on first load. Only after the person starts using the form.
  const hasInteracted = useRef(false);

  const cancelAdvance = () => {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = undefined;
  };
  useEffect(() => cancelAdvance, []);

  const move = (action: StepNavAction<Id>) => {
    cancelAdvance();
    hasInteracted.current = true;
    animateNext();
    dispatch(action);
  };

  /** Closes a step after a short pause, once the person has made a choice. */
  const advanceSoon = (id: Id) => {
    cancelAdvance();
    advanceTimer.current = setTimeout(() => {
      hasInteracted.current = true;
      animateNext();
      dispatch({ type: "finish", id });
    }, ADVANCE_DELAY_MS);
  };

  const finish = (id: Id) => {
    if (canFinish && !canFinish(id)) {
      cancelAdvance();
      return;
    }
    move({ type: "finish", id });
  };

  // Once the step above has closed, scroll the open one to the top. Where the
  // card is gets measured then: a card that only moved doesn't report it.
  useEffect(() => {
    if (!hasInteracted.current || !nav.open) return;
    const id = nav.open;
    const timer = setTimeout(() => {
      const card = cards.current[id];
      const scroll = scrollRef.current;
      if (!card || !scroll) return;
      card.measureInWindow((_x, cardTop) => {
        scroll.measureInWindow((_sx, scrollTop) => {
          scroll.scrollTo({ y: Math.max(0, scrollY.current + cardTop - scrollTop - spacing.md), animated: true });
        });
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [nav.open]);

  /** For the ScrollView that holds the steps. */
  const scrollProps = {
    ref: scrollRef,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = event.nativeEvent.contentOffset.y;
    },
    scrollEventThrottle: 32,
  };

  /**
   * The props for a step's StepCard. Upcoming steps show no summary unless
   * `showWhenUpcoming`, for a step whose defaults the person gets if they skip it.
   */
  const stepProps = (id: Id, summary: ReactNode, { showWhenUpcoming = false } = {}) => {
    const status = stepStatus(nav, id, steps[id]);
    return {
      step: order.indexOf(id) + 1,
      optional: steps[id].optional,
      status,
      summary: status === "upcoming" && !showWhenUpcoming ? undefined : summary,
      onToggle: () => move({ type: "toggle", id }),
      cardRef: (card: ViewInstance | null) => {
        cards.current[id] = card;
      },
    };
  };

  /** "Skip" while an optional step is empty, and "Done" when no unvisited step is left after this one. */
  const footerLabel = (id: Id) => stepFooterLabel(order, nav, id, steps[id]);

  return { nav, move, advanceSoon, cancelAdvance, finish, footerLabel, stepProps, scrollProps };
}

function StepMarker({ step, status }: { step: number; status: StepStatus }) {
  const theme = useTheme();
  const size = { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" } as const;
  if (status === "done") {
    return (
      <View style={[size, { backgroundColor: theme.success }]}>
        <Icon name="check" size={13} color={theme.onTint} weight="bold" />
      </View>
    );
  }
  const open = status === "open";
  const incomplete = status === "incomplete";
  return (
    <View
      style={[
        size,
        {
          backgroundColor: open ? theme.tint : incomplete ? theme.dangerSoft : "transparent",
          borderWidth: open ? 0 : 1,
          borderColor: incomplete ? theme.danger : theme.border,
        },
      ]}
    >
      <RNText style={{ fontSize: 13, fontWeight: "700", color: open ? theme.onTint : incomplete ? theme.danger : theme.textTertiary }}>
        {step}
      </RNText>
    </View>
  );
}

/** One step: a header that opens and closes it, with a summary while it's closed. */
export function StepCard({
  step,
  title,
  optional = false,
  status,
  summary,
  onToggle,
  cardRef,
  children,
}: {
  step: number;
  title: string;
  optional?: boolean;
  status: StepStatus;
  /** A line of text, or an element for a summary that isn't plain text. */
  summary?: ReactNode;
  onToggle: () => void;
  cardRef: (card: ViewInstance | null) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const open = status === "open";
  return (
    <View
      ref={cardRef}
      style={{
        borderRadius: radius.lg,
        borderWidth: open ? 2 : 1,
        borderColor: open ? theme.tint : theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptic();
          onToggle();
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          minHeight: 56,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <StepMarker step={step} status={status} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }}>
            <Text variant="headline" tone={status === "upcoming" ? "tertiary" : "primary"}>
              {title}
            </Text>
            {optional ? <Pill label="Optional" /> : null}
          </View>
          {!open && summary ? (
            typeof summary === "string" ? (
              <Text variant="footnote" tone="tertiary" numberOfLines={1}>
                {summary}
              </Text>
            ) : (
              summary
            )
          ) : null}
        </View>
        {!open && status !== "upcoming" ? (
          <Text variant="subhead" tone="tint" style={{ fontWeight: "600" }}>
            {status === "skipped" ? "Add" : "Edit"}
          </Text>
        ) : null}
      </Pressable>
      {open ? <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg }}>{children}</View> : null}
    </View>
  );
}

/** A step's button: Continue, Skip or Done. */
export function StepFooter({ label, onPress, primary = true }: { label: string; onPress: () => void; primary?: boolean }) {
  return <Button title={label} size="medium" variant={primary ? "primary" : "secondary"} onPress={onPress} style={{ alignSelf: "flex-start" }} />;
}

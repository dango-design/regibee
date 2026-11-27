// "Plan an event" and "Edit event": the website's event form
// (src/components/event-form.tsx) and its RSVP questions editor
// (src/components/rsvp-questions-editor.tsx), with the same fields, words,
// defaults and checks. Saving runs the website's own createEvent and
// updateEvent, with the same form field names. Change both together.
//
// A new event goes in steps, one open at a time, like on the website: the
// steps, their names and summaries come from @shared/event-steps. Editing an
// event shows every section at once.
//
// Where the app differs: dates and times use the phone's pickers, menus are
// rows of choices, and the invitation picture comes from the photo library.
// On an existing event the picture uploads and saves as soon as it's picked,
// instead of when the form is saved.
//
// Editing takes a `section` param, one of the website's edit page sections
// (@shared/edit-event-sections). The form opens scrolled to it, like the
// website's links to /dashboard/events/<id>/edit#gifts.

import { Image } from "expo-image";
import type { ImagePickerAsset } from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { EditEventSection } from "@shared/edit-event-sections";
import { changedParts, changeSummary } from "@shared/event-updates";
import {
  COMMON_TIME_ZONES,
  EVENT_TYPE_OPTIONS,
  EXCHANGE_KINDS,
  exchangeKind,
  GIFT_NOTE_PRESETS,
  MAX_GIFT_NOTE_LENGTH,
  MAX_PARTY_SIZE_LIMIT,
  type EventType,
  type ExchangeKind,
} from "@shared/events";
import type { EventFormData } from "@shared/events-page-types";
import {
  MAX_OPTIONS,
  MAX_QUESTION_LABEL_LENGTH,
  MAX_QUESTIONS,
  newQuestion,
  QUESTION_KIND_IDS,
  QUESTION_KINDS,
  defaultQuestions,
  storedQuestions,
  type QuestionKind,
  type RsvpQuestion,
} from "@shared/rsvp-questions";
import { startingExchange } from "@shared/occasions";
import { hidesAddressUntilSignup } from "@shared/signups";
import {
  eventStepInfo,
  eventStepSummaries,
  eventStepTitle,
  newEventSteps,
  type EventStepId,
  type EventStepValues,
} from "@shared/event-steps";

import { DateField } from "@/components/date-field";
import { ThemeColorField } from "@/components/event/theme-color-field";
import { Icon } from "@/components/icon";
import { KeyboardFooter, KeyboardScrollView, useKeyboardFooter } from "@/components/keyboard";
import { StepCard, StepFooter, useSteps } from "@/components/steps";
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  ErrorState,
  Field,
  haptic,
  IconButton,
  LoadingState,
  Section,
  Stepper,
  SwitchRow,
  Text,
} from "@/components/ui";
import { form, runAction } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { useEventForm, useRunEventAction } from "@/lib/events-data";
import { pickPhoto, uploadEventImage } from "@/lib/photos";
import { radius, spacing, useTheme } from "@/lib/theme";

/** A registry on the form's list of links. */
interface FormRegistry {
  id: string;
  title: string;
  /** Whose list it is, when it isn't the host's: "Remi & Max". */
  honoree?: string | null;
  /** Set for a registry added by pasting its link, which is how the server checks it. */
  link?: string;
}

export default function EventFormScreen() {
  const { eventId, registryId, section } = useLocalSearchParams<{ eventId?: string; registryId?: string; section?: string }>();
  const { demo } = useSession();
  const query = useEventForm(eventId ?? null);
  const editing = Boolean(eventId);

  let body;
  if (demo) {
    body = <EmptyState icon="party" title="Events need an account" message="Make an account to plan events." />;
  } else if (query.data) {
    body = <EventForm eventId={eventId} startRegistryId={registryId ?? null} startSection={section ?? null} data={query.data} />;
  } else if (query.error) {
    body = <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  } else {
    body = <LoadingState />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: editing ? "Edit event" : "Plan an event",
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

/** A section of the form: a heading, then its fields. */
function Group({
  title,
  onLayout,
  children,
}: {
  title: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.md }} onLayout={onLayout}>
      <Text variant="headline">{title}</Text>
      {children}
    </View>
  );
}

/** A label above a group of choices, styled like a field's label. */
function Label({ children }: { children: string }) {
  return (
    <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
      {children}
    </Text>
  );
}

/** A switch with a label and a hint. Like SwitchRow, but it can be turned off, and can sit inside a card. */
function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  disabled = false,
  padded = true,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  padded?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        haptic();
        onValueChange(!value);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: padded ? spacing.lg : 0,
        paddingVertical: padded ? spacing.md : 0,
        minHeight: padded ? 52 : 40,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout">{label}</Text>
        {hint ? (
          <Text variant="footnote" tone="tertiary">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          haptic();
          onValueChange(next);
        }}
        trackColor={{ true: theme.tint, false: theme.border }}
        thumbColor={Platform.OS === "android" ? theme.surface : undefined}
      />
    </Pressable>
  );
}

/** The time zone this phone is in, like America/Los_Angeles. Empty if the phone doesn't say. */
function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/** Creates or edits an event. A new event's picture uploads once the event is saved. */
function EventForm({
  eventId,
  startRegistryId,
  startSection,
  data,
}: {
  eventId?: string;
  startRegistryId: string | null;
  /** The section the edit form opens at. The event's page passes it. */
  startSection: string | null;
  data: EventFormData;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardFooter = useKeyboardFooter();
  const { run } = useRunEventAction();
  const editing = Boolean(eventId);
  const { registries, exchange } = data;

  const [eventType, setEventType] = useState<EventType>(data.event?.event_type ?? "baby_shower");
  const [title, setTitle] = useState(data.event?.title ?? "");
  const [hostedBy, setHostedBy] = useState(data.event?.hosted_by ?? "");
  const [eventDate, setEventDate] = useState(data.event?.event_date ?? "");
  const [startTime, setStartTime] = useState(data.event?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(data.event?.end_time?.slice(0, 5) ?? "");
  // New events start in the phone's own time zone, and so do events saved without one.
  const [timeZone, setTimeZone] = useState(data.event?.time_zone || deviceTimeZone());
  const [locationName, setLocationName] = useState(data.event?.location_name ?? "");
  const [locationAddress, setLocationAddress] = useState(data.event?.location_address ?? "");
  const [message, setMessage] = useState(data.event?.message ?? "");
  const [rsvpBy, setRsvpBy] = useState(data.event?.rsvp_by ?? "");
  const [maxPartySize, setMaxPartySize] = useState(data.event?.max_party_size ?? 2);
  const [openRsvp, setOpenRsvp] = useState(data.event?.open_rsvp ?? true);
  const [emailHost, setEmailHost] = useState(data.event?.email_host_on_rsvp ?? true);
  const [askKids, setAskKids] = useState(data.event?.ask_kids ?? false);
  const [giftNote, setGiftNote] = useState(data.event?.gift_note ?? "");
  // The invitation's color: "" for none.
  const [themeColor, setThemeColor] = useState(data.event?.theme_color ?? "");
  // A new event starts with its occasion's questions; an existing one keeps its own.
  const [questions, setQuestions] = useState<RsvpQuestion[]>(() =>
    data.event
      ? storedQuestions(data.event.rsvp_questions)
      : defaultQuestions(EVENT_TYPE_OPTIONS.find((o) => o.value === "baby_shower")?.defaults?.questions),
  );
  const [remindDayBefore, setRemindDayBefore] = useState(data.event?.remind_day_before ?? true);
  const [autoRsvpReminder, setAutoRsvpReminder] = useState(data.event?.auto_rsvp_reminder ?? true);
  const [notifyGuests, setNotifyGuests] = useState(true);

  // Linked registries. "Plan an event" on a list's page starts with that one.
  const [linked, setLinked] = useState<FormRegistry[]>(() => {
    if (editing) return data.linkedRegistries;
    const start = registries.find((r) => r.id === startRegistryId);
    return start ? [{ id: start.id, title: start.title }] : [];
  });
  const [pasted, setPasted] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [linkError, setLinkError] = useState("");

  // The gift exchange.
  const [exchangeOn, setExchangeOn] = useState(Boolean(exchange));
  // A Secret Santa occasion draws names. Anything else, like a family
  // Christmas, starts with everyone giving everyone.
  const [kind, setKind] = useState<ExchangeKind>(
    exchange ? exchangeKind(exchange) : startingExchange(data.event?.event_type ?? "baby_shower").kind,
  );
  const [budget, setBudget] = useState(exchange?.budget ?? "");
  const [drawBy, setDrawBy] = useState(exchange?.draw_by ?? "");
  const [mailed, setMailed] = useState(exchange?.mailed ?? false);
  const drawn = Boolean(exchange?.drawn_at);
  // Choosing an occasion on a new event sets its defaults, but never undoes
  // a choice the host made themselves.
  const [touched, setTouched] = useState({ exchange: false, askKids: false, questions: false });

  // The picture. A new event keeps the picked photo on the phone until the
  // event is saved. An existing event uploads it straight away.
  const [imageUrl, setImageUrl] = useState<string | null>(data.event?.image_url ?? null);
  const [picked, setPicked] = useState<ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);

  // The edit form scrolls to `startSection` once, when that section is laid out.
  const editScroll = useRef<ScrollViewInstance>(null);
  const scrolledToSection = useRef(false);
  const sectionLayout = (id: EditEventSection, event: LayoutChangeEvent) => {
    if (id !== startSection || scrolledToSection.current) return;
    scrolledToSection.current = true;
    const y = Math.max(0, event.nativeEvent.layout.y - spacing.md);
    requestAnimationFrame(() => editScroll.current?.scrollTo({ y, animated: false }));
  };

  const zoneOptions = [...COMMON_TIME_ZONES];
  if (timeZone && !zoneOptions.some((z) => z.value === timeZone)) {
    zoneOptions.unshift({ value: timeZone, label: timeZone.replaceAll("_", " ") });
  }

  const typeOption = EVENT_TYPE_OPTIONS.find((o) => o.value === eventType) ?? EVENT_TYPE_OPTIONS[0];
  const shownImage = picked?.uri ?? imageUrl;
  const pickable = registries.filter((r) => !linked.some((l) => l.id === r.id));

  const chooseType = (type: EventType) => {
    setEventType(type);
    if (editing) return;
    const defaults = EVENT_TYPE_OPTIONS.find((o) => o.value === type)?.defaults ?? {};
    // Christmas and a holiday party start with each guest linking their own
    // wishlist, and a gift exchange with drawing names.
    if (!touched.exchange) {
      const start = startingExchange(type);
      setExchangeOn(start.on);
      setKind(start.kind);
    }
    if (!touched.askKids) setAskKids(Boolean(defaults.askKids));
    if (!touched.questions) setQuestions(defaultQuestions(defaults.questions));
  };

  // On an existing event, a new date, time or place can email guests.
  const changes = editing
    ? changedParts(
        {
          event_date: data.event?.event_date ?? null,
          start_time: data.event?.start_time ?? null,
          end_time: data.event?.end_time ?? null,
          time_zone: data.event?.time_zone ?? null,
          location_name: data.event?.location_name ?? null,
          location_address: data.event?.location_address ?? null,
        },
        {
          event_date: eventDate || null,
          start_time: startTime || null,
          end_time: endTime || null,
          time_zone: timeZone || null,
          location_name: locationName || null,
          location_address: locationAddress || null,
        },
      )
    : [];

  const addPastedLink = async () => {
    const link = pasted.trim();
    if (!link) return;
    setLookingUp(true);
    setLinkError("");
    try {
      const { result } = await runAction<{ registry: { id: string; title: string; honoree: string | null } }>(
        "events.lookupRegistryLink",
        link,
      );
      if (!linked.some((l) => l.id === result.registry.id)) {
        setLinked([...linked, { ...result.registry, link }]);
      }
      setPasted("");
    } catch (e) {
      setLinkError(errorMessage(e));
    } finally {
      setLookingUp(false);
    }
  };

  const choosePicture = async () => {
    const asset = await pickPhoto();
    if (!asset) return;
    setImageError("");
    if (!eventId) {
      setPicked(asset);
      return;
    }
    // An existing event saves the new picture now.
    setPicked(asset);
    setUploading(true);
    try {
      const url = await uploadEventImage(eventId, asset);
      await run("events.setEventImage", eventId, url);
      setImageUrl(url);
    } catch (e) {
      setImageError(errorMessage(e));
    } finally {
      setPicked(null);
      setUploading(false);
    }
  };

  const removePicture = () => {
    setImageError("");
    if (!eventId) {
      setPicked(null);
      setImageUrl(null);
      return;
    }
    Alert.alert("Remove the invitation picture?", "Guests stop seeing it right away.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setUploading(true);
          try {
            await run("events.setEventImage", eventId, null);
            setImageUrl(null);
          } catch (e) {
            setImageError(errorMessage(e));
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
  };

  // ── A new event's steps (@shared/event-steps) ────────────────

  const stepValues: EventStepValues = {
    eventType,
    title,
    eventDate,
    startTime,
    endTime,
    timeZone,
    locationName,
    locationAddress,
    linkedTitles: linked.map((r) => r.title),
    giftNote,
    exchangeOn,
    exchangeKind: kind,
    budget,
    hasPicture: Boolean(shownImage),
    hostedBy,
    message,
    maxPartySize,
    openRsvp,
    rsvpBy,
  };
  const stepOrder = newEventSteps(eventType, exchangeOn);
  const stepInfo = eventStepInfo(stepValues);
  const { nav, move, advanceSoon, finish, footerLabel, stepProps, scrollProps } = useSteps({
    order: stepOrder,
    start: { open: editing ? null : "what", visited: new Set<EventStepId>() },
    steps: stepInfo,
    canFinish: (id) => {
      if (id === "details" && !title.trim()) {
        setTitleError(true);
        return false;
      }
      return true;
    },
  });
  const stepSummaries = eventStepSummaries(stepValues, typeOption.label);
  /** A step's card: its title and summary. */
  const stepCard = (id: EventStepId, options?: { showWhenUpcoming?: boolean }) => ({
    title: eventStepTitle(id, eventType),
    ...stepProps(
      id,
      id === "details" && !stepSummaries.details ? (
        <Text variant="footnote" tone="danger">
          Needs a name
        </Text>
      ) : (
        stepSummaries[id]
      ),
      options,
    ),
  });

  // The same field names the website's form sends (readEventForm and
  // readExchangeForm in src/lib/actions/events.ts read them).
  const formFields = () => ({
    eventType,
    title,
    hostedBy,
    eventDate,
    startTime,
    endTime,
    timeZone,
    locationName,
    locationAddress,
    message,
    rsvpBy,
    maxPartySize: String(maxPartySize),
    openRsvp: String(openRsvp),
    emailHostOnRsvp: String(emailHost),
    askKids: String(askKids),
    rsvpQuestions: JSON.stringify(questions),
    remindDayBefore: String(remindDayBefore),
    autoRsvpReminder: String(autoRsvpReminder),
    notifyGuests: String(notifyGuests && changes.length > 0),
    giftNote,
    themeColor,
    registryLinks: JSON.stringify(linked.map((r) => (r.link ? { link: r.link } : { id: r.id }))),
    exchangeEnabled: String(exchangeOn),
    exchangeKind: kind,
    exchangeBudget: budget,
    exchangeDrawBy: drawBy,
    exchangeMailed: String(mailed),
  });

  const submit = async () => {
    if (!title.trim()) {
      if (editing) {
        setError("Give your event a name.");
      } else {
        // The name's step shows what's missing.
        setTitleError(true);
        if (nav.open !== "details") move({ type: "open", id: "details" });
      }
      return;
    }
    setSaving(true);
    setError("");

    if (eventId) {
      try {
        await run("events.updateEvent", eventId, form(formFields()));
      } catch (e) {
        setError(errorMessage(e));
        setSaving(false);
        return;
      }
      haptic("success");
      router.back();
      return;
    }

    let created: { id: string };
    try {
      created = await run<{ id: string }>("events.createEvent", form(formFields()));
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
      return;
    }
    // The event exists now, so its folder takes uploads. If the picture fails,
    // the event is still saved, and the host adds the picture from Edit.
    let imageFailed = false;
    if (picked) {
      try {
        const url = await uploadEventImage(created.id, picked);
        await run("events.setEventImage", created.id, url);
      } catch {
        imageFailed = true;
      }
    }
    haptic("success");
    // Close this form, then open the new event.
    router.back();
    router.push({ pathname: "/events/[eventId]", params: { eventId: created.id } });
    if (imageFailed) {
      // The website shows this on the event's page (?image=failed).
      Alert.alert("The picture didn't upload", "Your event is saved, but the invitation picture didn't upload. Add it again from Edit.");
    }
  };

  // ── Fields both layouts show ─────────────────────────────────

  const changeAskKids = (value: boolean) => {
    setAskKids(value);
    setTouched((t) => ({ ...t, askKids: true }));
  };
  const changeQuestions = (next: RsvpQuestion[]) => {
    setQuestions(next);
    setTouched((t) => ({ ...t, questions: true }));
  };

  const pictureField = (
    <>
      {shownImage ? (
        <View style={{ gap: spacing.md }}>
          <View>
            <Image
              source={{ uri: shownImage }}
              style={{ width: "100%", height: 288, borderRadius: radius.md, backgroundColor: theme.surfaceAlt }}
              contentFit="contain"
              transition={150}
              accessibilityLabel="Invitation preview"
              accessibilityIgnoresInvertColors
            />
            {uploading ? (
              <View
                style={{
                  ...StyleSheet.absoluteFill,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.md,
                  backgroundColor: "rgba(0,0,0,0.25)",
                }}
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button title="Change" icon="image" variant="secondary" size="medium" onPress={choosePicture} disabled={uploading} style={{ flex: 1 }} />
            <Button title="Remove" icon="trash" variant="secondary" size="medium" onPress={removePicture} disabled={uploading} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload your invitation"
          disabled={uploading}
          onPress={() => {
            haptic();
            choosePicture();
          }}
          style={({ pressed }) => ({
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            paddingVertical: spacing.xxl,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.lg,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: pressed ? theme.tint : theme.border,
            backgroundColor: pressed ? theme.tintSoft : "transparent",
          })}
        >
          {uploading ? <ActivityIndicator color={theme.tint} /> : <Icon name="image" size={30} color={theme.tint} />}
          <Text variant="callout" style={{ fontWeight: "600" }}>
            Upload your invitation
          </Text>
        </Pressable>
      )}
      {imageError ? (
        <Text variant="footnote" tone="danger">
          {imageError}
        </Text>
      ) : null}
    </>
  );

  /** The new event's steps leave out the longer explanations. */
  const registryFields = (brief: boolean) => (
    <>
      {linked.length > 0 ? (
        <Section>
          {linked.map((registry, index) => (
            <View key={registry.id}>
              {index > 0 ? <Divider inset={spacing.lg} /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.lg, paddingRight: spacing.sm, minHeight: 52 }}>
                <Icon name="gift" size={18} color={theme.tint} />
                <View style={{ flex: 1, paddingVertical: spacing.sm }}>
                  <Text variant="callout" numberOfLines={1} style={{ fontWeight: "500" }}>
                    {registry.title}
                  </Text>
                  {registry.honoree ? (
                    <Text variant="footnote" tone="tertiary" numberOfLines={1}>
                      {registry.honoree}
                    </Text>
                  ) : null}
                </View>
                <IconButton
                  icon="close"
                  size={18}
                  color={theme.textTertiary}
                  accessibilityLabel={`Unlink ${registry.title}`}
                  onPress={() => setLinked(linked.filter((l) => l.id !== registry.id))}
                />
              </View>
            </View>
          ))}
        </Section>
      ) : null}
      {pickable.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Label>{linked.length > 0 ? "Add another of your registries" : "Add one of your registries"}</Label>
          <Section>
            {pickable.map((registry, index) => (
              <View key={registry.id}>
                {index > 0 ? <Divider inset={spacing.lg} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Link ${registry.title}`}
                  onPress={() => {
                    haptic();
                    setLinked([...linked, { id: registry.id, title: registry.title }]);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingHorizontal: spacing.lg,
                    minHeight: 50,
                    backgroundColor: pressed ? theme.surfaceAlt : "transparent",
                  })}
                >
                  <Icon name="add" size={17} color={theme.tint} />
                  <Text variant="callout" numberOfLines={1} style={{ flex: 1 }}>
                    {registry.title}
                  </Text>
                </Pressable>
              </View>
            ))}
          </Section>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Or paste a registry link"
            value={pasted}
            onChangeText={(value) => {
              setPasted(value);
              setLinkError("");
            }}
            placeholder="regibee.com/r/remi-and-max-1a2b"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={() => void addPastedLink()}
          />
        </View>
        <Button
          title={lookingUp ? "Finding…" : "Link"}
          variant="secondary"
          size="medium"
          onPress={() => void addPastedLink()}
          disabled={lookingUp || !pasted.trim()}
          style={{ height: 50 }}
        />
      </View>
      {brief ? (
        <Text variant="footnote" tone="tertiary">
          Linking someone else's list emails them.
        </Text>
      ) : null}
      {linkError ? (
        <Text variant="footnote" tone="danger">
          {linkError}
        </Text>
      ) : null}
      {registries.length === 0 && linked.length === 0 ? (
        <Text variant="footnote" tone="tertiary">
          Don't have a registry yet?{" "}
          <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }} accessibilityRole="link" onPress={() => router.push("/new-registry")}>
            Create one
          </Text>{" "}
          and link it here later.
        </Text>
      ) : null}
    </>
  );

  const giftNoteField = (
    <View style={{ gap: spacing.sm }}>
      <Label>Gift note (optional)</Label>
      <View accessibilityLabel="Ready-made gift notes" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {GIFT_NOTE_PRESETS.map((preset) => (
          <Chip key={preset.label} label={preset.label} selected={giftNote === preset.text} onPress={() => setGiftNote(preset.text)} />
        ))}
      </View>
      <Field
        accessibilityLabel="Gift note"
        value={giftNote}
        onChangeText={setGiftNote}
        maxLength={MAX_GIFT_NOTE_LENGTH}
        multiline
        placeholder="Instead of a card, bring a favorite children's book with a note inside."
      />
    </View>
  );

  /** Everything under "Guests give gifts to each other", once it's on. */
  const exchangeDetails = (brief: boolean) =>
    exchangeOn ? (
      <View style={{ gap: spacing.md }}>
        <View accessibilityLabel="How gifts work" style={{ gap: spacing.sm }}>
          {EXCHANGE_KINDS.map((option) => {
            const selected = kind === option.value;
            const disabled = drawn && !selected;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => {
                  haptic();
                  setKind(option.value);
                }}
                style={({ pressed }) => ({
                  gap: 4,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? theme.tint : theme.border,
                  backgroundColor: selected ? theme.tintSoft : theme.surface,
                  opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
                })}
              >
                <Text variant="callout" style={{ fontWeight: "600" }}>
                  {option.label}
                </Text>
                <Text variant="footnote" tone="tertiary">
                  {option.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Field
          label={kind === "everyone" ? "Budget per gift (optional)" : "Budget (optional)"}
          value={budget}
          onChangeText={setBudget}
          maxLength={40}
          placeholder="$25"
        />
        {kind === "draw" ? (
          <DateField
            label="Draw names by (optional)"
            value={drawBy || null}
            onChange={(value) => setDrawBy(value ?? "")}
          />
        ) : null}
        {kind === "everyone" && !brief ? (
          <Text variant="footnote" tone="tertiary">
            Nobody sees what's been reserved from their own list until the day after.
          </Text>
        ) : null}
        {kind === "draw" ? (
          <Section>
            <ToggleRow
              label="There's no get-together: gifts are mailed"
              hint={brief ? undefined : "Guests give a shipping address. Only the person who draws them sees it."}
              value={mailed}
              onValueChange={setMailed}
            />
          </Section>
        ) : null}
      </View>
    ) : null;

  if (!editing) {
    const hidesAddress = hidesAddressUntilSignup(eventType);
    return (
      <>
        <KeyboardScrollView bottomOffset={keyboardFooter.bottomOffset} {...scrollProps} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <StepCard {...stepCard("what")}>
            <View accessibilityLabel="Occasion" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {EVENT_TYPE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={eventType === option.value}
                  onPress={() => {
                    chooseType(option.value);
                    advanceSoon("what");
                  }}
                />
              ))}
            </View>
          </StepCard>

          <StepCard {...stepCard("details")}>
            <Field
              label="Event name"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                if (value.trim()) setTitleError(false);
              }}
              error={titleError ? "Give your event a name." : null}
              maxLength={120}
              placeholder={typeOption.titlePlaceholder}
              autoCapitalize="words"
              autoFocus={!title}
              returnKeyType="next"
              onSubmitEditing={() => finish("details")}
            />
            <DateField label="Date (optional)" value={eventDate || null} onChange={(value) => setEventDate(value ?? "")} />
            <StepFooter label={footerLabel("details")} onPress={() => finish("details")} />
          </StepCard>

          <StepCard {...stepCard("when")}>
            <DateField label="Starts" mode="time" value={startTime || null} onChange={(value) => setStartTime(value ?? "")} />
            <DateField label="Ends (optional)" mode="time" value={endTime || null} onChange={(value) => setEndTime(value ?? "")} />
            <View style={{ gap: spacing.sm }}>
              <Label>Time zone</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {zoneOptions.map((zone) => (
                  <Chip key={zone.value} label={zone.label} selected={timeZone === zone.value} onPress={() => setTimeZone(zone.value)} />
                ))}
              </View>
            </View>
            {hidesAddress ? (
              <Field
                label="Drop-off address"
                value={locationAddress}
                onChangeText={setLocationAddress}
                maxLength={300}
                multiline
                placeholder={"123 Main St\nSan Francisco, CA 94102"}
                hint="Only people who sign up for a day see it."
                textContentType="fullStreetAddress"
              />
            ) : (
              <>
                <Field label="Place" value={locationName} onChangeText={setLocationName} maxLength={120} placeholder={`e.g., "Grandma's house"`} />
                <Field
                  label="Address"
                  value={locationAddress}
                  onChangeText={setLocationAddress}
                  maxLength={300}
                  multiline
                  placeholder={"123 Main St\nSan Francisco, CA 94102"}
                  hint="Only people with the event link see it."
                  textContentType="fullStreetAddress"
                />
              </>
            )}
            <StepFooter label={footerLabel("when")} onPress={() => finish("when")} primary={stepInfo.when.hasContent} />
          </StepCard>

          <StepCard {...stepCard("gifts")}>
            <View style={{ gap: spacing.md }}>{registryFields(true)}</View>
            {giftNoteField}
            <StepFooter label={footerLabel("gifts")} onPress={() => finish("gifts")} primary={stepInfo.gifts.hasContent} />
          </StepCard>

          {stepOrder.includes("exchange") ? (
            <StepCard {...stepCard("exchange")}>
              <Section>
                <ToggleRow
                  label="Guests give gifts to each other"
                  value={exchangeOn}
                  onValueChange={(value) => {
                    setExchangeOn(value);
                    setTouched((t) => ({ ...t, exchange: true }));
                  }}
                />
              </Section>
              {exchangeDetails(true)}
              <StepFooter label={footerLabel("exchange")} onPress={() => finish("exchange")} primary={stepInfo.exchange.hasContent} />
            </StepCard>
          ) : null}

          <StepCard {...stepCard("invitation")}>
            {pictureField}
            <ThemeColorField value={themeColor} onChange={setThemeColor} />
            <Field
              label="Hosted by (optional)"
              value={hostedBy}
              onChangeText={setHostedBy}
              maxLength={120}
              placeholder='e.g., "Aunt Linda & Grandma Jo"'
              autoCapitalize="words"
            />
            <Field
              label="Message to guests (optional)"
              value={message}
              onChangeText={setMessage}
              maxLength={2000}
              multiline
              placeholder="Parking, dress code, what to bring: anything guests should know."
            />
            <StepFooter label={footerLabel("invitation")} onPress={() => finish("invitation")} primary={stepInfo.invitation.hasContent} />
          </StepCard>

          {/* RSVPs shows the settings the event gets if the host skips it. */}
          <StepCard {...stepCard("rsvps", { showWhenUpcoming: true })}>
            <DateField label="Reply by (optional)" value={rsvpBy || null} onChange={(value) => setRsvpBy(value ?? "")} />
            <View style={{ gap: 6 }}>
              <Label>People per RSVP</Label>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Stepper value={maxPartySize} onChange={setMaxPartySize} min={1} max={MAX_PARTY_SIZE_LIMIT} />
                {maxPartySize === 1 ? (
                  <Text variant="subhead" tone="secondary">
                    Just the guest
                  </Text>
                ) : null}
              </View>
              <Text variant="footnote" tone="tertiary">
                Including the guest.
              </Text>
            </View>
            <Section>
              <SwitchRow label="Anyone with the event link can RSVP" value={openRsvp} onValueChange={setOpenRsvp} />
              <Divider inset={spacing.lg} />
              <SwitchRow label="Ask how many kids are coming" value={askKids} onValueChange={changeAskKids} />
              <Divider inset={spacing.lg} />
              <SwitchRow label="Email me when someone RSVPs" value={emailHost} onValueChange={setEmailHost} />
              <Divider inset={spacing.lg} />
              <SwitchRow label="Email everyone going a reminder the day before" value={remindDayBefore} onValueChange={setRemindDayBefore} />
              {rsvpBy ? (
                <>
                  <Divider inset={spacing.lg} />
                  <SwitchRow label="Remind guests who haven't replied, 3 days before the reply-by date" value={autoRsvpReminder} onValueChange={setAutoRsvpReminder} />
                </>
              ) : null}
            </Section>
            <RsvpQuestionsEditor questions={questions} onChange={changeQuestions} />
            <StepFooter label={footerLabel("rsvps")} onPress={() => finish("rsvps")} />
          </StepCard>
        </KeyboardScrollView>
        <KeyboardFooter {...keyboardFooter.footerProps} style={{ padding: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg), gap: spacing.sm }}>
          {error ? (
            <Text variant="footnote" tone="danger" style={{ textAlign: "center" }}>
              {error}
            </Text>
          ) : null}
          <Button title="Create event" onPress={() => void submit()} loading={saving} />
        </KeyboardFooter>
      </>
    );
  }

  return (
    <>
      <KeyboardScrollView bottomOffset={keyboardFooter.bottomOffset} ref={editScroll} contentContainerStyle={{ padding: spacing.lg, gap: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Group title="What are you celebrating?" onLayout={(event) => sectionLayout("details", event)}>
          <View accessibilityLabel="Occasion" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {EVENT_TYPE_OPTIONS.map((option) => (
              <Chip key={option.value} label={option.label} selected={eventType === option.value} onPress={() => chooseType(option.value)} />
            ))}
          </View>
          <Field
            label="Event name"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder={typeOption.titlePlaceholder}
            autoCapitalize="words"
          />
          <Field
            label="Hosted by (optional)"
            value={hostedBy}
            onChangeText={setHostedBy}
            maxLength={120}
            placeholder='e.g., "Aunt Linda & Grandma Jo"'
            hint="Emails to guests come from this name."
            autoCapitalize="words"
          />
        </Group>

        <Group
          title="Invitation"
          onLayout={(event) => sectionLayout("invitation", event)}
        >
          {pictureField}
          <ThemeColorField value={themeColor} onChange={setThemeColor} />
        </Group>

        <Group title="When" onLayout={(event) => sectionLayout("when", event)}>
          <DateField label="Date" value={eventDate || null} onChange={(value) => setEventDate(value ?? "")} />
          <View style={{ gap: spacing.sm }}>
            <Label>Time zone</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {zoneOptions.map((zone) => (
                <Chip key={zone.value} label={zone.label} selected={timeZone === zone.value} onPress={() => setTimeZone(zone.value)} />
              ))}
            </View>
          </View>
          <DateField label="Starts" mode="time" value={startTime || null} onChange={(value) => setStartTime(value ?? "")} />
          <DateField label="Ends (optional)" mode="time" value={endTime || null} onChange={(value) => setEndTime(value ?? "")} />
        </Group>

        {hidesAddressUntilSignup(eventType) ? (
          <Group title="Where to drop off" onLayout={(event) => sectionLayout("where", event)}>
            <Field
              label="Drop-off address"
              value={locationAddress}
              onChangeText={setLocationAddress}
              maxLength={300}
              multiline
              placeholder={"123 Main St\nSan Francisco, CA 94102"}
              hint="Only people who sign up for a day see it."
              textContentType="fullStreetAddress"
            />
          </Group>
        ) : (
          <Group title="Where" onLayout={(event) => sectionLayout("where", event)}>
            <Field
              label="Place"
              value={locationName}
              onChangeText={setLocationName}
              maxLength={120}
              placeholder={`e.g., "Grandma's house" or "The Garden Room"`}
            />
            <Field
              label="Address"
              value={locationAddress}
              onChangeText={setLocationAddress}
              maxLength={300}
              multiline
              placeholder={"123 Main St\nSan Francisco, CA 94102"}
              hint="Only people with the event link see it."
              textContentType="fullStreetAddress"
            />
          </Group>
        )}

        <Group
          title="Message to guests"
          onLayout={(event) => sectionLayout("message", event)}
        >
          <Field
            accessibilityLabel="Message to guests"
            value={message}
            onChangeText={setMessage}
            maxLength={2000}
            multiline
            placeholder="Join us for brunch and games as we celebrate Remi! Street parking is easiest."
          />
        </Group>

        <Group title="RSVPs" onLayout={(event) => sectionLayout("rsvps", event)}>
          <DateField label="Reply by (optional)" value={rsvpBy || null} onChange={(value) => setRsvpBy(value ?? "")} />
          <View style={{ gap: 6 }}>
            <Label>People per RSVP</Label>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Stepper value={maxPartySize} onChange={setMaxPartySize} min={1} max={MAX_PARTY_SIZE_LIMIT} />
              {maxPartySize === 1 ? (
                <Text variant="subhead" tone="secondary">
                  Just the guest
                </Text>
              ) : null}
            </View>
            <Text variant="footnote" tone="tertiary">
              Including the guest.
            </Text>
          </View>
          <Section>
            <SwitchRow
              label="Anyone with the event link can RSVP"
              value={openRsvp}
              onValueChange={setOpenRsvp}
            />
            <Divider inset={spacing.lg} />
            <SwitchRow
              label="Ask how many kids are coming"
              value={askKids}
              onValueChange={changeAskKids}
            />
            <Divider inset={spacing.lg} />
            <SwitchRow label="Email me when someone RSVPs" value={emailHost} onValueChange={setEmailHost} />
            <Divider inset={spacing.lg} />
            <SwitchRow
              label="Email everyone going a reminder the day before"
              value={remindDayBefore}
              onValueChange={setRemindDayBefore}
            />
            {rsvpBy ? (
              <>
                <Divider inset={spacing.lg} />
                <SwitchRow label="Remind guests who haven't replied, 3 days before the reply-by date" value={autoRsvpReminder} onValueChange={setAutoRsvpReminder} />
              </>
            ) : null}
          </Section>
          <RsvpQuestionsEditor questions={questions} onChange={changeQuestions} />
        </Group>

        <Group title="Gifts" onLayout={(event) => sectionLayout("gifts", event)}>
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: 2 }}>
              <Label>Registries and wishlists</Label>
              <Text variant="footnote" tone="tertiary">
                Linking someone else's list emails them.
              </Text>
            </View>
            {registryFields(false)}
          </View>

          {giftNoteField}
        </Group>

        <Group
          title="Gifts among the guests"
          onLayout={(event) => sectionLayout("exchange", event)}
        >
          <Section>
            <ToggleRow
              label="Guests give gifts to each other"
              hint={
                drawn
                  ? "Names have been drawn. Undo the draw on the event's page to turn this off."
                  : undefined
              }
              value={exchangeOn}
              disabled={drawn}
              onValueChange={(value) => {
                setExchangeOn(value);
                setTouched((t) => ({ ...t, exchange: true }));
              }}
            />
          </Section>
          {exchangeDetails(false)}
        </Group>

        {changes.length > 0 ? (
          <View style={{ borderRadius: radius.lg, backgroundColor: theme.tintSoft, paddingVertical: spacing.xs }}>
            <ToggleRow
              label={`Email guests about the ${changeSummary(changes).replace(/^New /, "new ")}`}
              hint="Goes to everyone who said yes or maybe, or hasn't answered yet."
              value={notifyGuests}
              onValueChange={setNotifyGuests}
            />
          </View>
        ) : null}
      </KeyboardScrollView>
      <KeyboardFooter {...keyboardFooter.footerProps} style={{ padding: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg), gap: spacing.sm }}>
        {error ? (
          <Text variant="footnote" tone="danger" style={{ textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
        <Button title={editing ? "Save changes" : "Create event"} onPress={() => void submit()} loading={saving} disabled={uploading} />
      </KeyboardFooter>
    </>
  );
}

/** A short random id for a question of the host's own. Copied from src/components/rsvp-questions-editor.tsx. */
function newId(): string {
  return `q${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The host's RSVP questions: meal choice, dietary needs, names of plus-ones,
 * or a question of their own, each required or optional. The website's
 * src/components/rsvp-questions-editor.tsx.
 */
function RsvpQuestionsEditor({ questions, onChange }: { questions: RsvpQuestion[]; onChange: (questions: RsvpQuestion[]) => void }) {
  const update = (id: string, changes: Partial<RsvpQuestion>) => onChange(questions.map((q) => (q.id === id ? { ...q, ...changes } : q)));
  const remove = (id: string) => onChange(questions.filter((q) => q.id !== id));
  // Meal, diet and plus-ones make sense once each. Questions of your own, any number.
  const addable = QUESTION_KIND_IDS.filter((kind) => kind === "text" || !questions.some((q) => q.kind === kind));
  const add = (kind: QuestionKind) => onChange([...questions, newQuestion(kind, kind === "text" ? newId() : kind)]);
  const theme = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <Label>Questions</Label>
      {questions.map((question) => (
        <Card key={question.id} style={{ padding: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
            <Text variant="caption" tone="tertiary" style={{ fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" }}>
              {QUESTION_KINDS[question.kind].label}
            </Text>
            <IconButton
              icon="trash"
              size={18}
              color={theme.textTertiary}
              accessibilityLabel={`Remove "${question.label || QUESTION_KINDS[question.kind].label}"`}
              onPress={() => remove(question.id)}
            />
          </View>
          <Field
            label="Question"
            value={question.label}
            onChangeText={(label) => update(question.id, { label })}
            maxLength={MAX_QUESTION_LABEL_LENGTH}
            placeholder={question.kind === "text" ? "What song gets you dancing?" : undefined}
          />
          {question.kind === "meal" ? (
            <Field
              label="Choices"
              hint={`Separate them with commas. Up to ${MAX_OPTIONS}.`}
              value={question.options.join(", ")}
              onChangeText={(value) => update(question.id, { options: value.split(",").map((o) => o.trimStart()) })}
              placeholder="Chicken, Fish, Vegetarian"
            />
          ) : null}
          <ToggleRow label="Guests must answer" value={question.required} onValueChange={(required) => update(question.id, { required })} padded={false} />
        </Card>
      ))}
      {questions.length < MAX_QUESTIONS ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {addable.map((kind) => (
            <Button key={kind} title={QUESTION_KINDS[kind].label} icon="add" variant="secondary" size="small" onPress={() => add(kind)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

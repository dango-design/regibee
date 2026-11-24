import DateTimePicker from "@react-native-community/datetimepicker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileAudienceChips } from "@/components/profile-audience-chips";
import { Button, Chip, Field, IconButton, Section, SwitchRow, Text } from "@/components/ui";
import { errorMessage, useCreateRegistry } from "@/lib/data";
import { formatEventDate, toYmd } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { EventType, RegistryType } from "@/lib/types";
import {
  DEFAULT_LIST_VISIBILITY,
  LIST_ACCESS,
  LIST_VISIBILITIES,
  type ListVisibility,
  type ProfileAudience,
} from "@shared/list-access";
import { LIST_OCCASIONS } from "@shared/occasions";
import { copyFor, REGISTRY_OCCASION_CHOICES } from "@shared/registry-copy";

// The website's create form (src/components/create-registry-form.tsx) asks the
// same things in the same words, with the same defaults. Change both together.

export default function NewRegistryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const create = useCreateRegistry();
  // "Start something new" opens this with the type, and a personal list's
  // occasion, already chosen, as the website's /dashboard/registry/new?type=…&occasion=… does.
  const params = useLocalSearchParams<{ registryType?: string; eventType?: string }>();
  const startType: RegistryType | undefined =
    params.registryType === "baby" || params.registryType === "personal" ? params.registryType : undefined;
  const startOccasion =
    startType === "personal" && (LIST_OCCASIONS as readonly string[]).includes(params.eventType ?? "")
      ? (params.eventType as EventType)
      : null;
  const [registryType, setRegistryType] = useState<RegistryType>(startType ?? "baby");
  const [eventType, setEventType] = useState<EventType | null>(startOccasion);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [visibility, setVisibility] = useState<ListVisibility>(DEFAULT_LIST_VISIBILITY);
  const [profileAudience, setProfileAudience] = useState<ProfileAudience>("hidden");
  const [description, setDescription] = useState("");
  const [showPayments, setShowPayments] = useState(false);
  const [venmo, setVenmo] = useState("");
  const [paypal, setPaypal] = useState("");
  const [zelle, setZelle] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Give your registry a name.");
      return;
    }
    create.mutate(
      {
        title,
        registryType,
        eventType: registryType === "personal" ? eventType : null,
        eventDate: date ? toYmd(date) : null,
        visibility,
        profileAudience,
        description,
        venmo,
        paypal,
        zelle,
        zipCode,
      },
      {
        onSuccess: ({ id }) => {
          router.back();
          router.push({ pathname: "/registry/[id]", params: { id } });
        },
        onError: (e) => setError(errorMessage(e)),
      }
    );
  }

  const copy = copyFor({ registryType, eventType: registryType === "personal" ? eventType : null });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen
        options={{
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => router.back()} />
              : undefined,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
            What's it for?
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Chip label="A baby" selected={registryType === "baby"} onPress={() => setRegistryType("baby")} />
            <Chip label="Something else" selected={registryType === "personal"} onPress={() => setRegistryType("personal")} />
          </View>
          {registryType === "personal" ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                What's the occasion?
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {REGISTRY_OCCASION_CHOICES.map((option) => (
                  <Chip
                    key={option.value ?? "none"}
                    label={option.label}
                    selected={eventType === option.value}
                    onPress={() => setEventType(option.value)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <Text variant="footnote" tone="tertiary">
              Baby registries start with 10 categories, like Nursery & Sleep and Feeding.
            </Text>
          )}
        </View>

        <Field
          label="Registry name"
          value={title}
          onChangeText={setTitle}
          placeholder={copy.titlePlaceholder}
          autoCapitalize="words"
          returnKeyType="done"
        />

        <Section>
          <SwitchRow
            icon="calendar"
            label={`${copy.eventDateLabel} (optional)`}
            description={date ? formatEventDate(toYmd(date))! : copy.eventDatePlaceholderHint}
            value={Boolean(date) || showPicker}
            onValueChange={(on) => {
              if (on) {
                setDate(date ?? new Date());
                setShowPicker(true);
              } else {
                setDate(null);
                setShowPicker(false);
              }
            }}
          />
          {showPicker && date ? (
            <View style={{ alignItems: "center", paddingBottom: spacing.sm }}>
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                accentColor={theme.tint}
                themeVariant={theme.dark ? "dark" : "light"}
                onChange={(event, next) => {
                  if (Platform.OS === "android") setShowPicker(false);
                  if (event.type === "set" && next) setDate(next);
                  if (event.type === "dismissed" && Platform.OS === "android" && !next) return;
                }}
              />
            </View>
          ) : null}
        </Section>

        <View style={{ gap: spacing.sm }}>
          <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
            Who can open it
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {LIST_VISIBILITIES.map((value) => (
              <Chip
                key={value}
                label={LIST_ACCESS[value].label}
                selected={visibility === value}
                onPress={() => setVisibility(value)}
              />
            ))}
          </View>
          <Text variant="footnote" tone="tertiary">
            {LIST_ACCESS[visibility].description}
          </Text>
        </View>
        <ProfileAudienceChips visibility={visibility} value={profileAudience} onValueChange={setProfileAudience} />

        <Field
          label="Message to guests (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Say hello to the people visiting your registry"
          hint="Shown at the top of your registry page."
          multiline
        />

        {showPayments ? (
          <View style={{ gap: spacing.lg }}>
            <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
              Payments and sales tax (optional)
            </Text>
            <Field label="Venmo" value={venmo} onChangeText={setVenmo} placeholder="@your-venmo" autoCapitalize="none" autoCorrect={false} />
            <Field
              label="PayPal"
              value={paypal}
              onChangeText={setPaypal}
              placeholder="you@email.com or PayPal.me link"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label="Zelle"
              value={zelle}
              onChangeText={setZelle}
              placeholder="you@email.com or phone number"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label="Zip code"
              value={zipCode}
              onChangeText={setZipCode}
              placeholder="12345"
              keyboardType="number-pad"
              hint="When you add something you've already bought, we'll add estimated sales tax to its price. You can turn this off later in settings."
            />
          </View>
        ) : (
          <Button
            title="Add payments and sales tax"
            icon="card"
            variant="secondary"
            size="medium"
            onPress={() => setShowPayments(true)}
          />
        )}
      </ScrollView>
      <View style={{ padding: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg), gap: spacing.sm }}>
        {error ? (
          <Text variant="footnote" tone="danger" style={{ textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
        <Button title="Create registry" onPress={submit} loading={create.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}

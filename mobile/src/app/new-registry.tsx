import DateTimePicker from "@react-native-community/datetimepicker";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Chip, Field, IconButton, Section, SwitchRow, Text } from "@/components/ui";
import { errorMessage, useCreateRegistry } from "@/lib/data";
import { formatEventDate, toYmd } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { EventType, RegistryType } from "@/lib/types";
import { copyFor, REGISTRY_OCCASION_CHOICES } from "@shared/registry-copy";

// The website's create form (src/components/create-registry-form.tsx) asks the
// same things in the same words, with the same defaults. Change both together.

export default function NewRegistryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const create = useCreateRegistry();
  const [registryType, setRegistryType] = useState<RegistryType>("baby");
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
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
        isPublic,
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

        <Section title="Who can see it" footer="Anyone with your share link can open it either way.">
          <SwitchRow
            icon="public"
            label="Public"
            description={isPublic ? "Search engines can list it." : "Hidden from search engines."}
            value={isPublic}
            onValueChange={setIsPublic}
          />
        </Section>
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

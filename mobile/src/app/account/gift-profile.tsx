// "Gift profile": your birthday, sizes and likes, for people picking gifts.
// The website's Account page card (src/components/account-settings.tsx).

import { Stack } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { GiftProfileForm } from "@/components/gift-profile-form";
import { ErrorState, LoadingState, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useAccountPage, useRunPeopleAction } from "@/lib/people-data";
import { spacing, useTheme } from "@/lib/theme";

export default function GiftProfileScreen() {
  const theme = useTheme();
  const page = useAccountPage();
  const { run } = useRunPeopleAction();
  const data = page.data;
  if (!data) {
    return page.isError ? <ErrorState message={errorMessage(page.error)} onRetry={() => page.refetch()} /> : <LoadingState />;
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: "Gift profile" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}
      >
        <Text variant="subhead" tone="secondary">
          Choose who sees each part. To tell everyone something, use the public note in Your profile.
        </Text>
        <GiftProfileForm initial={data.giftProfile} onSave={(profile) => run("giftProfile.saveGiftProfile", profile)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// The page sheet that the list screen's gift sheets open in: a title, a close
// button, and the content in a scroll view that moves up with the keyboard.
// GiftSheet (gift-sheet.tsx) draws the same frame itself.

import { type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton, Text } from "@/components/ui";
import { spacing, useTheme } from "@/lib/theme";

export function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingTop: Platform.OS === "ios" ? spacing.lg : insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
          }}
        >
          <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
          <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A red line under a form, in the server's own words. */
export function ErrorLine({ error }: { error: string }) {
  return error ? (
    <Text variant="footnote" tone="danger">
      {error}
    </Text>
  ) : null;
}

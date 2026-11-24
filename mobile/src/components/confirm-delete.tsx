// The dialog that asks before deleting a registry, an event, a group or the
// account. It does what the website's does
// (src/components/confirm-delete-dialog.tsx): with a `phrase`, the delete
// button stays off until the person has typed that sentence. Pass one when the
// thing holds something, and null when it's brand new
// (@shared/delete-confirmation decides which).
//
// A system alert can't do this: Alert.prompt only exists on iPhone.

import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { matchesDeletePhrase } from "@shared/delete-confirmation";

import { Button, Field, Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

export function ConfirmDelete({
  visible,
  onClose,
  title,
  message,
  lines,
  loading = false,
  phrase,
  confirmLabel,
  cancelLabel = "Cancel",
  working = false,
  error,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  /** What deleting does, one sentence each, shown under the message. */
  lines?: string[];
  /** The dialog is still finding out what to show. The delete button stays off. */
  loading?: boolean;
  /** The sentence to type, or null to ask with the buttons alone. */
  phrase: string | null;
  confirmLabel: string;
  cancelLabel?: string;
  /** The delete is running. The dialog stays open and its buttons are off. */
  working?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  const [typed, setTyped] = useState("");

  // Start with an empty field each time the dialog opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setTyped("");
  }

  const confirmed = phrase === null || matchesDeletePhrase(typed, phrase);
  const canDelete = confirmed && !loading && !working;
  const close = () => {
    if (!working) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.fill}>
        <Pressable accessibilityLabel={cancelLabel} onPress={close} style={[styles.fill, styles.backdrop]}>
          {/* Taps on the card must not close the dialog. */}
          <Pressable accessible={false} onPress={() => {}} style={[styles.card, { backgroundColor: theme.surface }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
              <Text variant="headline" accessibilityRole="header">
                {title}
              </Text>
              {message ? (
                <Text variant="subhead" tone="secondary">
                  {message}
                </Text>
              ) : null}
              {loading ? <ActivityIndicator color={theme.textSecondary} style={{ alignSelf: "flex-start" }} /> : null}
              {lines?.map((line) => (
                <View key={line} style={styles.line}>
                  <Text variant="subhead" tone="secondary">
                    •
                  </Text>
                  <Text variant="subhead" tone="secondary" style={{ flex: 1 }}>
                    {line}
                  </Text>
                </View>
              ))}
              {phrase !== null && !loading ? (
                <Field
                  label={`Type “${phrase}” to confirm`}
                  value={typed}
                  onChangeText={setTyped}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                  editable={!working}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (canDelete) onConfirm();
                  }}
                />
              ) : null}
              {error ? (
                <Text variant="footnote" tone="danger" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              <View style={styles.buttons}>
                <Button title={cancelLabel} variant="secondary" size="medium" disabled={working} onPress={close} style={{ flex: 1 }} />
                <Button
                  title={confirmLabel}
                  variant="danger"
                  size="medium"
                  disabled={!canDelete && !working}
                  loading={working}
                  onPress={onConfirm}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: { width: "100%", maxWidth: 420, maxHeight: "100%", borderRadius: radius.lg, padding: spacing.lg },
  line: { flexDirection: "row", gap: spacing.sm },
  buttons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});

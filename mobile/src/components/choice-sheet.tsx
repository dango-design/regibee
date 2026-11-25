// A menu of choices that slides up from the bottom of the screen, where the
// website has a dropdown menu or a select field.
//
// Use it instead of Alert.alert for a menu: Android's alert shows at most
// three buttons and drops the rest.

import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Divider, haptic, Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

export interface SheetChoice {
  /** Told apart from the others when two labels match. Defaults to the label. */
  key?: string;
  label: string;
  /** A second, smaller line under the label. */
  detail?: string;
  /** Shown in red, for a choice that deletes something. */
  destructive?: boolean;
  onPress: () => void;
}

// iPhone can't open an alert or another dialog while this one is still
// closing, so a choice runs once the closing animation is over.
const AFTER_CLOSE_MS = Platform.OS === "ios" ? 350 : 0;

export function ChoiceSheet({
  visible,
  onClose,
  title,
  choices,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  choices: SheetChoice[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Cancel" onPress={onClose} style={[styles.fill, styles.backdrop]}>
        {/* Taps on the sheet must not close it. */}
        <Pressable
          accessible={false}
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        >
          <Text variant="footnote" tone="secondary" accessibilityRole="header" style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            {choices.map((choice, index) => (
              <View key={choice.key ?? choice.label}>
                {index > 0 ? <Divider inset={spacing.lg} /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    haptic();
                    onClose();
                    setTimeout(choice.onPress, AFTER_CLOSE_MS);
                  }}
                  style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceAlt : "transparent" }]}
                >
                  <Text variant="callout" tone={choice.destructive ? "danger" : undefined} numberOfLines={2}>
                    {choice.label}
                  </Text>
                  {choice.detail ? (
                    <Text variant="footnote" tone="tertiary" numberOfLines={1}>
                      {choice.detail}
                    </Text>
                  ) : null}
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <Divider />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptic();
              onClose();
            }}
            style={({ pressed }) => [styles.row, { alignItems: "center", backgroundColor: pressed ? theme.surfaceAlt : "transparent" }]}
          >
            <Text variant="callout" tone="tint" style={{ fontWeight: "600" }}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { maxHeight: "80%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.md },
  title: { fontWeight: "600", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: { minHeight: 52, justifyContent: "center", gap: 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});

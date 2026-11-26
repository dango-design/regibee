// A list of choices that slides up from the bottom of the screen, such as
// which email to use for a contact. For a "…" button in a header, use
// HeaderMenu instead: it opens the system's own menu.
//
// Use it instead of Alert.alert for a list: Android's alert shows at most
// three buttons and drops the rest.
//
// The backdrop fades in while the sheet slides up. A tap on the backdrop, a
// swipe down on the sheet, Cancel or Android's back button closes it.

import { useEffect, useMemo, useState } from "react";
import { Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
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

const OPEN_MS = 250;
const CLOSE_MS = 200;

// iPhone can't open an alert or another dialog while this one is still
// closing, so a choice runs once the closing animation is over.
const AFTER_CLOSE_MS = Platform.OS === "ios" ? CLOSE_MS + 150 : 0;

// How far, or how fast, a swipe down has to go to close the sheet.
const CLOSE_DISTANCE = 80;
const CLOSE_VELOCITY = 0.5;

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

  // The Modal stays up after `visible` turns false until the sheet has slid away.
  const [mounted, setMounted] = useState(visible);
  // 0 is closed, 1 is open. The sheet's height turns it into a distance.
  const [progress] = useState(() => new Animated.Value(0));
  // How far the sheet has been dragged down, while a swipe is under way.
  const [drag] = useState(() => new Animated.Value(0));
  const [height, setHeight] = useState(400);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      drag.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: OPEN_MS, useNativeDriver: true }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: CLOSE_MS, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress, drag]);

  const pan = useMemo(() => {
    const springBack = () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    return PanResponder.create({
      // Only a mostly vertical drag downwards, so taps on choices still work.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) {
          onClose();
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: springBack,
    });
  }, [drag, onClose]);

  const translateY = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), drag);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable accessibilityLabel="Cancel" onPress={onClose} style={styles.fill} />
        </Animated.View>
        <Animated.View
          {...pan.panHandlers}
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, spacing.lg), transform: [{ translateY }] },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { maxHeight: "80%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.sm },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, marginBottom: spacing.sm },
  title: { fontWeight: "600", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: { minHeight: 52, justifyContent: "center", gap: 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});

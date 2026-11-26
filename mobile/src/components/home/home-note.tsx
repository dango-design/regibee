// A one-line note on the home screen that asks the person to do something,
// like reviewing follow requests. The whole row is the button.

import { Pressable, StyleSheet } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { useTintColors, type TintName } from "@/components/invitation/colors";
import { Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

export function HomeNote({
  icon,
  text,
  action,
  tint,
  onPress,
}: {
  icon: IconName;
  text: string;
  /** The word at the right, like "Review". */
  action: string;
  tint: TintName;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colors = useTintColors(tint);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text}. ${action}`}
      onPress={onPress}
      style={({ pressed }) => [styles.note, { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={17} color={colors.ink} />
      <Text variant="subhead" numberOfLines={2} style={{ flex: 1, color: theme.text }}>
        {text}
      </Text>
      <Text variant="subhead" style={{ fontWeight: "600", color: colors.ink }}>
        {action}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radius.md + 2,
  },
});

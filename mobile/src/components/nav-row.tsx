// A row that opens another screen, with an icon, a label, maybe a count and a
// short detail, for grouped lists of settings and tools.

import { Pressable, StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { haptic, Text } from "@/components/ui";
import { spacing, useTheme } from "@/lib/theme";

export function NavRow({
  icon,
  label,
  detail,
  badge,
  onPress,
  destructive,
  external,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  badge?: number;
  onPress: () => void;
  destructive?: boolean;
  /** Opens outside the app, such as the website. */
  external?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${badge ? `, ${badge} new` : ""}${detail ? `, ${detail}` : ""}`}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [styles.navRow, { backgroundColor: pressed ? theme.surfaceAlt : "transparent" }]}
    >
      <Icon name={icon} size={20} color={destructive ? theme.danger : theme.tint} />
      <Text variant="callout" style={{ flex: 1, color: destructive ? theme.danger : theme.text }}>
        {label}
      </Text>
      {detail ? (
        <Text variant="footnote" tone="tertiary">
          {detail}
        </Text>
      ) : null}
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.tint }]}>
          <Text variant="caption" style={{ color: theme.onTint, fontWeight: "700" }}>
            {badge}
          </Text>
        </View>
      ) : null}
      {destructive ? null : external ? (
        <Icon name="external" size={15} color={theme.textTertiary} />
      ) : (
        <Icon name="chevronRight" size={14} color={theme.textTertiary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 50 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
});

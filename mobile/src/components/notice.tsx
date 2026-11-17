// A banner with an icon, a title, a line of explanation and maybe a button,
// like the website's notices on the dashboard and a list's page.

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { Button, Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

export function Notice({
  icon,
  title,
  message,
  tone = "neutral",
  action,
  secondary,
  children,
}: {
  icon: IconName;
  title: string;
  message?: ReactNode;
  tone?: "neutral" | "tint" | "accent" | "success" | "danger";
  action?: { title: string; onPress: () => void; icon?: IconName; loading?: boolean };
  secondary?: { title: string; onPress: () => void; loading?: boolean };
  children?: ReactNode;
}) {
  const theme = useTheme();
  const colors = {
    neutral: { bg: theme.surfaceAlt, fg: theme.textSecondary },
    tint: { bg: theme.tintSoft, fg: theme.tint },
    accent: { bg: theme.accentSoft, fg: theme.onAccentSoft },
    success: { bg: theme.successSoft, fg: theme.success },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: colors.bg }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: theme.surface }]}>
          <Icon name={icon} size={17} color={colors.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subhead" style={{ fontWeight: "600" }}>
            {title}
          </Text>
          {typeof message === "string" ? (
            <Text variant="footnote" tone="secondary">
              {message}
            </Text>
          ) : (
            message
          )}
        </View>
      </View>
      {children}
      {action || secondary ? (
        <View style={styles.actions}>
          {action ? (
            <Button title={action.title} icon={action.icon} size="small" variant="secondary" onPress={action.onPress} loading={action.loading} />
          ) : null}
          {secondary ? (
            <Button title={secondary.title} size="small" variant="ghost" onPress={secondary.onPress} loading={secondary.loading} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  top: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center", paddingLeft: 46 },
});

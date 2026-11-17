// Gift ideas on the Registries tab, as one more list beside the registries.

import { StyleSheet, View } from "react-native";

import { groupByRecipient, ideaCount, type GiftIdea } from "@shared/gift-ideas";

import { Icon } from "@/components/icon";
import { Card, Pill, Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

/** "Mom", "Mom and Sam", "Mom, Sam and Dad", "Mom, Sam and 2 others". */
function names(list: string[]): string {
  if (list.length <= 1) return list[0] ?? "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  if (list.length === 3) return `${list[0]}, ${list[1]} and ${list[2]}`;
  return `${list[0]}, ${list[1]} and ${list.length - 2} others`;
}

export function GiftIdeasCard({ ideas, onPress }: { ideas: GiftIdea[]; onPress: () => void }) {
  const theme = useTheme();
  const people = groupByRecipient(ideas).map((group) => group.name);
  const summary =
    ideas.length === 0 ? "Save gifts you might give someone else." : `${ideaCount(ideas.length)} for ${names(people)}`;

  return (
    <Card onPress={onPress} accessibilityRole="button" accessibilityLabel={`Gift ideas. Only you can see them. ${summary}`}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <Icon name="lightbulb" size={26} color={theme.onAccentSoft} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" numberOfLines={1} style={{ fontSize: 20, lineHeight: 25 }}>
            Gift ideas
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill label="For other people" tone="accent" />
            <Pill label="Only you" icon="lock" />
          </View>
        </View>
        <Icon name="chevronRight" size={16} color={theme.textTertiary} />
      </View>
      <Text variant="footnote" tone="secondary" numberOfLines={2}>
        {summary}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  icon: { width: 56, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});

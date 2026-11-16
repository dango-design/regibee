import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Card, Pill, ProgressBar, Text } from "@/components/ui";
import { countdownLabel } from "@shared/occasions";

import { formatDollars, initials, plural, toYmd } from "@/lib/format";
import { occasionLabel } from "@/lib/occasion";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { RegistrySummary } from "@/lib/types";

export function RegistryCard({ registry, onPress }: { registry: RegistrySummary; onPress: () => void }) {
  const theme = useTheme();
  // The website's dashboard card counts down the same way (src/lib/occasions.ts).
  const when = registry.event_date ? countdownLabel(registry.event_date, toYmd(), registry.registry_type ?? "baby") : null;
  const progress = registry.itemCount > 0 ? registry.fulfilledCount / registry.itemCount : 0;

  return (
    <Card
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        registry.reservationsHidden
          ? `${registry.title}. What's been reserved is hidden from you.`
          : `${registry.title}. ${registry.fulfilledCount} of ${registry.itemCount} items gifted.`
      }
    >
      <View style={styles.top}>
        {registry.photo_url ? (
          <Image source={{ uri: registry.photo_url }} style={styles.photo} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.photo, { backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }]}>
            <Icon name="gift" size={26} color={theme.onAccentSoft} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" numberOfLines={2} style={{ fontSize: 20, lineHeight: 25 }}>
            {registry.title}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill label={occasionLabel(registry)} tone="accent" />
            {when ? <Pill label={when} tone="tint" icon="calendar" /> : null}
            {registry.role === "manager" ? <Pill label="Manager" icon="people" /> : null}
            {!registry.is_public ? <Pill label="Private" icon="lock" /> : null}
          </View>
        </View>
        <Icon name="chevronRight" size={16} color={theme.textTertiary} />
      </View>

      <View style={{ gap: 6 }}>
        {registry.reservationsHidden ? null : <ProgressBar value={progress} />}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          {registry.reservationsHidden ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
              <Icon name="eyeSlash" size={14} color={theme.textSecondary} />
              <Text variant="footnote" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                What&apos;s been reserved is hidden from you
              </Text>
            </View>
          ) : (
            <Text variant="footnote" tone="secondary">
              {`${registry.fulfilledCount} of ${plural(registry.itemCount, "item")} gifted`}
            </Text>
          )}
          <Text variant="footnote" tone="tertiary">
            {formatDollars(registry.totalValue)} total value
          </Text>
        </View>
      </View>

      {registry.recentGifts.length > 0 ? (
        // The website's dashboard card lists the same three (src/lib/gifts.ts).
        <View style={{ gap: 6 }}>
          <Text variant="footnote" style={{ fontWeight: "600" }}>
            Recent activity
          </Text>
          {registry.recentGifts.map((gift) => (
            <View key={gift.id} style={styles.activity}>
              <View style={[styles.activityAvatar, { backgroundColor: theme.tintSoft }]}>
                <Text variant="caption" style={{ color: theme.tint, fontWeight: "700", fontSize: 10 }}>
                  {initials(gift.buyer_name)}
                </Text>
              </View>
              <Text variant="footnote" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                <Text variant="footnote" style={{ fontWeight: "600" }}>
                  {gift.buyer_name}
                </Text>{" "}
                {gift.action}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  photo: { width: 56, height: 56, borderRadius: radius.md },
  activity: { flexDirection: "row", alignItems: "center", gap: 8 },
  activityAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});

import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Card, Pill, ProgressBar, Text } from "@/components/ui";
import { countdownLabel } from "@shared/occasions";

import { formatDollars, formatEventDate, initials, plural, toYmd } from "@/lib/format";
import { occasionLabel } from "@/lib/occasion";
import { radius, spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";
import type { RegistrySummary } from "@/lib/types";
import { LIST_ACCESS, listVisibility } from "@shared/list-access";

export function RegistryCard({
  registry,
  today = toYmd(),
  onPress,
}: {
  registry: RegistrySummary;
  /** YYYY-MM-DD, from the home screen's data, so every card counts down from the same day. */
  today?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  // As the website's dashboard card: the countdown shows only while the date
  // is ahead. Once it's gone by, the pill would repeat the date under the title.
  const when =
    registry.event_date && registry.event_date >= today
      ? countdownLabel(registry.event_date, today, registry.registry_type ?? "baby")
      : null;
  const progress = registry.totalItems > 0 ? registry.fulfilledItems / registry.totalItems : 0;
  const allDone = registry.totalItems > 0 && registry.fulfilledItems >= registry.totalItems;
  const isPrivate = listVisibility(registry) === "private";

  return (
    <Card
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        registry.reservationsHidden
          ? `${registry.title}. What's been reserved is hidden from you.`
          : `${registry.title}. ${registry.fulfilledItems} of ${registry.totalItems} items gifted.`
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
          {registry.event_date ? (
            <Text variant="footnote" tone="tertiary">
              {formatEventDate(registry.event_date)}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill label={occasionLabel(registry)} tone="accent" />
            {when ? <Pill label={when} tone="tint" icon="calendar" /> : null}
            {registry.role === "manager" ? <Pill label="Manager" icon="people" /> : null}
            {listVisibility(registry) === "link" ? <Pill label={LIST_ACCESS.link.short} icon="link" /> : null}
            {listVisibility(registry) === "private" ? <Pill label={LIST_ACCESS.private.short} icon="lock" /> : null}
          </View>
        </View>
        <Icon name="chevronRight" size={16} color={theme.textTertiary} />
      </View>

      <View style={{ gap: 6 }}>
        {registry.reservationsHidden ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="eyeSlash" size={14} color={theme.textSecondary} />
            <Text variant="footnote" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              What&apos;s been reserved is hidden from you
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="footnote">{`${registry.fulfilledItems} of ${registry.totalItems} items gifted`}</Text>
              {allDone ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="party" size={13} color={theme.success} />
                  <Text variant="footnote" tone="success" style={{ fontWeight: "600" }}>
                    All done
                  </Text>
                </View>
              ) : (
                <Text variant="footnote" tone="tertiary">
                  {Math.round(progress * 100)}%
                </Text>
              )}
            </View>
            <ProgressBar value={progress} />
          </>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="footnote" tone="tertiary">
            {plural(registry.totalItems, "item")}
          </Text>
          <Text variant="footnote" tone="tertiary">
            {formatDollars(registry.totalValue)} total value
          </Text>
        </View>
      </View>

      {registry.recentActivity.length > 0 ? (
        // The website's dashboard card lists the same three (src/lib/gifts.ts).
        <View style={{ gap: 6 }}>
          <Text variant="footnote" style={{ fontWeight: "600" }}>
            Recent activity
          </Text>
          {registry.recentActivity.map((gift) => (
            <View key={gift.id} style={styles.activity}>
              <View style={[styles.activityAvatar, { backgroundColor: theme.tintSoft }]}>
                <Text variant="caption" style={{ color: theme.tint, fontWeight: "700", fontSize: 10 }}>
                  {initials(gift.name)}
                </Text>
              </View>
              <Text variant="footnote" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                <Text variant="footnote" style={{ fontWeight: "600" }}>
                  {gift.name}
                </Text>{" "}
                {gift.action}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* The website's card has a button for the list's public page. A private list has none to show. */}
      {isPrivate ? null : (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="View public registry"
          accessibilityHint="Opens in a browser"
          hitSlop={6}
          onPress={() => openSite(`/r/${registry.slug}`)}
          style={({ pressed }) => [styles.publicLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="external" size={14} color={theme.tint} />
          <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }}>
            View public page
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  photo: { width: 56, height: 56, borderRadius: radius.md },
  activity: { flexDirection: "row", alignItems: "center", gap: 8 },
  publicLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 32 },
  activityAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});

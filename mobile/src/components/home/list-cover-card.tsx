// A list on the home screen: a colored cover with its countdown, then its
// name, a progress bar and one line about its gifts.
//
// The card keeps to what tells the owner how the list is doing. Its total
// value, item count, who gave what and the link to its public page are on
// the list's own screen. The cover is the list's photo, or its occasion's
// color (the website's occasionTheme) with a large icon.

import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { listVisibility } from "@shared/list-access";
import { countdownLabel, listTint } from "@shared/occasions";

import { Icon, type IconName } from "@/components/icon";
import { useTintColors } from "@/components/invitation/colors";
import { ProgressBar, Text } from "@/components/ui";
import { occasionLabel } from "@/lib/occasion";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { RegistrySummary } from "@/lib/types";

/** The large icon on a cover with no photo. */
function coverIcon(registry: Pick<RegistrySummary, "registry_type" | "event_type">): IconName {
  if (registry.registry_type === "baby") return "baby";
  switch (registry.event_type) {
    case "birthday":
      return "cake";
    case "christmas":
      return "tree";
    case "wedding":
      return "heart";
    case "housewarming":
      return "home";
    case "graduation":
      return "graduation";
    default:
      return "gift";
  }
}

/** "23 of 48 gifted", or "No items yet". */
function giftedText(registry: RegistrySummary): string {
  if (registry.totalItems === 0) return "No items yet";
  return `${registry.fulfilledItems} of ${registry.totalItems} gifted`;
}

export function ListCoverCard({ registry, today, onPress }: { registry: RegistrySummary; today: string; onPress: () => void }) {
  const theme = useTheme();
  const colors = useTintColors(listTint(registry.registry_type ?? "baby", registry.event_type));
  // As on the website's card, the countdown shows only while the date is ahead.
  const when =
    registry.event_date && registry.event_date >= today
      ? countdownLabel(registry.event_date, today, registry.registry_type ?? "baby")
      : null;
  const isPrivate = listVisibility(registry) === "private";
  const progress = registry.totalItems > 0 ? registry.fulfilledItems / registry.totalItems : 0;
  const newThisWeek = registry.giftsThisWeek ?? 0;
  const allDone = registry.totalItems > 0 && registry.fulfilledItems >= registry.totalItems;
  // A finished list celebrates instead of counting new gifts, as on the website.
  const newText = allDone ? null : newThisWeek > 0 ? `${newThisWeek} new this week` : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        registry.title,
        occasionLabel(registry),
        when,
        isPrivate ? "Private" : null,
        registry.reservationsHidden ? "What's been reserved is hidden from you" : giftedText(registry),
        allDone && !registry.reservationsHidden ? "All done" : null,
        newText,
      ]
        .filter(Boolean)
        .join(". ")}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      <View style={[styles.cover, { backgroundColor: colors.fill }]}>
        {registry.photo_url ? (
          <Image source={{ uri: registry.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.art} pointerEvents="none">
            <Icon name={coverIcon(registry)} size={128} color={colors.art} />
          </View>
        )}
        <View style={styles.badges}>
          {when ? (
            <View style={[styles.badge, { backgroundColor: theme.surface }]}>
              <Text variant="caption" style={{ color: colors.ink, fontWeight: "700" }}>
                {when}
              </Text>
            </View>
          ) : null}
          {isPrivate ? (
            <View style={[styles.badge, { backgroundColor: theme.surface, marginLeft: "auto" }]}>
              <Icon name="lock" size={11} color={theme.textSecondary} weight="bold" />
              <Text variant="caption" tone="secondary" style={{ fontWeight: "700" }}>
                Private
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {/* The cover's color and icon show the occasion, so its name is only read out. */}
        <Text variant="title" numberOfLines={2} style={{ fontSize: 21, lineHeight: 26 }}>
          {registry.title}
        </Text>
        {registry.reservationsHidden ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="eyeSlash" size={14} color={theme.textSecondary} />
            <Text variant="footnote" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              What&apos;s been reserved is hidden from you
            </Text>
          </View>
        ) : (
          <>
            {registry.totalItems > 0 ? <ProgressBar value={progress} /> : null}
            <View style={styles.giftLine}>
              <Text variant="footnote" tone="secondary">
                {giftedText(registry)}
                {allDone || newText ? " ·" : null}
              </Text>
              {allDone ? <Icon name="party" size={13} color={theme.success} /> : null}
              {allDone || newText ? (
                <Text variant="footnote" tone="success" style={{ fontWeight: "600" }}>
                  {allDone ? "All done" : newText}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl - 2, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  cover: { height: 108, overflow: "hidden" },
  art: { position: "absolute", right: -14, top: -10 },
  badges: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: 14 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  body: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: spacing.lg, gap: spacing.sm },
  giftLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
});

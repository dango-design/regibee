// The top of someone else's list: its photo, title, who shared it, the
// owner's note, how much has been gifted, and for a wishlist the person's
// sizes and likes. The website's PublicRegistryHero (baby registries) and
// WishListHero (wishlists) show the same things.

import { Image } from "expo-image";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { formatBirthday, sizeSummary } from "@shared/gift-profile";
import type { PublicListPageData } from "@shared/public-list-page-types";

import { Icon } from "@/components/icon";
import { Button, Card, ProgressBar, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useFollowOwner } from "@/lib/public-list-data";
import { radius, spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";

/** "March 3, 2027", as the website's registry header writes the date. */
function longDate(ymd: string) {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function PublicListHero({ page }: { page: PublicListPageData }) {
  const theme = useTheme();
  const { registry, owner } = page;
  const baby = registry.registry_type === "baby";
  const progress = page.totalItems > 0 ? page.fulfilledItems / page.totalItems : 0;
  const names = (registry.honoree_names || registry.parent_names || "").trim();
  const note = registry.description?.trim();

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ alignItems: "center", gap: spacing.md }}>
        {registry.photo_url ? (
          <Image
            source={{ uri: registry.photo_url }}
            style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: theme.surfaceAlt }}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Text variant="display" style={{ textAlign: "center" }} accessibilityRole="header">
          {registry.title}
        </Text>
        {baby && names ? (
          <Text variant="callout" tone="secondary" style={{ textAlign: "center" }}>
            {names}
          </Text>
        ) : null}
        {baby && registry.event_date ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="calendar" size={15} color={theme.textSecondary} />
            <Text variant="callout" tone="secondary">
              {longDate(registry.event_date)}
            </Text>
          </View>
        ) : null}
        {owner && page.ownerRelation ? <OwnerLine page={page} /> : null}
      </View>

      <Card style={{ gap: spacing.lg }}>
        {note ? (
          <View style={{ gap: 6 }}>
            {!baby ? (
              <Text variant="caption" tone="tertiary">
                {owner ? `A note from ${owner.name}` : "A note"}
              </Text>
            ) : null}
            <Text variant="subhead">{note}</Text>
          </View>
        ) : null}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
              {page.fulfilledItems} of {page.totalItems} items gifted
            </Text>
            <Text variant="footnote" tone="secondary" style={{ fontVariant: ["tabular-nums"] }}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <ProgressBar value={progress} />
        </View>
        <GiftProfileDetails page={page} />
      </Card>
    </View>
  );
}

/** "Shared by Sam", which opens their profile, and a Follow button for anyone but the owner. */
function OwnerLine({ page }: { page: PublicListPageData }) {
  const theme = useTheme();
  const owner = page.owner!;
  const relation = page.ownerRelation!;
  const follow = useFollowOwner();
  // Changes at once on a tap. Once the list has reloaded, the server's answer shows.
  const [tapped, setTapped] = useState<typeof relation.state | null>(null);
  const shown = tapped ?? relation.state;

  const go = (next: boolean) => {
    setTapped(next ? "pending" : "none");
    follow.mutate(
      { publicId: owner.publicId, follow: next },
      {
        onError: (e) => Alert.alert("That didn't work", errorMessage(e)),
        // The hook reloads the list first, so this runs once the new state is in.
        onSettled: () => setTapped(null),
      },
    );
  };

  return (
    <View style={{ alignItems: "center", gap: spacing.sm }}>
      <Pressable accessibilityRole="link" accessibilityHint="Opens their profile" onPress={() => openSite(owner.path)} hitSlop={8}>
        <Text variant="subhead" tone="secondary">
          Shared by <Text variant="subhead" style={{ fontWeight: "600", color: theme.tint }}>{owner.name}</Text>
        </Text>
      </Pressable>
      {relation.isOwner || shown === "blocked" || shown === "signed-out" ? null : shown === "approved" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="check" size={13} color={theme.textTertiary} />
          <Text variant="footnote" tone="tertiary">
            {relation.followsYou ? "Friends" : "Following"}
          </Text>
        </View>
      ) : (
        <Button
          size="small"
          variant="secondary"
          icon={shown === "pending" ? undefined : "add"}
          loading={follow.isPending}
          title={shown === "pending" ? "Requested" : relation.followsYou ? "Follow back" : "Follow"}
          accessibilityLabel={`${shown === "pending" ? "Requested" : relation.followsYou ? "Follow back" : "Follow"} ${owner.name}`}
          onPress={() => {
            if (shown === "none") go(true);
            else
              Alert.alert(`Withdraw your request to follow ${owner.name}?`, undefined, [
                { text: "Keep it", style: "cancel" },
                { text: "Withdraw", style: "destructive", onPress: () => go(false) },
              ]);
          }}
        />
      )}
    </View>
  );
}

/** The person's sizes and likes, as far as the viewer may see them. Wishlists only. */
function GiftProfileDetails({ page }: { page: PublicListPageData }) {
  const theme = useTheme();
  const profile = page.giftProfile;
  if (!profile) return null;
  const sizes = sizeSummary(profile.sizes);
  const birthday = page.showBirthday && profile.birthday ? formatBirthday(profile.birthday) : null;
  const rows: { label: string; value?: string; tags?: string[]; tone?: "like" | "skip" }[] = [];
  if (sizes.length > 0) rows.push({ label: "Sizes", value: sizes.join(" · ") });
  if (birthday) rows.push({ label: "Birthday", value: birthday });
  if (profile.colors) rows.push({ label: "Favorite colors", value: profile.colors });
  if (profile.likes?.length) rows.push({ label: "Likes", tags: profile.likes, tone: "like" });
  if (profile.skip?.length) rows.push({ label: "Please skip", tags: profile.skip, tone: "skip" });
  if (profile.notes) rows.push({ label: "Notes", value: profile.notes });
  if (rows.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" tone="tertiary">
        About {page.giftProfileName}
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={{ gap: 4 }}>
          <Text variant="footnote" tone="tertiary">
            {row.label}
          </Text>
          {row.tags ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {row.tags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    borderRadius: radius.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: row.tone === "skip" ? theme.surfaceAlt : theme.successSoft,
                  }}
                >
                  <Text variant="footnote" style={{ color: row.tone === "skip" ? theme.textSecondary : theme.success }}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="subhead">{row.value}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

// Who sees a list on its owner's profile: nobody, friends, followers or
// everyone, as the website's ProfileListingField asks it
// (src/components/profile-listing-field.tsx). Only a public list can show to
// everyone, and a private list can't be on a profile.

import {
  PROFILE_AUDIENCE,
  PROFILE_AUDIENCE_LINK_NOTE,
  clampProfileAudience,
  profileAudienceChoices,
  type ListVisibility,
  type ProfileAudience,
} from "@shared/list-access";
import { View } from "react-native";

import { Chip, Text } from "@/components/ui";
import { spacing } from "@/lib/theme";

/** What it says under the choice, or "" for nothing. The website's profileAudienceHint says the same. */
export function profileAudienceHint(audience: ProfileAudience, hasShippingAddress = false): string {
  return [
    PROFILE_AUDIENCE[audience].description,
    audience === "friends" || audience === "followers" ? PROFILE_AUDIENCE_LINK_NOTE : "",
    audience !== "hidden" && hasShippingAddress ? "Anyone who reserves a gift can see your shipping address." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function ProfileAudienceChips({
  visibility,
  value,
  onValueChange,
  hasShippingAddress = false,
  label = "Who sees it on your profile",
  disabled = false,
}: {
  visibility: ListVisibility;
  /** The owner's choice. Shown as the nearest one this kind of list allows. */
  value: ProfileAudience;
  onValueChange: (value: ProfileAudience) => void;
  hasShippingAddress?: boolean;
  /** Null leaves the heading out, for a row that already has one. */
  label?: string | null;
  disabled?: boolean;
}) {
  if (visibility === "private") {
    return (
      <Text variant="footnote" tone="tertiary">
        Private lists don&apos;t show on your profile.
      </Text>
    );
  }
  const shown = clampProfileAudience(value, visibility);
  const hint = profileAudienceHint(shown, hasShippingAddress);
  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {profileAudienceChoices(visibility).map((choice) => (
          <Chip
            key={choice}
            label={PROFILE_AUDIENCE[choice].label}
            selected={shown === choice}
            onPress={() => {
              if (!disabled) onValueChange(choice);
            }}
          />
        ))}
      </View>
      {hint ? (
        <Text variant="footnote" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

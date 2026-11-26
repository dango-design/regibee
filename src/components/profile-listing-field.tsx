"use client";

import { SelectField } from "@/components/base/select/select-field";
import {
  PROFILE_AUDIENCE,
  PROFILE_AUDIENCE_LINK_NOTE,
  clampProfileAudience,
  profileAudienceChoices,
  type ListVisibility,
  type ProfileAudience,
} from "@/lib/list-access";

/**
 * What the field says under the choice, or "" for nothing: who Friends are,
 * and what the choice doesn't change.
 */
export function profileAudienceHint(audience: ProfileAudience, hasShippingAddress = false): string {
  return [
    PROFILE_AUDIENCE[audience].description,
    // Friends and followers are about the profile only. Say so, or the choice
    // reads as who can open the list.
    audience === "friends" || audience === "followers" ? PROFILE_AUDIENCE_LINK_NOTE : "",
    audience !== "hidden" && hasShippingAddress ? "Anyone who reserves a gift can see your shipping address." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Who sees a list on its owner's profile: nobody, friends, followers or
 * everyone. The choices depend on who can open the list: only a public list
 * can show to everyone, and a private list can't be on a profile, so for
 * those it says so instead of asking.
 *
 * `audience` is the owner's choice. When the list's access doesn't allow it,
 * the field shows and sends the nearest choice that it does allow, and keeps
 * the owner's choice in case they switch the access back.
 */
export function ProfileListingField({
  visibility,
  audience,
  onChange,
  hasShippingAddress = false,
}: {
  visibility: ListVisibility;
  audience: ProfileAudience;
  onChange: (audience: ProfileAudience) => void;
  hasShippingAddress?: boolean;
}) {
  if (visibility === "private") {
    return (
      <div>
        <input type="hidden" name="profileAudience" value="hidden" />
        <input type="hidden" name="listedOnProfile" value="false" />
        <p className="text-sm text-tertiary">Private lists don&apos;t show on your profile.</p>
      </div>
    );
  }

  const shown = clampProfileAudience(audience, visibility);

  return (
    <div>
      <input type="hidden" name="profileAudience" value={shown} />
      {/* Kept for anything that still reads the old field. */}
      <input type="hidden" name="listedOnProfile" value={shown === "hidden" ? "false" : "true"} />
      <SelectField
        label="Who sees it on your profile"
        value={shown}
        onChange={(value) => onChange(value as ProfileAudience)}
        options={profileAudienceChoices(visibility).map((value) => ({
          value,
          label: PROFILE_AUDIENCE[value].label,
        }))}
        hint={profileAudienceHint(shown, hasShippingAddress)}
      />
    </div>
  );
}

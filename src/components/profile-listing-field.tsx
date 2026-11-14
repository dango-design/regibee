"use client";

import { Checkbox } from "@/components/base/checkbox/checkbox";

export function ProfileListingField({
  isPublic,
  isSelected,
  onChange,
  hasShippingAddress = false,
}: {
  isPublic: boolean;
  isSelected: boolean;
  onChange: (selected: boolean) => void;
  hasShippingAddress?: boolean;
}) {
  let hint = isPublic
    ? "Anyone with your profile link can see this registry."
    : "Only followers you approve see it on your profile. Everyone else needs the link.";
  if (isSelected && hasShippingAddress) {
    hint += " Anyone who reserves a gift can see your shipping address.";
  }

  return (
    <div>
      <input type="hidden" name="listedOnProfile" value={isSelected ? "true" : "false"} />
      <Checkbox
        isSelected={isSelected}
        onChange={onChange}
        label={<span className="font-normal">Show on my profile</span>}
        hint={hint}
      />
    </div>
  );
}

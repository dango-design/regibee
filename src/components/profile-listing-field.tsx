"use client";

import { Checkbox } from "@/components/base/checkbox/checkbox";
import { PROFILE_LISTING, type ListVisibility } from "@/lib/list-access";

/**
 * Whether a list shows on its owner's profile. The label says who will see
 * it there, because that depends on who can open the list. Private lists
 * can't be on a profile, so for those it says so instead of asking.
 */
export function ProfileListingField({
  visibility,
  isSelected,
  onChange,
  hasShippingAddress = false,
}: {
  visibility: ListVisibility;
  isSelected: boolean;
  onChange: (selected: boolean) => void;
  hasShippingAddress?: boolean;
}) {
  if (visibility === "private") {
    return (
      <div>
        <input type="hidden" name="listedOnProfile" value="false" />
        <p className="text-sm text-tertiary">Private lists don&apos;t show on your profile.</p>
      </div>
    );
  }

  const listing = PROFILE_LISTING[visibility];
  let hint: string = listing.description;
  if (isSelected && hasShippingAddress) {
    hint += " Anyone who reserves a gift can see your shipping address.";
  }

  return (
    <div>
      <input type="hidden" name="listedOnProfile" value={isSelected ? "true" : "false"} />
      <Checkbox
        isSelected={isSelected}
        onChange={onChange}
        label={<span className="font-normal">{listing.label}</span>}
        hint={hint}
      />
    </div>
  );
}

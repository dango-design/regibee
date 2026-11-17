// Whether a list shows on its owner's profile, as the website's
// ProfileListingField asks it (src/components/profile-listing-field.tsx). The
// label says who will see it there, because that depends on who can open the
// list. Private lists can't be on a profile.

import { PROFILE_LISTING, type ListVisibility } from "@shared/list-access";

import { Section, SwitchRow, Text } from "@/components/ui";

export function ProfileListingSwitch({
  visibility,
  value,
  onValueChange,
  hasShippingAddress = false,
}: {
  visibility: ListVisibility;
  value: boolean;
  onValueChange: (value: boolean) => void;
  hasShippingAddress?: boolean;
}) {
  if (visibility === "private") {
    return (
      <Text variant="footnote" tone="tertiary">
        Private lists don&apos;t show on your profile.
      </Text>
    );
  }
  const listing = PROFILE_LISTING[visibility];
  let hint: string = listing.description;
  if (value && hasShippingAddress) hint += " Anyone who reserves a gift can see your shipping address.";
  return (
    <Section>
      <SwitchRow icon="person" label={listing.label} description={hint} value={value} onValueChange={onValueChange} />
    </Section>
  );
}

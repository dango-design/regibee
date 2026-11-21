/**
 * The sections of a registry's settings page, in order. Each id is the
 * section's #fragment, so other pages can link straight to one, like "Change
 * this in settings" under hidden reservations. Some show only for some lists
 * or people, like Your store registries on a baby registry.
 */
export type RegistrySettingsSection =
  | "general"
  | "sharing"
  | "reservations"
  | "gift-profile"
  | "groups"
  | "categories"
  | "location"
  | "payment-methods"
  | "shipping-address"
  | "store-registries"
  | "managers"
  | "delete-registry";

/** A link to one section of a registry's settings page. */
export function registrySettingsHref(registryId: string, section: RegistrySettingsSection) {
  return `/dashboard/registry/${registryId}/settings#${section}`;
}

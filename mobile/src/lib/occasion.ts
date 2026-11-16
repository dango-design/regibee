// A registry's occasion name, from the website's occasionLabel
// (src/lib/registry-copy.ts), so the two can't drift. The new registry screen
// offers the website's choices too, REGISTRY_OCCASION_CHOICES.

import { occasionLabel as sharedOccasionLabel } from "@shared/registry-copy";

import type { Registry } from "@/lib/types";

export function occasionLabel(registry: Pick<Registry, "registry_type" | "event_type">) {
  return sharedOccasionLabel(registry.registry_type ?? "baby", registry.event_type);
}

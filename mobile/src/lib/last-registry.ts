// Remembers the list the owner last added to, so sharing a product goes there
// by default. That's one of their registries, or their gift ideas.

import { useEffect, useState } from "react";

import { kvStorage } from "@/lib/kv-storage";
import type { RegistrySummary } from "@/lib/types";

const KEY = "last-registry-id";

/**
 * Stands for the owner's gift ideas wherever the app picks a list, as if they
 * were one more list. Registry ids are uuids, so it can't clash with one.
 */
export const GIFT_IDEAS = "gift-ideas";

export function rememberRegistry(id: string) {
  kvStorage.setItem(KEY, id).catch(() => {});
}

/**
 * The list to add to: the one asked for, else the last one used, else the
 * first registry, else gift ideas. Undefined until the saved choice has been
 * read.
 */
export function useDefaultRegistry(registries: RegistrySummary[] | undefined, requested?: string | null) {
  const [saved, setSaved] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    kvStorage
      .getItem(KEY)
      .then(setSaved)
      .catch(() => setSaved(null));
  }, []);

  if (requested === GIFT_IDEAS) return GIFT_IDEAS;
  if (!registries || saved === undefined) return undefined;
  const ids = [...registries.map((r) => r.id), GIFT_IDEAS];
  if (requested && ids.includes(requested)) return requested;
  if (saved && ids.includes(saved)) return saved;
  return ids[0];
}

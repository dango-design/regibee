import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonalEventType, RegistryType } from "@/lib/types";
// A relative path with .ts, not @/lib, so registry-create.test.ts can load this
// file in Node's test runner (npm test).
import { DEFAULT_LIST_VISIBILITY, visibilityColumns, type ListVisibility } from "./list-access.ts";

// Making a registry row, shared by the registry form (createRegistry in
// src/lib/actions/registry.ts), the "What are you planning?" picker and an
// honoree's list request (src/lib/actions/events.ts). Server code only: the
// callers check who's signed in first.

/** The categories a new baby registry starts with. Personal lists start with none. */
export const BABY_DEFAULT_CATEGORIES = [
  "Nursery & Sleep",
  "Feeding",
  "Diapering",
  "Gear & Travel",
  "Bath",
  "Clothing",
  "Health & Safety",
  "Toys & Books",
  "Maternity & Postpartum",
  "Gifts & Extras",
];

// No l, o, 0 or 1, so a link is easy to read back. 32 characters, so each
// random byte maps to one character with no bias.
const LINK_CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/**
 * A registry's share link slug: up to 50 characters of its title, then 12
 * random characters (60 bits). Anyone with the link can open the list, so the
 * random part is what keeps it to the people it was sent to. Mirrors
 * new_registry_slug in supabase/migrations/20261114100553_list_links.sql,
 * which the phone app uses.
 */
export function generateRegistrySlug(title: string): string {
  const titlePart = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/^-+|-+$/g, "");
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const code = Array.from(bytes, (b) => LINK_CODE_ALPHABET[b % 32]).join("");
  return `${titlePart || "list"}-${code}`;
}

export interface NewRegistry {
  ownerId: string;
  title: string;
  registryType: RegistryType;
  /** Only for personal registries. */
  eventType: PersonalEventType | null;
  eventDate?: string | null;
  description?: string | null;
  honoreeNames?: string | null;
  /** Who can open it. New lists default to anyone with the link. */
  visibility?: ListVisibility;
  /** Ignored for private lists, which can't be on a profile. */
  listedOnProfile?: boolean;
  settings?: Record<string, unknown> | null;
}

/**
 * Inserts a registry, and a baby registry's starting categories. A database
 * trigger adds the owner as its first manager.
 */
export async function insertRegistry(
  client: SupabaseClient,
  registry: NewRegistry,
): Promise<{ id: string; slug: string; title: string } | { error: string }> {
  const visibility = registry.visibility ?? DEFAULT_LIST_VISIBILITY;
  const { data, error } = await client
    .from("registries")
    .insert({
      owner_id: registry.ownerId,
      title: registry.title,
      slug: generateRegistrySlug(registry.title),
      event_date: registry.eventDate || null,
      description: registry.description || null,
      honoree_names: registry.honoreeNames || null,
      ...visibilityColumns(visibility),
      listed_on_profile: visibility !== "private" && (registry.listedOnProfile ?? false),
      registry_type: registry.registryType,
      event_type: registry.registryType === "personal" ? registry.eventType : null,
      settings: registry.settings && Object.keys(registry.settings).length > 0 ? registry.settings : null,
    })
    .select("id, slug, title")
    .single();
  if (error || !data) return { error: error?.message ?? "The registry wasn't made. Try again." };

  if (registry.registryType === "baby") {
    await client.from("categories").insert(
      BABY_DEFAULT_CATEGORIES.map((name, index) => ({ registry_id: data.id, name, sort_order: index })),
    );
  }
  return data;
}

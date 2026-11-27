// What a baby registry's checklist page shows, as src/lib/checklist-page.ts
// loads it for the website's page and the phone app (src/app/api/app/data).
// Only types, and only relative imports of files without imports, so the app
// can share it through its @shared/* path.

import type { PaymentMethods } from "./types";

/** An item or gift fund on the list, as the checklist shows it. */
export interface ChecklistPageThing {
  id: string;
  kind: "item" | "fund";
  title: string;
  image_url: string | null;
  /** True when it's on this list from another of the owner's lists. */
  placed: boolean;
  /** The entry it counts for, by key, or null for none. */
  entry: string | null;
  /** True when someone chose the entry, false when its name matched it. */
  chosen: boolean;
}

export interface ChecklistPageData {
  registry: { id: string; title: string };
  /** The list's categories, so an added entry goes in the right one. */
  categories: { id: string; name: string }[];
  /** Where guests send money. For the gift fund dialog. */
  paymentMethods: PaymentMethods | null;
  zipCode?: string;
  /** Everything on the list, in list order: items, then gift funds. */
  things: ChecklistPageThing[];
  /** Entries marked as registered somewhere else, by key. */
  dismissed: string[];
  done: number;
  total: number;
  essentialsDone: number;
  essentialsTotal: number;
}

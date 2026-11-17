import { DEFAULT_CHECKLIST } from "./checklist-data";

// Which of the baby checklist's items (src/lib/checklist-data.ts) are on a
// list already, matched by keywords in the items' titles. The website's
// checklist page, its list page's progress ring and the phone app all use
// this, so they agree. It has only a relative import, so the app shares it.

/** Whether a checklist item matches one of the list's titles, already lowercased. */
export function isChecklistItemOnList(name: string, lowerTitles: string[]): boolean {
  const lower = name.toLowerCase();
  // Split on " / " or " & " to handle alternatives like "Glider / Rocker" or "Burp Cloths & Bibs"
  const alternatives = lower.split(/\s*[\/&]\s*/);
  // Keywords from each alternative (words >2 chars)
  const altKeywords = alternatives.map((alt) => alt.split(/\s+/).filter((w) => w.length > 2));

  return lowerTitles.some(
    (title) =>
      title === lower ||
      title.includes(lower) ||
      lower.includes(title) ||
      // Match if ALL keywords from ANY alternative appear in the title
      altKeywords.some((keywords) => keywords.length > 0 && keywords.every((kw) => title.includes(kw)))
  );
}

/** The checklist items on a list already, by their lowercased names. */
export function matchedChecklistItems(checklistNames: string[], registryTitles: string[]): Set<string> {
  const lowerTitles = registryTitles.map((t) => t.toLowerCase());
  return new Set(
    checklistNames.filter((name) => isChecklistItemOnList(name, lowerTitles)).map((name) => name.toLowerCase())
  );
}

/** Match checklist items to registry items using keyword-based fuzzy matching */
export function getChecklistProgress(
  registryTitles: string[],
  dismissedItems?: string[]
): {
  matched: number;
  total: number;
} {
  const lowerTitles = registryTitles.map((t) => t.toLowerCase());
  const dismissed = new Set((dismissedItems || []).map((i) => i.toLowerCase()));
  let matched = 0;
  const total = DEFAULT_CHECKLIST.reduce((sum, c) => sum + c.items.length, 0);

  for (const category of DEFAULT_CHECKLIST) {
    for (const item of category.items) {
      if (dismissed.has(item.name.toLowerCase()) || isChecklistItemOnList(item.name, lowerTitles)) matched++;
    }
  }

  return { matched, total };
}

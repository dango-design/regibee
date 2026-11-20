// A list's categories: guessing an item's category from words in its name,
// for baby lists' starting categories (Nursery & Sleep, Feeding and the
// rest), and the rules for a new category's name. The website, the phone app
// and the browser extension all use it. It has no imports, so they can share it.

export const MAX_CATEGORY_NAME_LENGTH = 100;

/** A new category's name with its spaces tidied, or null when there's no name. */
export function categoryName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, MAX_CATEGORY_NAME_LENGTH).trim();
  return name || null;
}

/** The list's category with this name, whatever its capitals, if it has one. */
export function categoryNamed<T extends { name: string }>(categories: T[], name: string): T | undefined {
  const key = categoryName(name)?.toLowerCase();
  return key ? categories.find((c) => categoryName(c.name)?.toLowerCase() === key) : undefined;
}

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "nursery & sleep": ["crib", "bassinet", "blanket", "swaddle", "mattress", "monitor", "mobile", "rocker", "glider", "rocking", "nightlight", "sound machine", "white noise", "sleep sack", "sheet", "pillow", "nursery", "cradle", "moses basket"],
  "feeding": ["bottle", "nursing", "breast pump", "formula", "bib", "highchair", "high chair", "sippy", "pacifier", "sterilizer", "warmer", "feeding", "breastfeed", "nipple", "lactation", "burp cloth"],
  "diapering": ["diaper", "wipe", "changing pad", "changing table", "pail", "rash cream", "nappy", "potty"],
  "gear & travel": ["stroller", "car seat", "carrier", "wrap", "sling", "travel", "pack n play", "playard", "play yard", "jogger", "wagon", "backpack carrier", "bike seat", "gate", "baby gate"],
  "bath": ["bath", "tub", "towel", "washcloth", "shampoo", "soap", "lotion", "grooming"],
  "clothing": ["onesie", "bodysuit", "pajama", "sleeper", "outfit", "romper", "dress", "sock", "shoe", "bootie", "hat", "mitten", "jacket", "coat", "clothing", "clothes", "gown"],
  "health & safety": ["thermometer", "medicine", "nasal", "aspirator", "humidifier", "first aid", "safety", "baby proof", "outlet cover", "cabinet lock", "corner guard", "sunscreen", "vitamin"],
  "toys & books": ["toy", "book", "rattle", "teether", "play mat", "playmat", "activity", "stuffed", "plush", "puzzle", "block", "game", "doll", "figurine", "reading"],
  "maternity & postpartum": ["maternity", "postpartum", "nursing bra", "belly band", "recovery", "prenatal", "postnatal", "mama", "mom"],
  "gifts & extras": ["gift card", "gift basket", "keepsake", "memory book", "photo", "frame", "ornament"],
};

/** The id of the list's category whose keywords appear in the title, if any. */
export function guessCategory(title: string, categories: { id: string; name: string }[]): string | undefined {
  const lower = title.toLowerCase();
  for (const [categoryName, words] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const word of words) {
      if (lower.includes(word)) {
        const match = categories.find((c) => c.name.toLowerCase() === categoryName);
        if (match) return match.id;
      }
    }
  }
  return undefined;
}

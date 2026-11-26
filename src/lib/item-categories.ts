// A list's categories: guessing an item's category from its name and the
// store's own category for it, and the rules for a new category's name. The
// website, the phone app and the browser extension all use it. It has no
// imports, so they can share it.

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

// ---------------------------------------------------------------------------
// Guessing a category
//
// Each broad category has a list of words and phrases. An item's name (and
// the store's category, when the page gives one) is matched against them on
// whole words, so "hat" doesn't match "that". A phrase of two words counts
// twice as much as one word, so "baby monitor" beats "monitor" and "dog toy"
// beats "toy". The category with the highest total wins.
//
// The guess prefers a category the list already has. A list category counts
// as one of the broad categories when its name contains one of that
// category's names ("Clothes & Shoes" is Clothing). The owner's own category
// names count as words too, so a list with "Candles" puts a candle there.
// When no category on the list fits, the guess names a broad category for the
// owner to add.
// ---------------------------------------------------------------------------

interface BroadCategory {
  /** The name a new category gets. */
  name: string;
  /** Words in a list category's name that make it this category. */
  names: string[];
  /** Words and phrases in an item's name that point to this category. */
  words: string[];
}

export const BROAD_CATEGORIES: BroadCategory[] = [
  {
    name: "Clothing",
    names: ["clothing", "clothes", "apparel", "fashion", "outfits", "wardrobe", "shoes"],
    words: [
      "clothing", "clothes", "apparel", "shirt", "t-shirt", "tshirt", "tee", "polo", "blouse", "tunic", "tank top",
      "crop top", "sweater", "jumper", "hoodie", "sweatshirt", "pullover", "cardigan", "fleece", "flannel", "jacket",
      "coat", "parka", "puffer", "windbreaker", "raincoat", "vest", "gilet", "blazer", "suit", "jeans", "denim",
      "pants", "trousers", "chinos", "shorts", "leggings", "joggers", "sweatpants", "skirt", "dress", "gown",
      "jumpsuit", "romper", "overalls", "onesie", "bodysuit", "pajamas", "pajama", "pyjamas", "pjs", "sleepwear",
      "nightgown", "robe", "bathrobe", "loungewear", "underwear", "boxers", "briefs", "bra", "bralette", "lingerie",
      "socks", "sock", "tights", "swimsuit", "bikini", "swim trunks", "board shorts", "rash guard", "jersey",
      "uniform", "costume", "outfit", "kimono", "necktie", "bow tie", "beanie", "baseball cap", "bucket hat", "hat",
      "gloves", "mittens", "shoes", "shoe", "sneakers", "sneaker", "trainers", "running shoes", "boots", "boot",
      "booties", "sandals", "slides", "flip flops", "slippers", "loafers", "heels", "pumps", "clogs", "cleats",
      "moccasins", "footwear", "crocs", "birkenstock", "ugg", "uggs", "levis", "carhartt", "patagonia",
      "lululemon", "uniqlo", "cat & jack",
          ],
  },
  {
    name: "Jewelry & Accessories",
    names: ["jewelry", "jewellery", "accessories", "bags", "watches"],
    words: [
      "jewelry", "jewellery", "necklace", "bracelet", "bangle", "earrings", "earring", "studs", "hoops", "pendant",
      "locket", "anklet", "brooch", "engagement ring", "wedding band", "watch", "wristwatch", "cufflinks",
      "purse", "handbag", "clutch", "tote", "tote bag", "crossbody", "wallet", "card holder", "backpack",
      "belt bag", "fanny pack", "sunglasses", "belt", "scarf", "keychain", "key chain", "umbrella",
      "hair clip", "claw clip", "scrunchie", "headband", "pandora", "tiffany", "mejuri", "kendra scott",
    ],
  },
  {
    name: "Beauty",
    names: ["beauty", "makeup", "skincare", "skin care", "cosmetics", "self care", "self-care", "grooming"],
    words: [
      "beauty", "makeup", "make up", "cosmetic", "cosmetics", "lipstick", "lip gloss", "lip balm", "lip oil",
      "lip liner", "mascara", "eyeliner", "eyeshadow", "eye shadow", "foundation", "concealer", "blush",
      "bronzer", "primer", "setting spray", "makeup brush", "makeup brushes", "nail polish",
      "manicure", "perfume", "cologne", "fragrance", "eau de parfum", "eau de toilette", "body mist", "skincare",
      "skin care", "serum", "moisturizer", "moisturiser", "face cream", "eye cream", "night cream", "cleanser",
      "face wash", "toner", "face mask", "sheet mask", "exfoliator", "retinol", "hyaluronic", "spf", "sunscreen",
      "shampoo", "conditioner", "hair mask", "hair oil", "dry shampoo", "hair dryer", "blow dryer", "hair straightener",
      "flat iron", "curling iron", "curling wand", "airwrap", "body wash", "body lotion", "body butter", "bath bomb",
      "bath bombs", "razor", "shaving", "beard", "trimmer", "deodorant", "sephora", "ulta", "cerave",
      "la roche posay", "the ordinary", "glossier", "fenty", "rare beauty", "charlotte tilbury", "drunk elephant",
      "laneige", "clinique", "estee lauder", "olaplex", "tatcha", "kiehls", "summer fridays", "sol de janeiro",
    ],
  },
  {
    name: "Food & Drink",
    names: ["food", "drink", "drinks", "snacks", "treats", "groceries", "pantry", "sweets", "wine"],
    words: [
      "food", "snack", "snacks", "chocolate", "chocolates", "candy", "candies", "sweets", "treats", "cookies",
      "cookie", "brownies", "cake", "cupcakes", "caramel", "toffee", "fudge", "gummies", "gummy", "licorice",
      "popcorn", "chips", "crackers", "pretzels", "nuts", "almonds", "pistachios", "jerky", "cheese", "charcuterie",
      "salami", "coffee", "coffee beans", "ground coffee", "espresso beans", "k cups", "tea", "matcha", "cocoa",
      "hot chocolate", "wine", "red wine", "white wine", "rose wine", "champagne", "prosecco", "beer", "cider", "whiskey",
      "whisky", "bourbon", "scotch", "vodka", "gin", "rum", "tequila", "mezcal", "sake", "liqueur", "cocktail mix",
      "soda", "juice", "kombucha", "sparkling water", "olive oil", "vinegar", "hot sauce", "sauce", "salsa",
      "spice", "spices", "seasoning", "salt", "honey", "maple syrup", "syrup", "jam", "preserves", "peanut butter",
      "pasta", "cereal", "granola", "oatmeal", "baking mix", "gourmet", "edible", "food gift", "gift basket",
      "snack box", "protein bar", "protein bars",
    ],
  },
  {
    name: "Games",
    names: ["games", "gaming", "video games", "board games", "puzzles"],
    words: [
      "game", "games", "board game", "card game", "party game", "video game", "gaming", "gamer", "puzzle", "puzzles",
      "jigsaw", "jigsaw puzzle", "chess", "checkers", "backgammon", "dominoes", "mahjong", "poker", "playing cards",
      "deck of cards", "dice", "trivia", "dungeons & dragons", "d&d", "catan", "monopoly", "scrabble", "uno",
      "codenames", "ticket to ride", "wingspan", "exploding kittens", "nintendo", "nintendo switch",
      "switch 2", "joy con", "playstation", "ps5", "ps4", "xbox", "xbox series x", "steam deck", "controller",
      "gamepad", "mario", "zelda", "pokemon", "minecraft", "fortnite", "call of duty", "rubiks cube", "escape room",
    ],
  },
  {
    name: "Toys",
    names: ["toys", "toy", "play", "playtime"],
    words: [
      "toy", "toys", "lego", "duplo", "building set", "building blocks", "building toy", "blocks", "doll", "dolls",
      "dollhouse", "barbie", "action figure", "figurine", "plush", "plushie", "stuffed animal",
      "stuffed toy", "teddy bear", "squishmallow", "squishmallows", "jellycat", "playset", "play set", "play kitchen",
      "train set", "hot wheels", "matchbox", "rc car", "remote control car", "nerf", "play doh", "playdough",
      "slime", "kinetic sand", "magna tiles", "magnatiles", "stacking", "shape sorter", "rattle", "teether",
      "play mat", "playmat", "activity center", "ride on", "tricycle", "balance bike", "kite", "bubbles",
      "fidget", "yoyo", "marbles", "melissa & doug", "fisher price", "little tikes", "vtech",
      "hape", "lovevery", "playmobil", "tonies", "toniebox", "yoto",
    ],
  },
  {
    name: "Books",
    names: ["books", "book", "reading", "library"],
    words: [
      "book", "books", "novel", "paperback", "hardcover", "hardback", "board book", "picture book", "kindle edition",
      "audiobook", "audible", "cookbook", "comic", "comics", "graphic novel", "manga", "box set", "boxed set",
      "biography", "memoir", "anthology", "poetry", "a novel", "bookmark", "book light",
    ],
  },
  {
    name: "Electronics",
    names: ["electronics", "tech", "gadgets", "devices"],
    words: [
      "electronics", "electronic", "tech", "gadget", "headphones", "headphone", "earbuds", "earphones", "airpods",
      "speaker", "speakers", "soundbar", "bluetooth", "charger", "charging", "charging stand",
      "power bank", "battery pack", "usb", "usb c", "hdmi", "cable", "adapter", "phone", "mobile phone",
      "smartphone", "iphone", "iphone case", "phone case", "android", "ipad", "tablet", "laptop",
      "macbook", "chromebook", "computer", "desktop", "monitor", "keyboard", "mechanical keyboard", "mouse",
      "webcam", "camera", "camera lens", "instant camera", "polaroid", "instax", "gopro", "drone", "kindle",
      "kindle paperwhite", "e reader", "ereader", "smartwatch", "smart watch", "apple watch", "fitbit", "garmin",
      "oura", "smart ring", "tv", "television", "streaming", "roku", "fire tv", "apple tv", "chromecast", "projector",
      "router", "wifi", "ssd", "hard drive", "memory card", "sd card", "echo dot", "amazon echo", "google pixel", "samsung galaxy", "alexa",
      "google home", "smart home", "smart plug", "smart bulb", "ring doorbell", "video doorbell",
      "security camera", "vr", "virtual reality", "meta quest", "oculus", "sonos", "bose", "jbl", "beats",
      "sony", "samsung", "anker", "logitech", "airtag", "tile tracker", "label maker", "printer", "3d printer",
          ],
  },
  {
    name: "Home & Kitchen",
    names: ["home", "kitchen", "house", "decor", "household", "bedroom", "living room", "dining", "cooking", "bed & bath"],
    words: [
      "home", "kitchen", "household", "cookware", "pan", "pans", "frying pan", "skillet", "cast iron", "pot",
      "pots", "dutch oven", "saucepan", "wok", "knife", "knives", "chef knife", "knife set", "cutting board",
      "baking", "bakeware", "baking sheet", "sheet pan", "mixing bowl", "measuring cups", "spatula", "utensils",
      "blender", "mixer", "stand mixer", "hand mixer", "kitchenaid", "food processor", "instant pot",
      "pressure cooker", "slow cooker", "crockpot", "air fryer", "toaster", "toaster oven", "microwave", "kettle",
      "electric kettle", "coffee maker", "coffee machine", "espresso machine", "nespresso", "keurig", "french press",
      "pour over", "grinder", "coffee grinder", "mug", "mugs", "cup", "cups", "tumbler", "water bottle", "stanley",
      "yeti", "owala", "hydro flask", "thermos", "plates", "dinnerware", "bowl", "bowls", "glassware",
      "wine glasses", "drinkware", "flatware", "silverware", "cutlery", "serving", "platter", "tray",
      "napkins", "tablecloth", "placemats", "apron", "oven mitt", "food storage", "containers", "lunch box",
      "candle", "candles", "diffuser", "essential oil", "vase", "decor", "home decor", "wall art", "picture frame",
      "photo frame", "frame", "mirror", "clock", "lamp", "lighting", "string lights", "rug", "doormat",
      "curtains", "blinds", "pillow", "pillows", "throw pillow", "pillowcase", "blanket", "throw blanket",
      "weighted blanket", "fleece blanket", "bedding", "sheets", "sheet set", "duvet", "duvet cover", "comforter", "quilt",
      "mattress", "mattress topper", "towel", "towels", "bath towel", "bath mat", "shower curtain", "furniture",
      "chair", "armchair", "sofa", "couch", "ottoman", "stool", "table", "coffee table", "side table", "dresser",
      "nightstand", "bookshelf", "shelf", "shelves", "storage", "organizer", "basket", "bins", "hamper",
      "laundry", "iron", "steamer", "vacuum", "robot vacuum", "roomba", "dyson", "mop", "air purifier",
      "humidifier", "fan", "space heater", "cleaning", "trash can", "dish rack", "le creuset", "staub", "lodge",
      "ninja", "vitamix", "cuisinart", "breville", "oxo", "williams sonoma", "crate & barrel", "pottery barn",
    ],
  },
  {
    name: "Garden & Outdoor",
    names: ["garden", "outdoor", "outdoors", "patio", "yard", "plants"],
    words: [
      "garden", "gardening", "plant", "plants", "planter", "plant pot", "pots and planters", "seeds", "succulent",
      "houseplant", "watering can", "hose", "garden hose", "pruning shears", "trowel", "lawn", "lawn mower",
      "patio", "outdoor furniture", "grill", "bbq", "barbecue", "smoker", "pellet grill", "traeger", "weber",
      "pizza oven", "ooni", "fire pit", "solo stove", "bird feeder", "birdhouse", "outdoor lights", "hammock",
      "raised bed", "compost",
    ],
  },
  {
    name: "Sports & Fitness",
    names: ["sports", "fitness", "exercise", "workout", "gym", "outdoors", "camping", "hiking"],
    words: [
      "sports", "sport", "fitness", "workout", "exercise", "gym", "yoga", "yoga mat", "pilates", "dumbbell",
      "dumbbells", "weights", "kettlebell", "resistance bands", "jump rope", "foam roller", "massage gun",
      "treadmill", "exercise bike", "rowing machine", "peloton", "bike", "bicycle", "cycling", "helmet",
      "running", "hiking", "hiking boots", "trekking poles", "camping", "tent", "sleeping bag", "sleeping pad",
      "camp stove", "headlamp", "lantern", "cooler", "climbing", "chalk bag", "fishing", "fishing rod", "tackle",
      "golf", "golf balls", "golf clubs", "tennis", "tennis racket", "pickleball", "paddle", "racket", "racquet",
      "basketball", "football", "soccer", "soccer ball", "baseball", "baseball glove", "softball", "volleyball",
      "hockey", "lacrosse", "ski", "skis", "snowboard", "skateboard", "skates", "roller skates", "ice skates",
      "surfboard", "wetsuit", "kayak", "paddleboard", "swim goggles", "goggles", "binoculars", "scooter",
      "nike", "adidas", "under armour", "rei", "the north face", "osprey", "hydration pack",
    ],
  },
  {
    name: "Health & Wellness",
    names: ["health", "wellness", "self care", "self-care", "medicine", "first aid"],
    words: [
      "health", "wellness", "vitamin", "vitamins", "supplement", "supplements", "multivitamin", "probiotic",
      "protein powder", "collagen", "electrolytes", "melatonin", "first aid", "thermometer", "blood pressure",
      "heating pad", "massager", "massage", "acupressure", "sleep mask", "eye mask", "ear plugs", "earplugs",
      "white noise", "sound machine", "sunrise alarm", "hatch rest", "meditation", "aromatherapy", "pill organizer",
      "toothbrush", "electric toothbrush", "water flosser", "floss", "mouthwash", "contact lens", "reading glasses",
    ],
  },
  {
    name: "Arts & Crafts",
    names: ["arts", "art", "crafts", "craft", "crafting", "diy", "hobbies"],
    words: [
      "craft", "crafts", "crafting", "art", "art supplies", "paint", "paints", "acrylic", "acrylic paint",
      "watercolor", "watercolour", "oil paint", "paintbrush", "paint brushes", "canvas", "easel", "sketchbook",
      "sketch", "drawing", "markers", "colored pencils", "coloring book", "crayons", "crayon", "crayola", "pastels", "clay",
      "polymer clay", "pottery", "yarn", "knitting", "knitting needles", "crochet", "crochet hook", "sewing",
      "sewing machine", "embroidery", "cross stitch", "quilting", "fabric", "cricut", "vinyl cutter", "glue gun",
      "hot glue", "stickers", "scrapbook", "scrapbooking", "stamps", "calligraphy", "beads", "jewelry making",
      "diy kit", "craft kit", "paint by numbers",
    ],
  },
  {
    name: "Music",
    names: ["music", "instruments", "records", "vinyl"],
    words: [
      "music", "musical", "instrument", "guitar", "acoustic guitar", "electric guitar", "bass guitar", "ukulele",
      "piano", "digital piano", "keyboard piano", "drum", "drums", "drum set", "violin", "cello", "flute",
      "clarinet", "saxophone", "trumpet", "harmonica", "kalimba", "capo", "guitar strings", "amplifier",
      "effects pedal", "metronome", "microphone", "audio interface", "midi",
      "sheet music", "vinyl", "vinyl record", "records", "album", "turntable", "record player",
      "fender", "gibson", "yamaha",
    ],
  },
  {
    name: "Office & Stationery",
    names: ["office", "stationery", "school", "desk", "work", "study"],
    words: [
      "office", "stationery", "desk", "standing desk", "office chair", "desk chair", "desk lamp", "desk organizer",
      "pen", "pens", "fountain pen", "pencil", "pencils", "mechanical pencil", "highlighters", "notebook",
      "notebooks", "journal", "planner", "agenda", "notepad", "sticky notes", "post it", "stapler", "binder",
      "folder", "calendar", "envelopes", "stationery set", "greeting cards", "washi tape", "school supplies",
      "moleskine", "leuchtturm", "rocketbook", "laptop stand", "monitor stand", "desk mat", "whiteboard",
    ],
  },
  {
    name: "Pets",
    names: ["pets", "pet", "dog", "dogs", "cat", "cats", "puppy"],
    words: [
      "pet", "pets", "dog", "dogs", "puppy", "cat", "cats", "kitten", "dog toy", "cat toy", "chew toy",
      "dog bed", "cat bed", "pet bed", "dog food", "cat food", "dog treats", "cat treats", "kibble", "leash",
      "collar", "harness", "dog harness", "crate", "kennel", "litter", "litter box", "cat tree", "scratching post",
      "pet carrier", "aquarium", "fish tank", "bird cage", "hamster", "chewy", "kong", "petco", "petsmart",
    ],
  },
  {
    name: "Baby",
    names: ["baby", "nursery", "infant", "newborn"],
    words: [
      "crib", "bassinet", "stroller", "car seat", "infant car seat", "baby carrier", "diaper", "diapers",
      "diaper bag", "wipes", "baby wipes", "pacifier", "baby bottle", "baby bottles", "breast pump", "high chair",
      "highchair", "baby monitor", "swaddle", "sleep sack", "burp cloth", "bib", "bibs", "baby gate",
      "changing pad", "baby bouncer", "bouncer", "baby swing", "playard", "pack n play", "nursing pillow",
      "baby bath", "newborn", "infant", "baby food",
    ],
  },
  {
    name: "Travel",
    names: ["travel", "trips", "luggage"],
    words: [
      "travel", "luggage", "suitcase", "carry on", "checked bag", "duffel", "duffle", "weekender", "packing cubes",
      "travel pillow", "neck pillow", "passport holder", "passport cover", "toiletry bag", "dopp kit",
      "luggage tag", "travel adapter", "samsonite", "monos", "travelpro",
    ],
  },
  {
    name: "Gift Cards & Experiences",
    names: ["gift cards", "experiences", "experience", "subscriptions", "tickets", "date night"],
    words: [
      "gift card", "gift certificate", "egift", "e gift card", "voucher", "experience", "tickets", "ticket",
      "concert", "lesson", "lessons", "workshop", "membership", "subscription", "spa day", "massage gift",
      "date night", "masterclass", "museum",     ],
  },
];

/**
 * The starting categories of a baby registry (BABY_DEFAULT_CATEGORIES in
 * src/lib/registry-create.ts), with the words that point to each. A baby list
 * keeps these names, so they're matched here by name.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "nursery & sleep": ["crib", "bassinet", "blanket", "swaddle", "mattress", "baby monitor", "mobile", "rocker", "glider", "rocking chair", "nightlight", "night light", "sound machine", "white noise", "sleep sack", "crib sheet", "sheet", "pillow", "nursery", "cradle", "moses basket", "dresser", "changing table"],
  "feeding": ["bottle", "bottles", "nursing", "breast pump", "formula", "bib", "bibs", "highchair", "high chair", "sippy", "sippy cup", "pacifier", "sterilizer", "bottle warmer", "feeding", "breastfeed", "breastfeeding", "nipple", "nipples", "lactation", "burp cloth", "burp cloths", "baby food", "spoon", "spoons", "suction plate"],
  "diapering": ["diaper", "diapers", "wipe", "wipes", "changing pad", "diaper pail", "pail", "rash cream", "diaper cream", "nappy", "potty", "diaper bag"],
  "gear & travel": ["stroller", "car seat", "carrier", "baby carrier", "wrap", "sling", "travel", "pack n play", "playard", "play yard", "jogger", "wagon", "backpack carrier", "bike seat", "gate", "baby gate", "bouncer", "swing"],
  "bath": ["bath", "baby bath", "tub", "bath tub", "towel", "hooded towel", "washcloth", "washcloths", "shampoo", "soap", "lotion", "body wash", "grooming", "nail clipper", "brush"],
  "clothing": ["onesie", "onesies", "bodysuit", "bodysuits", "pajama", "pajamas", "sleeper", "sleepers", "outfit", "romper", "dress", "sock", "socks", "shoe", "shoes", "bootie", "booties", "hat", "mitten", "mittens", "jacket", "coat", "clothing", "clothes", "gown", "leggings", "pants", "shirt", "sweater", "snowsuit"],
  "health & safety": ["thermometer", "medicine", "nasal", "aspirator", "humidifier", "first aid", "safety", "baby proof", "babyproof", "outlet cover", "outlet covers", "cabinet lock", "cabinet locks", "corner guard", "sunscreen", "vitamin", "vitamins", "nail file"],
  "toys & books": ["toy", "toys", "book", "books", "board book", "rattle", "teether", "play mat", "playmat", "activity", "activity center", "stuffed", "stuffed animal", "plush", "puzzle", "blocks", "game", "doll", "figurine", "reading", "lovey"],
  "maternity & postpartum": ["maternity", "postpartum", "nursing bra", "belly band", "recovery", "prenatal", "postnatal", "mama", "mom", "pregnancy"],
  "gifts & extras": ["gift card", "gift basket", "keepsake", "memory book", "baby book", "photo", "frame", "ornament"],
};

/** The broad categories each of a baby list's starting categories takes in. */
const BABY_CATEGORY_COVERS: Record<string, string[]> = {
  "nursery & sleep": ["Baby"],
  "feeding": [],
  "diapering": [],
  "gear & travel": ["Travel"],
  "bath": [],
  "clothing": ["Clothing"],
  "health & safety": ["Health & Wellness"],
  "toys & books": ["Toys", "Games", "Books"],
  "maternity & postpartum": [],
  "gifts & extras": ["Gift Cards & Experiences"],
};

// Words in an owner's own category names that say nothing about what's in it.
const FILLER_WORDS = new Set([
  "and", "the", "for", "with", "of", "a", "an", "my", "our", "his", "her", "their", "your", "other", "others",
  "misc", "miscellaneous", "stuff", "things", "items", "gifts", "gift", "extras", "extra", "ideas", "wants",
  "wishlist", "list", "random", "new", "more", "big", "small", "little", "fun", "nice", "cool", "favorite",
  "favorites", "must", "haves", "have", "essentials",
]);

/**
 * Lowercase words with only letters, digits and "&", one space apart, with a
 * space at each end so a phrase can be found on whole words.
 */
function words(text: string): string {
  // Some phone builds have no normalize(). Accents stay there, which is fine.
  const unaccented = typeof text.normalize === "function" ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : text;
  const plain = unaccented
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/\band\b/g, "&")
    .replace(/[^a-z0-9&]+/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .trim()
    .replace(/\s+/g, " ");
  return ` ${plain} `;
}

/** The forms of a phrase to look for: as written, and its last word in the plural. */
function forms(phrase: string): string[] {
  const base = words(phrase).trim();
  if (!base) return [];
  const out = [base, `${base}s`];
  if (/(s|x|z|ch|sh)$/.test(base)) out.push(`${base}es`);
  if (/[^aeiou]y$/.test(base)) out.push(`${base.slice(0, -1)}ies`);
  return out;
}

/** How much a phrase counts: one for each word in it. */
function weight(phrase: string): number {
  return words(phrase).trim().split(" ").filter((w) => w !== "&").length;
}

/**
 * The total of the phrases found in the text. Each phrase counts once, and a
 * phrase inside a longer one that was found doesn't count again, so "home
 * decor" counts two, not four with "home" and "decor".
 */
function score(text: string, phrases: string[]): number {
  const found: string[] = [];
  for (const phrase of phrases) {
    const form = forms(phrase).find((f) => text.includes(` ${f} `));
    if (form) found.push(form);
  }
  found.sort((a, b) => weight(b) - weight(a));
  const counted: string[] = [];
  let total = 0;
  for (const form of found) {
    if (counted.some((longer) => ` ${longer} `.includes(` ${form} `))) continue;
    counted.push(form);
    total += weight(form);
  }
  return total;
}

/** What to guess from: an item's name, and the store's category for it if the page gave one. */
export interface CategoryClues {
  title: string;
  /**
   * The store's category path, most general first, as in "Clothing, Shoes &
   * Jewelry › Men › Shirts". The product readers read it from the page's
   * breadcrumbs.
   */
  storeCategory?: string[] | null;
}

/** The score of each broad category for an item. */
function broadScores(clues: CategoryClues): Map<string, number> {
  const title = words(clues.title);
  // The store's most specific category says the most, so it counts three times.
  const path = (clues.storeCategory ?? []).filter((step) => typeof step === "string" && step.trim());
  const last = path.length > 0 ? words(path[path.length - 1]) : "";
  const rest = path.length > 1 ? words(path.slice(0, -1).join(" | ")) : "";
  const scores = new Map<string, number>();
  for (const broad of BROAD_CATEGORIES) {
    let total = score(title, broad.words);
    if (last) total += 3 * score(last, [...broad.words, ...broad.names]);
    if (rest) total += score(rest, [...broad.words, ...broad.names]);
    if (total > 0) scores.set(broad.name, total);
  }
  return scores;
}

/** The broad categories a list's category stands for, by its name. */
function broadNamesOf(categoryName: string): string[] {
  const key = categoryName.trim().toLowerCase();
  if (key in BABY_CATEGORY_COVERS) return BABY_CATEGORY_COVERS[key];
  const name = words(categoryName);
  return BROAD_CATEGORIES.filter(
    (broad) => broad.name.toLowerCase() === key || broad.names.some((n) => forms(n).some((form) => name.includes(` ${form} `))),
  ).map((broad) => broad.name);
}

/** The words of an owner's own category name worth matching on. */
function ownWords(categoryName: string): string[] {
  const all = words(categoryName).trim();
  const singles = all.split(" ").filter((w) => w.length >= 3 && !FILLER_WORDS.has(w) && w !== "&");
  // "Board games" matches "board game" and "game": forms() adds the plural back.
  const singular = (w: string) => (w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  const phrases = FILLER_WORDS.has(all) ? singles : [all, ...singles];
  return [...new Set(phrases.map(singular))].filter(Boolean);
}

/** A guess: one of the list's categories, or the name of one to add. */
export type CategoryGuess = { id: string; name: string } | { id?: undefined; name: string };

/**
 * The best category for an item: one the list has when one fits as well as
 * any, otherwise the name of a broad category to add. Undefined when nothing
 * in the item's name or store category points anywhere.
 */
export function suggestCategory(
  clues: CategoryClues | string,
  categories: { id: string; name: string }[],
): CategoryGuess | undefined {
  const given: CategoryClues = typeof clues === "string" ? { title: clues } : clues;
  if (!given.title?.trim() && !given.storeCategory?.length) return undefined;
  const broad = broadScores(given);
  const title = words(given.title ?? "");
  const path = words((given.storeCategory ?? []).join(" | "));

  let best: { id: string; name: string; score: number } | undefined;
  for (const category of categories) {
    const key = category.name.trim().toLowerCase();
    let total = 0;
    for (const name of broadNamesOf(category.name)) total = Math.max(total, broad.get(name) ?? 0);
    // A baby list's starting categories count double, so the list's own
    // Feeding beats a new Baby category for a baby bottle.
    const babyWords = CATEGORY_KEYWORDS[key];
    if (babyWords) total = Math.max(total, 2 * (score(title, babyWords) + score(path, babyWords)));
    // The owner named this category, so its own words count double.
    total = Math.max(total, 2 * (score(title, ownWords(category.name)) + score(path, ownWords(category.name))));
    if (total > 0 && (!best || total > best.score)) best = { id: category.id, name: category.name, score: total };
  }

  let topBroad: { name: string; score: number } | undefined;
  for (const { name } of BROAD_CATEGORIES) {
    const value = broad.get(name) ?? 0;
    if (value > 0 && (!topBroad || value > topBroad.score)) topBroad = { name, score: value };
  }

  if (best && (!topBroad || best.score >= topBroad.score)) return { id: best.id, name: best.name };
  if (!topBroad) return undefined;
  // A category with that name may be on the list under another spelling.
  const same = categoryNamed(categories, topBroad.name);
  return same ? { id: same.id, name: same.name } : { name: topBroad.name };
}

/** The id of the list's category that best fits the item, if one does. */
export function guessCategory(title: string, categories: { id: string; name: string }[]): string | undefined {
  const guess = suggestCategory(title, categories);
  return guess?.id;
}

// Steps of a store's breadcrumbs that say nothing about the product.
const EMPTY_STEPS = /^(home|homepage|shop|shop all|all|all products|products|store|back|back to results|search|results|categories|departments|see all)$/i;

/**
 * The store's category path from its breadcrumbs, cleaned: the start page,
 * the product's own name and anything too long to be a category left out, at
 * most six steps of 60 characters. Empty when nothing is left. The
 * extension's reader (extension/src/product-reader.ts) can't import, so it
 * has its own copy of these rules: change both.
 */
export function storeCategoryPath(steps: unknown[], productTitle?: string | null): string[] {
  const title = (productTitle ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const out: string[] = [];
  for (const raw of steps) {
    if (typeof raw !== "string") continue;
    const step = raw.replace(/\s+/g, " ").trim();
    if (!step || step.length > 60 || EMPTY_STEPS.test(step)) continue;
    if (title && (step.toLowerCase() === title || title.startsWith(step.toLowerCase()) && step.length > 25)) continue;
    if (out[out.length - 1] === step) continue;
    out.push(step);
  }
  return out.slice(-6);
}

/** The start of a planned category's id in sortPlan, for one the list doesn't have yet. */
export const PLANNED_CATEGORY_PREFIX = "new:";

/**
 * Which category each item goes in, for "Sort into categories" on a list's
 * page. Items nothing fits are left out. A category the list doesn't have yet
 * gets the id "new:<name>", and later items can go in it too, so the same
 * name is only added once. `newNames` lists those names in the order to add
 * them.
 */
export function sortPlan(
  items: { id: string; title: string }[],
  categories: { id: string; name: string }[],
): { assignments: { itemId: string; categoryId: string }[]; newNames: string[] } {
  const known = [...categories];
  const assignments: { itemId: string; categoryId: string }[] = [];
  const newNames: string[] = [];
  for (const item of items) {
    const guess = suggestCategory(item.title, known);
    if (!guess) continue;
    let id = guess.id;
    if (!id) {
      id = `${PLANNED_CATEGORY_PREFIX}${guess.name}`;
      known.push({ id, name: guess.name });
      newNames.push(guess.name);
    }
    assignments.push({ itemId: item.id, categoryId: id });
  }
  return { assignments, newNames };
}

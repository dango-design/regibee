// The baby checklist: what most new parents need, by category. The website's
// checklist page and the phone app's show it, and src/lib/checklist-matching.ts
// works out what on a list counts for each entry. No imports, so the app and
// Node's test runner can load it.
//
// The entries, prices and safety wording were checked against the AAP, CPSC,
// NHTSA, CDC, FDA, the NHS and registry sites such as Babylist in November
// 2026. Prices are rough 2026 US prices, for one of whatever the quantity
// counts.

/** A page a parent can read for more, shown as a small link on the entry. */
export interface ChecklistSource {
  /** Who published it, as the link shows it: "AAP", "CPSC". */
  name: string;
  /** The page's own title, for the link's tooltip and screen readers. */
  title: string;
  url: string;
}

export interface ChecklistItem {
  name: string;
  /**
   * Saved on items and gift funds (checklist_entry) to say which entry they
   * count for. Never change a key, even when the name changes: saved choices
   * would stop counting.
   */
  key: string;
  /**
   * Other words for it in store product names, such as "bodysuit" for
   * onesies. An item counts when its name has every word of the entry's name,
   * or of one of these (src/lib/checklist-matching.ts).
   */
  aliases?: string[];
  /** Names it had before, so "Mark as registered" saved under an old name still counts. */
  formerNames?: string[];
  isEssential: boolean;
  /** For one of whatever `unit` counts, or for the item when there's no unit. */
  suggestedPrice: string;
  suggestedQuantity: number;
  /** What the quantity counts, singular and plural: ["box", "boxes"]. */
  unit?: [string, string];
  /** Why it matters, for guests too: it becomes the item's note. */
  description?: string;
  /** Pages to read more, most relevant first. */
  sources?: ChecklistSource[];
  /** Money toward something, not a thing to buy. Adding it makes a gift fund, not an item. */
  fund?: boolean;
}

export interface ChecklistCategory {
  name: string;
  icon: string;
  items: ChecklistItem[];
}

/** "2 boxes", "1 box", or "6" for an entry with no unit. */
export function checklistQuantity(entry: Pick<ChecklistItem, "suggestedQuantity" | "unit">): string {
  const { suggestedQuantity: qty, unit } = entry;
  return unit ? `${qty} ${qty === 1 ? unit[0] : unit[1]}` : String(qty);
}

/** "$30-45 per box", or the price as it is for an entry with no unit. */
export function checklistPrice(entry: Pick<ChecklistItem, "suggestedPrice" | "unit">): string {
  return entry.unit && entry.suggestedPrice.startsWith("$") ? `${entry.suggestedPrice} per ${entry.unit[0]}` : entry.suggestedPrice;
}

// Pages the entries link to. Each was opened to check it's there.
const AAP_SAFE_SLEEP: ChecklistSource = {
  name: "AAP",
  title: "A Parent's Guide to Safe Sleep",
  url: "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx",
};
const AAP_SWADDLING: ChecklistSource = {
  name: "AAP",
  title: "Swaddling: Is It Safe?",
  url: "https://www.healthychildren.org/English/ages-stages/baby/diapers-clothing/Pages/Swaddling-Is-it-Safe.aspx",
};
const AAP_CAR_SEATS: ChecklistSource = {
  name: "AAP",
  title: "Car Safety Seats: Information for Families",
  url: "https://www.healthychildren.org/English/safety-prevention/on-the-go/Pages/Car-Safety-Seats-Information-for-Families.aspx",
};
const AAP_TEMPERATURE: ChecklistSource = {
  name: "AAP",
  title: "How to Take a Child's Temperature",
  url: "https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/How-to-Take-a-Childs-Temperature.aspx",
};
const AAP_CUPS: ChecklistSource = {
  name: "AAP",
  title: "Discontinuing the Bottle",
  url: "https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Discontinuing-the-Bottle.aspx",
};
const AAP_SUN: ChecklistSource = {
  name: "AAP",
  title: "Sun Safety",
  url: "https://healthychildren.org/English/safety-prevention/at-play/Pages/Sun-Safety.aspx",
};
const NHTSA_CAR_SEATS: ChecklistSource = {
  name: "NHTSA",
  title: "Car Seats and Booster Seats",
  url: "https://www.nhtsa.gov/vehicle-safety/car-seats-and-booster-seats",
};
const CPSC_CRIBS: ChecklistSource = {
  name: "CPSC",
  title: "The New Crib Standard: Questions and Answers",
  url: "https://onsafety.cpsc.gov/blog/2011/06/14/the-new-crib-standard-questions-and-answers",
};
const CPSC_SAFER_SPACES: ChecklistSource = {
  name: "CPSC",
  title: "Top Tips for Safer Spaces for Baby",
  url: "https://www.cpsc.gov/s3fs-public/TopTipsSaferSpacesforBabyENNSN161.pdf",
};
const CPSC_NURSING_PILLOWS: ChecklistSource = {
  name: "CPSC",
  title: "Nursing Pillows",
  url: "https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Nursing-Pillows",
};
const CPSC_WINDOW_CORDS: ChecklistSource = {
  name: "CPSC",
  title: "New safety standard for window covering cords",
  url: "https://www.cpsc.gov/Newsroom/News-Releases/2023/CPSC-Approves-New-Federal-Safety-Standard-for-Custom-Window-Coverings-to-Prevent-Deaths-and-Serious-Injuries-from-Strangulation-Window-Covering-Cords-Now-Deemed-a-Substantial-Product-Hazard",
};
const CPSC_ANCHOR_IT: ChecklistSource = {
  name: "CPSC",
  title: "Anchor It: preventing furniture and TV tip-overs",
  url: "https://www.anchorit.gov/",
};
const CDC_FEEDING_ITEMS: ChecklistSource = {
  name: "CDC",
  title: "How to Clean, Sanitize, and Store Infant Feeding Items",
  url: "https://www.cdc.gov/hygiene/about/clean-sanitize-store-infant-feeding-items.html",
};
const FDA_TEETHING: ChecklistSource = {
  name: "FDA",
  title: "Safely Soothing Teething Pain",
  url: "https://www.fda.gov/consumers/consumer-updates/safely-soothing-teething-pain-infants-and-children",
};
const HEALTHCARE_GOV_PUMPS: ChecklistSource = {
  name: "HealthCare.gov",
  title: "Breastfeeding benefits",
  url: "https://www.healthcare.gov/coverage/breast-feeding-benefits/",
};
const NHS_WHAT_YOU_NEED: ChecklistSource = {
  name: "NHS",
  title: "What you'll need for your baby",
  url: "https://www.nhs.uk/baby/caring-for-a-newborn/what-you-will-need-for-your-baby/",
};
const MAYO_HUMIDIFIERS: ChecklistSource = {
  name: "Mayo Clinic",
  title: "Warm-mist versus cool-mist humidifier",
  url: "https://www.mayoclinic.org/diseases-conditions/common-cold/expert-answers/cool-mist-humidifiers/faq-20058199",
};
const SOUND_MACHINE_STUDY: ChecklistSource = {
  name: "Pediatrics",
  title: "Infant sleep machines and hazardous sound pressure levels",
  url: "https://pubmed.ncbi.nlm.nih.gov/24590753/",
};
const NATIONWIDE_GATES: ChecklistSource = {
  name: "Nationwide Children's",
  title: "Baby Gates",
  url: "https://www.nationwidechildrens.org/research/areas-of-research/center-for-injury-research-and-policy/injury-topics/home-safety/baby-gates",
};
const BABYLIST_DIAPERS: ChecklistSource = {
  name: "Babylist",
  title: "How Many Diapers Does a Baby Need?",
  url: "https://www.babylist.com/hello-baby/how-many-diapers-babys-first-year",
};

export const DEFAULT_CHECKLIST: ChecklistCategory[] = [
  {
    name: "Nursery & Sleep",
    icon: "moon",
    items: [
      {
        name: "Crib",
        key: "crib",
        isEssential: true,
        suggestedPrice: "$150-600",
        suggestedQuantity: 1,
        description: "A crib that meets current federal safety rules. Skip drop-side cribs and any made before mid-2011.",
        sources: [CPSC_CRIBS, AAP_SAFE_SLEEP],
      },
      {
        name: "Crib Mattress",
        key: "crib-mattress",
        isEssential: true,
        suggestedPrice: "$60-300",
        suggestedQuantity: 1,
        description: "A firm, flat mattress that fits the crib with no gaps around the edges. Buy it new.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Bassinet",
        key: "bassinet",
        isEssential: true,
        suggestedPrice: "$80-350",
        suggestedQuantity: 1,
        description:
          "A small bed for your room, since experts advise sharing a room, not a bed, for at least 6 months. It needs its own fitted sheets.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Fitted Crib Sheets",
        key: "fitted-crib-sheets",
        isEssential: true,
        suggestedPrice: "$15-30",
        suggestedQuantity: 4,
        unit: ["sheet", "sheets"],
        description: "Tight fitted sheets are the only bedding a crib needs. Skip bumpers, pillows and blankets.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Waterproof Mattress Protectors",
        key: "waterproof-mattress-protectors",
        isEssential: false,
        suggestedPrice: "$10-20",
        suggestedQuantity: 2,
        unit: ["protector", "protectors"],
        description: "Placed between the mattress and sheet to protect against leaks and blowouts.",
      },
      {
        name: "Swaddles",
        key: "swaddles",
        isEssential: true,
        suggestedPrice: "$12-35",
        suggestedQuantity: 4,
        unit: ["swaddle", "swaddles"],
        description:
          "Wraps a newborn snugly for sleep on their back. Stop swaddling as soon as baby shows signs of trying to roll, and never use a weighted one.",
        sources: [AAP_SWADDLING],
      },
      {
        name: "Sleep Sacks",
        key: "sleep-sacks",
        aliases: ["sleepsack", "wearable blanket"],
        isEssential: true,
        suggestedPrice: "$20-40",
        suggestedQuantity: 2,
        unit: ["sleep sack", "sleep sacks"],
        description: "A wearable blanket that keeps baby warm with no loose bedding in the crib. Choose one that isn't weighted.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Baby Monitor",
        key: "baby-monitor",
        isEssential: false,
        suggestedPrice: "$40-350",
        suggestedQuantity: 1,
        description: "Lets you hear or see baby from another room. Keep the camera and its cord at least 3 feet from the crib.",
        sources: [CPSC_SAFER_SPACES],
      },
      {
        name: "Sound Machine",
        key: "sound-machine",
        aliases: ["white noise machine"],
        isEssential: false,
        suggestedPrice: "$20-50",
        suggestedQuantity: 1,
        description: "Steady white noise can help baby sleep. Keep it across the room from the crib, at a low volume.",
        sources: [SOUND_MACHINE_STUDY],
      },
      {
        name: "Changing Pad",
        key: "changing-pad",
        isEssential: true,
        suggestedPrice: "$20-40",
        suggestedQuantity: 1,
        description: "A contoured pad for the top of a dresser. Use its strap and keep a hand on baby.",
      },
      {
        name: "Changing Pad Covers",
        key: "changing-pad-covers",
        isEssential: false,
        suggestedPrice: "$10-20",
        suggestedQuantity: 2,
        unit: ["cover", "covers"],
        description: "Machine-washable covers for the changing pad. Keep a spare for quick swaps.",
      },
      {
        name: "Dresser",
        key: "dresser",
        isEssential: false,
        suggestedPrice: "$150-500",
        suggestedQuantity: 1,
        description:
          "Holds clothes and doubles as a changing table with a pad on top. Anchor it to the wall so it can't tip over.",
        sources: [CPSC_ANCHOR_IT],
      },
      {
        name: "Glider / Rocker",
        key: "glider-rocker",
        aliases: ["rocking chair"],
        isEssential: false,
        suggestedPrice: "$150-800",
        suggestedQuantity: 1,
        description: "Comfortable chair for late-night feedings, rocking, and story time.",
      },
      {
        name: "Nightlight",
        key: "nightlight",
        aliases: ["night light"],
        isEssential: false,
        suggestedPrice: "$10-25",
        suggestedQuantity: 1,
        description: "Dim, warm-toned light for nighttime feedings and diaper changes.",
      },
      {
        name: "Blackout Curtains",
        key: "blackout-curtains",
        isEssential: false,
        suggestedPrice: "$20-50",
        suggestedQuantity: 1,
        description: "Darkens the room for daytime naps. Choose cordless ones, and keep the crib away from window cords.",
        sources: [CPSC_WINDOW_CORDS],
      },
    ],
  },
  {
    name: "Feeding",
    icon: "utensils",
    items: [
      {
        name: "Bottles",
        key: "bottles",
        isEssential: true,
        suggestedPrice: "$6-15",
        suggestedQuantity: 6,
        unit: ["bottle", "bottles"],
        description: "Start with a few small bottles with slow-flow nipples. Babies can be picky, so try one kind before buying more.",
        sources: [CDC_FEEDING_ITEMS],
      },
      {
        name: "Bottle Brush",
        key: "bottle-brush",
        isEssential: true,
        suggestedPrice: "$5-10",
        suggestedQuantity: 1,
        description: "Dedicated brush for cleaning the inside of bottles and nipples.",
        sources: [CDC_FEEDING_ITEMS],
      },
      {
        name: "Burp Cloths",
        key: "burp-cloths",
        isEssential: true,
        suggestedPrice: "$12-25",
        suggestedQuantity: 2,
        unit: ["pack", "packs"],
        description: "Soft cloths for your shoulder during burping. You'll use several a day, so a pack of about 5 goes fast.",
      },
      {
        name: "Bibs",
        key: "bibs",
        formerNames: ["Burp-Cloth Bibs"],
        isEssential: false,
        suggestedPrice: "$10-20",
        suggestedQuantity: 2,
        unit: ["pack", "packs"],
        description: "Soft bibs for drool, then wipeable ones once solid food starts. Take bibs off before sleep.",
      },
      {
        name: "Breast Pump",
        key: "breast-pump",
        isEssential: false,
        suggestedPrice: "$0-500",
        suggestedQuantity: 1,
        description: "For pumping breast milk. Most US health plans must cover one at no cost, so check insurance first.",
        sources: [HEALTHCARE_GOV_PUMPS],
      },
      {
        name: "Nursing Pillow",
        key: "nursing-pillow",
        isEssential: false,
        suggestedPrice: "$25-65",
        suggestedQuantity: 1,
        description: "Props baby up at feeding time. Never use it for sleep or let baby nap on it.",
        sources: [CPSC_NURSING_PILLOWS],
      },
      {
        name: "Nursing Pads",
        key: "nursing-pads",
        isEssential: false,
        suggestedPrice: "$8-15",
        suggestedQuantity: 1,
        unit: ["box", "boxes"],
        description: "Disposable or reusable pads worn inside a bra to absorb leaks.",
      },
      {
        name: "Nipple Cream",
        key: "nipple-cream",
        isEssential: false,
        suggestedPrice: "$8-12",
        suggestedQuantity: 1,
        description: "Lanolin-based or organic balm to soothe and protect during breastfeeding.",
      },
      {
        name: "Breast Milk Storage Bags",
        key: "breast-milk-storage-bags",
        isEssential: false,
        suggestedPrice: "$10-15",
        suggestedQuantity: 1,
        unit: ["box", "boxes"],
        description: "Pre-sterilized bags for storing expressed breast milk in the fridge or freezer.",
      },
      {
        name: "High Chair",
        key: "high-chair",
        aliases: ["highchair"],
        isEssential: true,
        suggestedPrice: "$40-400",
        suggestedQuantity: 1,
        description: "Needed around 6 months, when baby starts solid food. Always use the straps.",
      },
      {
        name: "Bottle Sterilizer",
        key: "bottle-sterilizer",
        formerNames: ["Bottle Drying Rack"],
        isEssential: false,
        suggestedPrice: "$30-180",
        suggestedQuantity: 1,
        description:
          "Steams bottles and pump parts clean. Health officials advise sanitizing feeding items daily for babies under 2 months.",
        sources: [CDC_FEEDING_ITEMS],
      },
      {
        name: "Baby Cups",
        key: "baby-cups",
        aliases: ["sippy cup", "straw cup"],
        formerNames: ["Sippy Cups"],
        isEssential: false,
        suggestedPrice: "$8-15",
        suggestedQuantity: 2,
        unit: ["cup", "cups"],
        description: "A straw cup or open cup for learning to drink, starting around 6 months.",
        sources: [AAP_CUPS],
      },
      {
        name: "Bowls & Spoons",
        key: "bowls-spoons",
        aliases: ["suction bowl", "baby spoon"],
        formerNames: ["Baby Spoons", "Bowl Set"],
        isEssential: false,
        suggestedPrice: "$15-30",
        suggestedQuantity: 1,
        unit: ["set", "sets"],
        description: "Suction bowls and soft-tipped spoons for starting solid food around 6 months.",
      },
    ],
  },
  {
    name: "Diapering",
    icon: "package",
    items: [
      {
        name: "Diapers — Newborn",
        key: "diapers-newborn",
        isEssential: true,
        suggestedPrice: "$30-45",
        suggestedQuantity: 2,
        unit: ["box", "boxes"],
        description: "Newborn size fits for only a few weeks, and bigger babies may skip it. A box holds about 80 to 140 diapers.",
        sources: [BABYLIST_DIAPERS],
      },
      {
        name: "Diapers — Size 1",
        key: "diapers-size-1",
        isEssential: true,
        suggestedPrice: "$30-50",
        suggestedQuantity: 3,
        unit: ["box", "boxes"],
        description: "Most babies wear size 1 (8–14 lbs) for the first few months. A box holds about 100 to 160.",
        sources: [BABYLIST_DIAPERS],
      },
      {
        name: "Diapers — Size 2",
        key: "diapers-size-2",
        isEssential: true,
        suggestedPrice: "$30-50",
        suggestedQuantity: 3,
        unit: ["box", "boxes"],
        description: "Size 2 fits about 12–18 lbs and lasts longer than the smaller sizes.",
        sources: [BABYLIST_DIAPERS],
      },
      {
        name: "Wipes",
        key: "wipes",
        isEssential: true,
        suggestedPrice: "$20-35",
        suggestedQuantity: 3,
        unit: ["box", "boxes"],
        description: "Unscented wipes for every change. A bulk box holds about 500 to 800.",
      },
      {
        name: "Diaper Rash Cream",
        key: "diaper-rash-cream",
        isEssential: true,
        suggestedPrice: "$8-12",
        suggestedQuantity: 1,
        description: "Zinc oxide-based cream to treat and prevent diaper rash.",
      },
      {
        name: "Diaper Pail",
        key: "diaper-pail",
        isEssential: true,
        suggestedPrice: "$30-90",
        suggestedQuantity: 1,
        description: "Odor-locking trash can designed specifically for dirty diapers.",
      },
      {
        name: "Diaper Bag",
        key: "diaper-bag",
        isEssential: true,
        suggestedPrice: "$30-200",
        suggestedQuantity: 1,
        description: "Spacious bag with compartments for diapers, wipes, bottles, and a change of clothes.",
      },
      {
        name: "Portable Changing Pad",
        key: "portable-changing-pad",
        isEssential: false,
        suggestedPrice: "$10-25",
        suggestedQuantity: 1,
        description: "Foldable, wipeable pad for diaper changes on the go.",
      },
    ],
  },
  {
    name: "Gear & Travel",
    icon: "car",
    items: [
      {
        name: "Infant Car Seat",
        key: "infant-car-seat",
        isEssential: true,
        suggestedPrice: "$150-500",
        suggestedQuantity: 1,
        description:
          "A rear-facing seat for every car ride, starting with the trip home. Buy new, since a used seat may be expired or have been in a crash.",
        sources: [AAP_CAR_SEATS, NHTSA_CAR_SEATS],
      },
      {
        name: "Convertible Car Seat",
        key: "convertible-car-seat",
        isEssential: false,
        suggestedPrice: "$150-500",
        suggestedQuantity: 1,
        description:
          "The next seat after the infant seat, which most babies outgrow in their first year. Keep it rear-facing as long as the seat allows.",
        sources: [AAP_CAR_SEATS, NHTSA_CAR_SEATS],
      },
      {
        name: "Full-Size Stroller",
        key: "full-size-stroller",
        aliases: ["stroller"],
        isEssential: true,
        suggestedPrice: "$200-1,200",
        suggestedQuantity: 1,
        description: "Everyday stroller with good suspension, storage, and recline for naps on the go.",
      },
      {
        name: "Baby Carrier / Wrap",
        key: "baby-carrier-wrap",
        isEssential: false,
        suggestedPrice: "$30-200",
        suggestedQuantity: 1,
        description: "Carries baby hands-free on walks and errands. Keep baby's face in view and chin off their chest.",
      },
      {
        name: "Play Yard / Travel Crib",
        key: "play-yard",
        aliases: ["pack n play", "playard"],
        formerNames: ["Travel Crib / Pack 'n Play"],
        isEssential: false,
        suggestedPrice: "$80-300",
        suggestedQuantity: 1,
        description: "A portable bed for travel or a second room. Use only the mattress that came with it, with no extra padding.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Baby Swing",
        key: "baby-swing",
        isEssential: false,
        suggestedPrice: "$80-250",
        suggestedQuantity: 1,
        description: "Gently rocks a fussy baby during awake time. If baby falls asleep, move them to their crib or bassinet.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Bouncer",
        key: "bouncer",
        isEssential: false,
        suggestedPrice: "$30-250",
        suggestedQuantity: 1,
        description: "A low seat that moves with baby during supervised awake time. Keep it on the floor, and don't use it for sleep.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Stroller Organizer",
        key: "stroller-organizer",
        isEssential: false,
        suggestedPrice: "$15-30",
        suggestedQuantity: 1,
        description: "Clip-on caddy that holds your phone, keys, water bottle, and snacks.",
      },
      {
        name: "Car Seat Camera / Mirror",
        key: "car-seat-camera-mirror",
        aliases: ["car seat mirror", "baby car mirror", "baby car camera"],
        formerNames: ["Car Seat Mirror"],
        isEssential: false,
        suggestedPrice: "$15-150",
        suggestedQuantity: 1,
        description:
          "Lets the driver see a rear-facing baby. Mount it firmly on the headrest, not the car seat, and choose a light one that can't come loose.",
        sources: [AAP_CAR_SEATS],
      },
    ],
  },
  {
    name: "Bath",
    icon: "bath",
    items: [
      {
        name: "Baby Bathtub",
        key: "baby-bathtub",
        isEssential: true,
        suggestedPrice: "$15-50",
        suggestedQuantity: 1,
        description: "Holds baby securely in a few inches of water. Stay within arm's reach for the whole bath.",
      },
      {
        name: "Hooded Towels",
        key: "hooded-towels",
        isEssential: true,
        suggestedPrice: "$10-20",
        suggestedQuantity: 3,
        unit: ["towel", "towels"],
        description: "Soft, absorbent towels with a hood to keep baby's head warm after the bath.",
      },
      {
        name: "Washcloths",
        key: "washcloths",
        isEssential: false,
        suggestedPrice: "$8-15",
        suggestedQuantity: 1,
        unit: ["pack", "packs"],
        description: "Small, gentle cloths for washing baby's face, body, and cleaning up messes.",
      },
      {
        name: "Baby Shampoo / Wash",
        key: "baby-shampoo-wash",
        isEssential: false,
        suggestedPrice: "$8-12",
        suggestedQuantity: 1,
        description: "Tear-free, gentle cleanser formulated for sensitive baby skin.",
      },
      {
        name: "Baby Lotion",
        key: "baby-lotion",
        isEssential: false,
        suggestedPrice: "$6-10",
        suggestedQuantity: 1,
        description: "Fragrance-free moisturizer to keep baby's skin soft and hydrated after baths.",
      },
    ],
  },
  {
    name: "Clothing",
    icon: "shirt",
    items: [
      {
        name: "Bodysuits (0-3m)",
        key: "bodysuits-0-3m",
        aliases: ["onesies (0-3m)"],
        formerNames: ["Onesies (0-3m)"],
        isEssential: true,
        suggestedPrice: "$15-30",
        suggestedQuantity: 2,
        unit: ["pack", "packs"],
        description: "Snap bodysuits are what newborns wear most days.",
        sources: [NHS_WHAT_YOU_NEED],
      },
      {
        name: "Sleepers / Footies (0-3m)",
        key: "sleepers-footies-0-3m",
        isEssential: true,
        suggestedPrice: "$10-20",
        suggestedQuantity: 6,
        unit: ["sleeper", "sleepers"],
        description: "Zip-up or snap footed pajamas for easy nighttime changes.",
        sources: [NHS_WHAT_YOU_NEED],
      },
      {
        name: "Pants (0-3m)",
        key: "pants-0-3m",
        isEssential: false,
        suggestedPrice: "$12-25",
        suggestedQuantity: 1,
        unit: ["pack", "packs"],
        description: "Soft, stretchy pants to pair with bodysuits. Elastic waistbands are easiest.",
      },
      {
        name: "Socks",
        key: "socks",
        formerNames: ["Socks (0-3m)", "Socks (3-6m)"],
        isEssential: true,
        suggestedPrice: "$8-15",
        suggestedQuantity: 1,
        unit: ["pack", "packs"],
        description: "Keeps feet warm with bodysuits. Socks slip off often, so a multi-pack helps.",
      },
      {
        name: "Hats",
        key: "hats",
        formerNames: ["Hats (Newborn)"],
        isEssential: false,
        suggestedPrice: "$5-10",
        suggestedQuantity: 2,
        unit: ["hat", "hats"],
        description: "A soft hat for cool days outside. Don't put a hat on baby indoors or for sleep, since it can cause overheating.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Scratch Mittens",
        key: "scratch-mittens",
        isEssential: false,
        suggestedPrice: "$5-8",
        suggestedQuantity: 3,
        unit: ["pair", "pairs"],
        description: "Prevent newborns from scratching their face with sharp little nails.",
      },
      {
        name: "Going-Home Outfit",
        key: "going-home-outfit",
        formerNames: ["Dress-Up Outfit"],
        isEssential: false,
        suggestedPrice: "$15-30",
        suggestedQuantity: 1,
        description: "A special outfit for the trip home or for photos. Pick something thin enough to fit under car seat straps.",
        sources: [AAP_CAR_SEATS],
      },
      {
        name: "Bodysuits (3-6m)",
        key: "bodysuits-3-6m",
        aliases: ["onesies (3-6m)"],
        formerNames: ["Onesies (3-6m)"],
        isEssential: false,
        suggestedPrice: "$15-30",
        suggestedQuantity: 2,
        unit: ["pack", "packs"],
        description: "Babies outgrow the first size fast, so the next size is always useful.",
      },
      {
        name: "Sleepers / Footies (3-6m)",
        key: "sleepers-footies-3-6m",
        isEssential: false,
        suggestedPrice: "$10-20",
        suggestedQuantity: 4,
        unit: ["sleeper", "sleepers"],
        description: "Footed pajamas in the next size up for continued nighttime comfort.",
      },
      {
        name: "Bodysuits (6-9m)",
        key: "bodysuits-6-9m",
        aliases: ["onesies (6-9m)"],
        formerNames: ["Onesies (6-9m)"],
        isEssential: false,
        suggestedPrice: "$15-30",
        suggestedQuantity: 1,
        unit: ["pack", "packs"],
        description: "Bodysuits for when baby is bigger and more active.",
      },
      {
        name: "Jacket / Sweater",
        key: "jacket-sweater",
        isEssential: false,
        suggestedPrice: "$15-30",
        suggestedQuantity: 2,
        description: "A light layer for cool days. Take thick jackets off before buckling into the car seat.",
        sources: [AAP_CAR_SEATS],
      },
      {
        name: "Snowsuit / Bunting",
        key: "snowsuit-bunting",
        isEssential: false,
        suggestedPrice: "$20-40",
        suggestedQuantity: 1,
        description: "Keeps baby warm outside in cold weather. Take it off in the car seat and lay a blanket over the buckled straps.",
        sources: [AAP_CAR_SEATS],
      },
      {
        name: "Sun Hat",
        key: "sun-hat",
        isEssential: false,
        suggestedPrice: "$8-15",
        suggestedQuantity: 1,
        description: "A wide-brim hat with a chin strap. Shade and clothing are the main sun protection for babies under 6 months.",
        sources: [AAP_SUN],
      },
    ],
  },
  {
    name: "Health & Safety",
    icon: "heart-pulse",
    items: [
      {
        name: "Thermometer",
        key: "thermometer",
        isEssential: true,
        suggestedPrice: "$10-40",
        suggestedQuantity: 1,
        description:
          "A digital thermometer that can take a rectal reading, the most accurate way for babies under 3 months. A forehead one is a handy extra.",
        sources: [AAP_TEMPERATURE],
      },
      {
        name: "Nasal Aspirator",
        key: "nasal-aspirator",
        isEssential: true,
        suggestedPrice: "$10-30",
        suggestedQuantity: 1,
        description: "Clears a stuffy nose so baby can feed and sleep. Use it with saline drops.",
      },
      {
        name: "Nail Clipper Set",
        key: "nail-clipper-set",
        isEssential: true,
        suggestedPrice: "$5-10",
        suggestedQuantity: 1,
        description: "Baby-sized clippers, file, and scissors for tiny, fast-growing nails.",
      },
      {
        name: "Humidifier",
        key: "humidifier",
        isEssential: false,
        suggestedPrice: "$25-60",
        suggestedQuantity: 1,
        description: "Adds moisture to dry air. Choose cool mist, not warm, and clean it often.",
        sources: [MAYO_HUMIDIFIERS],
      },
      {
        name: "Pacifiers",
        key: "pacifiers",
        isEssential: true,
        suggestedPrice: "$5-10",
        suggestedQuantity: 4,
        unit: ["pacifier", "pacifiers"],
        description: "Offering a pacifier at sleep time lowers the risk of SIDS. For breastfed babies, wait until feeding is going well.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Teethers",
        key: "teethers",
        aliases: ["teething toy"],
        formerNames: ["Teething Toys"],
        isEssential: false,
        suggestedPrice: "$5-15",
        suggestedQuantity: 2,
        unit: ["teether", "teethers"],
        description:
          "Solid rubber or silicone teethers soothe sore gums. Chill them in the fridge, not the freezer, and skip teething necklaces.",
        sources: [FDA_TEETHING],
      },
      {
        name: "Fragrance-Free Detergent",
        key: "fragrance-free-detergent",
        aliases: ["laundry detergent", "baby detergent"],
        formerNames: ["Baby-Safe Detergent"],
        isEssential: false,
        suggestedPrice: "$10-20",
        suggestedQuantity: 1,
        description: "Gentle laundry detergent for baby's clothes and bedding. It doesn't need to be a special baby brand.",
        sources: [NHS_WHAT_YOU_NEED],
      },
      {
        name: "First Aid Kit",
        key: "first-aid-kit",
        isEssential: false,
        suggestedPrice: "$15-25",
        suggestedQuantity: 1,
        description: "Kit with infant-safe essentials: saline drops, medicine dropper, bandages, and more.",
      },
      {
        name: "Babyproofing Kit",
        key: "babyproofing-kit",
        aliases: ["outlet covers", "cabinet locks", "furniture anchors"],
        isEssential: false,
        suggestedPrice: "$20-60",
        suggestedQuantity: 1,
        description:
          "Outlet covers, cabinet latches and furniture anchors for when baby starts to crawl. Anchoring dressers and TVs stops them tipping over.",
        sources: [CPSC_ANCHOR_IT],
      },
      {
        name: "Baby Gates",
        key: "baby-gates",
        aliases: ["safety gate"],
        isEssential: false,
        suggestedPrice: "$30-100",
        suggestedQuantity: 2,
        unit: ["gate", "gates"],
        description: "Block stairs and doorways once baby crawls. Use a gate screwed to the wall at the top of stairs.",
        sources: [NATIONWIDE_GATES],
      },
    ],
  },
  {
    name: "Toys & Books",
    icon: "book-open",
    items: [
      {
        name: "Board Books",
        key: "board-books",
        isEssential: false,
        suggestedPrice: "$6-12",
        suggestedQuantity: 10,
        unit: ["book", "books"],
        description: "Sturdy, chewable books with bold images. Great for building an early library.",
      },
      {
        name: "Rattles",
        key: "rattles",
        isEssential: false,
        suggestedPrice: "$5-10",
        suggestedQuantity: 2,
        unit: ["rattle", "rattles"],
        description: "Lightweight rattles that help develop baby's grip and auditory awareness.",
      },
      {
        name: "High-Contrast Cards",
        key: "high-contrast-cards",
        isEssential: false,
        suggestedPrice: "$8-12",
        suggestedQuantity: 1,
        description: "Black-and-white patterned cards that stimulate a newborn's developing vision.",
      },
      {
        name: "Soft Plush Toys",
        key: "soft-plush-toys",
        isEssential: false,
        suggestedPrice: "$10-20",
        suggestedQuantity: 2,
        description: "Cuddly toys for awake time. Keep them out of the crib for the first year.",
        sources: [AAP_SAFE_SLEEP],
      },
      {
        name: "Play Gym",
        key: "play-gym",
        aliases: ["activity gym", "play mat"],
        formerNames: ["Play Mat / Activity Gym"],
        isEssential: false,
        suggestedPrice: "$35-150",
        suggestedQuantity: 1,
        description: "A padded mat with hanging toys for tummy time and reaching.",
      },
      {
        name: "Stacking Toys",
        key: "stacking-toys",
        isEssential: false,
        suggestedPrice: "$10-15",
        suggestedQuantity: 1,
        description: "Colorful rings or cups that teach cause-and-effect and fine motor skills.",
      },
    ],
  },
  {
    name: "Maternity & Postpartum",
    icon: "heart",
    items: [
      {
        name: "Postpartum Recovery Kit",
        key: "postpartum-recovery-kit",
        isEssential: false,
        suggestedPrice: "$20-40",
        suggestedQuantity: 1,
        description: "All-in-one kit with pads, witch hazel, and soothing sprays for postpartum healing.",
      },
      {
        name: "Peri Bottle",
        key: "peri-bottle",
        isEssential: false,
        suggestedPrice: "$8-15",
        suggestedQuantity: 1,
        description: "Angled squeeze bottle for gentle cleansing during postpartum recovery.",
      },
      {
        name: "Postpartum Underwear",
        key: "postpartum-underwear",
        isEssential: false,
        suggestedPrice: "$15-25",
        suggestedQuantity: 2,
        unit: ["pack", "packs"],
        description: "High-waisted, disposable or washable underwear designed for postpartum comfort.",
      },
      {
        name: "Nursing Bras",
        key: "nursing-bras",
        isEssential: false,
        suggestedPrice: "$20-45",
        suggestedQuantity: 3,
        unit: ["bra", "bras"],
        description: "Clip-down bras for easy feeding. Get fitted late in pregnancy, since your size will change.",
      },
      {
        name: "Pumping Bra",
        key: "pumping-bra",
        isEssential: false,
        suggestedPrice: "$20-45",
        suggestedQuantity: 1,
        description: "Holds the pump in place so your hands are free while pumping.",
      },
    ],
  },
  {
    name: "Gifts & Extras",
    icon: "gift",
    items: [
      {
        name: "Diaper Fund",
        key: "diaper-fund",
        fund: true,
        isEssential: false,
        suggestedPrice: "Any amount",
        suggestedQuantity: 1,
        description: "Money toward the never-ending diaper supply.",
      },
      {
        name: "Postpartum Help Fund",
        key: "postpartum-help-fund",
        fund: true,
        isEssential: false,
        suggestedPrice: "Any amount",
        suggestedQuantity: 1,
        description: "Money toward meals, cleaning or extra help in the first weeks home.",
      },
      {
        name: "College Fund",
        key: "college-fund",
        fund: true,
        isEssential: false,
        suggestedPrice: "Any amount",
        suggestedQuantity: 1,
        description: "Contribution to a 529 plan or savings account for baby's future education.",
      },
      {
        name: "Baby Memory Book",
        key: "baby-memory-book",
        isEssential: false,
        suggestedPrice: "$15-35",
        suggestedQuantity: 1,
        description: "Journal or scrapbook for recording milestones, firsts, and memories.",
      },
      {
        name: "Milestone Blanket / Cards",
        key: "milestone-blanket-cards",
        isEssential: false,
        suggestedPrice: "$15-30",
        suggestedQuantity: 1,
        description: "Monthly milestone markers for tracking growth and taking adorable photos.",
      },
    ],
  },
];

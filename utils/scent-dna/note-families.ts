export const NOTE_FAMILY_IDS = [
  "florals",
  "woods",
  "orientals",
  "citrus",
  "aquatics",
  "gourmands",
] as const

export type NoteFamilyId = (typeof NOTE_FAMILY_IDS)[number]

/** Keyword hints per family (normalized note names are matched with `includes`). */
const FAMILY_KEYWORDS: Record<NoteFamilyId, readonly string[]> = {
  citrus: [
    "bergamot",
    "lemon",
    "lime",
    "orange",
    "grapefruit",
    "mandarin",
    "yuzu",
    "citrus",
    "petitgrain",
    "tangerine",
    "pomelo",
    "kumquat",
    "citron",
  ],
  aquatics: [
    "aquatic",
    "marine",
    "ozonic",
    "sea salt",
    "ocean",
    "calone",
    "rain",
    "watery",
    "water",
  ],
  gourmands: [
    "vanilla",
    "caramel",
    "chocolate",
    "honey",
    "praline",
    "tonka",
    "almond",
    "coffee",
    "cocoa",
    "marshmallow",
    "gourmand",
    "toffee",
    "maple",
    "licorice",
    "whipped cream",
    "sugar",
    "pistachio",
  ],
  florals: [
    "rose",
    "jasmine",
    "lily",
    "violet",
    "iris",
    "orchid",
    "peony",
    "ylang",
    "tuberose",
    "magnolia",
    "floral",
    "flower",
    "geranium",
    "freesia",
    "gardenia",
    "osmanthus",
    "heliotrope",
    "carnation",
    "mimosa",
    "champaca",
    "frangipani",
    "neroli",
  ],
  woods: [
    "cedar",
    "sandalwood",
    "vetiver",
    "agarwood",
    "pine",
    "cypress",
    "guaiac",
    "palo santo",
    "cashmere wood",
    "birch",
    "oak",
    "teak",
    "mahogany",
    "ebony",
    "fir",
    "spruce",
    "wood",
    "oud",
  ],
  orientals: [
    "amber",
    "incense",
    "frankincense",
    "myrrh",
    "resin",
    "benzoin",
    "labdanum",
    "patchouli",
    "spice",
    "cinnamon",
    "cardamom",
    "clove",
    "pepper",
    "saffron",
    "leather",
    "musk",
    "tobacco",
    "opoponax",
    "styrax",
    "coumarin",
    "oriental",
  ],
}

/** More specific families first so broad tokens (e.g. wood, musk) resolve sensibly. */
const FAMILY_MATCH_ORDER: NoteFamilyId[] = [
  "citrus",
  "aquatics",
  "gourmands",
  "florals",
  "woods",
  "orientals",
]

export const classifyNoteNameToFamily = (
  noteName: string
): NoteFamilyId | null => {
  const normalized = noteName.trim().toLowerCase()
  if (!normalized) return null

  for (const family of FAMILY_MATCH_ORDER) {
    if (
      FAMILY_KEYWORDS[family].some((keyword) => normalized.includes(keyword))
    ) {
      return family
    }
  }
  return null
}

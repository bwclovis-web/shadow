/**
 * Known single- and multi-word materials for rule-based alias derivation.
 * Sourced from scraper volatility buckets; longest phrases first for tail matching.
 */

const OPEN_MATERIALS = [
  "bergamot",
  "lemon",
  "lime",
  "orange",
  "grapefruit",
  "yuzu",
  "neroli",
  "petitgrain",
  "mandarin",
  "tangerine",
  "clementine",
  "citron",
  "mint",
  "basil",
  "green tea",
  "eucalyptus",
]

const HEART_MATERIALS = [
  "rose",
  "jasmine",
  "iris",
  "orris",
  "violet",
  "violet leaf",
  "peony",
  "lily",
  "geranium",
  "tuberose",
  "ylang ylang",
  "osmanthus",
  "magnolia",
  "orange blossom",
  "white flowers",
  "peach",
  "apple",
  "plum",
  "apricot",
  "pear",
  "raspberry",
  "black currant",
  "blackcurrant",
  "strawberry",
  "coffee",
  "cinnamon",
  "cardamom",
  "clove",
  "nutmeg",
  "ginger",
  "pink pepper",
  "black pepper",
  "heliotrope",
  "mimosa",
  "saffron",
]

const BASE_MATERIALS = [
  "sandalwood",
  "cedarwood",
  "cedar",
  "vetiver",
  "oud",
  "agarwood",
  "guaiac wood",
  "guaiac",
  "musk",
  "white musk",
  "benzoin",
  "labdanum",
  "myrrh",
  "frankincense",
  "incense",
  "amber",
  "ambergris",
  "tonka bean",
  "vanilla",
  "patchouli",
  "tobacco",
  "leather",
  "honey",
  "caramel",
  "cocoa",
  "chocolate",
  "tonka",
  "oakmoss",
  "oak moss",
  "benzoin",
  "styrax",
  "peru balsam",
]

/** Multi-word notes that must not be auto-aliased by rules (manual review only). */
export const PROTECTED_MULTI_WORD_NOTES = new Set([
  "white birch wood",
  "ancient white oak",
  "black tea",
  "green tea",
  "white tea",
  "white musk",
  "black musk",
  "red musk",
  "white amber",
  "black amber",
  "white woods",
  "black pepper",
  "white pepper",
  "pink pepper",
  "salt water taffy",
  "madagascar vanilla beans",
  "australian blue peppercorn",
  "italian white clove",
  "spanish tonka bean",
])

/**
 * Pairs where the longer token must not map to the shorter (word-boundary safe).
 */
export const MATERIAL_BLOCKLIST: ReadonlyArray<[string, string]> = [
  ["ambergris", "amber"],
  ["white musk", "musk"],
  ["black musk", "musk"],
  ["soft musk", "musk"],
  ["oak moss", "moss"],
  ["oakmoss", "moss"],
  ["tree moss", "moss"],
]

export const ORIGIN_PREFIXES = [
  "east indian",
  "west indian",
  "italian",
  "sicilian",
  "calabrian",
  "indian",
  "indonesian",
  "bulgarian",
  "turkish",
  "madagascar",
  "tahitian",
  "bourbon",
  "egyptian",
  "tunisian",
  "australian",
  "brazilian",
  "oman",
  "spanish",
  "french",
  "moroccan",
  "chinese",
  "japanese",
  "korean",
  "haitian",
  "peruvian",
  "mexican",
  "californian",
  "himalayan",
  "ceylon",
  "sri lankan",
  "vietnamese",
  "thai",
  "cambodian",
  "laotian",
  "mysore",
  "egyptian",
] as const

const MARKETING_PREFIXES = [
  "golden",
  "honeyed",
  "warm",
  "soft",
  "zesty",
  "sparkling",
  "aged",
  "aged 8-year",
  "8-year aged",
  "crushed",
  "smoked",
  "powdery",
  "creamy",
  "salted",
  "balsamic",
] as const

const allMaterials = [...OPEN_MATERIALS, ...HEART_MATERIALS, ...BASE_MATERIALS]

/** Longest first for greedy tail / full-name matching */
export const KNOWN_MATERIALS_SORTED: string[] = [
  ...new Set(allMaterials.map((m) => m.toLowerCase())),
].sort((a, b) => b.length - a.length)

export const KNOWN_MATERIALS_SET = new Set(KNOWN_MATERIALS_SORTED)

export const MARKETING_PREFIXES_SORTED = [...MARKETING_PREFIXES].sort(
  (a, b) => b.length - a.length
)

export const ORIGIN_PREFIXES_SORTED = [...ORIGIN_PREFIXES].sort(
  (a, b) => b.length - a.length
)

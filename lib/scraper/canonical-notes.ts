/**
 * Deterministic perfume note canonicalization and flat-list → pyramid hints.
 * Used by the scraper LangGraph pipeline before/after LLM steps.
 */

// ---------------------------------------------------------------------------
// Canonical spelling / language → English (longest multi-word keys first)
// ---------------------------------------------------------------------------

const NOTE_CANONICAL_PHRASES: [string, string][] = [
  ["bois de santal", "sandalwood"],
  ["fève tonka", "tonka bean"],
  ["feve tonka", "tonka bean"],
  ["lily of the valley", "lily of the valley"],
  ["ylang ylang", "ylang ylang"],
  ["white musk", "white musk"],
  ["black musk", "black musk"],
  ["soft musk", "soft musk"],
  ["skin musk", "skin musk"],
  ["solar musk", "solar musk"],
  ["white flowers", "white flowers"],
  ["white florals", "white flowers"],
  ["white flower", "white flowers"],
  ["powdery woods", "powdery woods"],
  ["cashmere woods", "cashmere woods"],
  ["cashmere wood", "cashmere wood"],
  ["vanilla cream", "vanilla cream"],
  ["whipped cream", "whipped cream"],
  ["marshmallow fluff", "marshmallow fluff"],
  ["orris butter", "orris butter"],
  ["orris root", "orris root"],
  ["iris butter", "iris butter"],
  ["magnolia petals", "magnolia"],
  ["jasmine petals", "jasmine"],
  ["rose petals", "rose"],
  ["granny smith apple", "granny smith apple"],
  ["pink pepper", "pink pepper"],
  ["black pepper", "black pepper"],
  ["black currant", "black currant"],
  ["red apple", "red apple"],
  ["green apple", "green apple"],
  ["apple blossom", "apple blossom"],
  ["bulgarian rose", "bulgarian rose"],
  ["peru balsam", "peru balsam"],
  ["madagascar vanilla", "madagascar vanilla"],
  ["tahitian vanilla", "tahitian vanilla"],
  ["bourbon vanilla", "bourbon vanilla"],
  ["vanilla absolute", "vanilla absolute"],
  ["tonka absolute", "tonka absolute"],
  ["benzoin resinoid", "benzoin resinoid"],
  ["legno di sandalo", "sandalwood"],
  ["lemn de santal", "sandalwood"],
]

const NOTE_CANONICAL_TOKENS: Record<string, string> = {
  vetivert: "vetiver",
  vetiver: "vetiver",
  oudh: "oud",
  ylangylang: "ylang ylang",
  "ylang-ylang": "ylang ylang",
  bergamotte: "bergamot",
  chamomille: "chamomile",
  patchoulli: "patchouli",
  musks: "musk",
  resins: "resin",
  woods: "wood",
  vanille: "vanilla",
  musc: "musk",
  ambre: "amber",
  encens: "incense",
  cedre: "cedarwood",
  cèdre: "cedarwood",
  tabac: "tobacco",
  santal: "sandalwood",
  sandalo: "sandalwood",
  muschio: "musk",
  gelsomino: "jasmine",
  rosa: "rose",
  roos: "rose",
  muskus: "musk",
  sandelhout: "sandalwood",
  moschus: "musk",
  sandelholz: "sandalwood",
  tabak: "tobacco",
  ambar: "amber",
  almiscar: "musk",
  almíscar: "musk",
  âmbar: "amber",
  sândalo: "sandalwood",
  trandafir: "rose",
  mosc: "musk",
  vanilie: "vanilla",
  iasomie: "jasmine",
  ámbar: "amber",
}

/** Substrings that keep a hyphenated note from being treated as prose junk. */
export const HYPHEN_PROTECTED_NOTE_FRAGMENTS = [
  "ylang-ylang",
  "lily-of-the-valley",
  "tonka-bean",
  "black-currant",
  "pink-pepper",
  "white-musk",
  "white-flowers",
  "peru-balsam",
]

// ---------------------------------------------------------------------------
// Volatility buckets (lowercase tokens; multi-word handled via includes check)
// ---------------------------------------------------------------------------

const OPEN_VOLATILITY = new Set<string>([
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
  "aldehyde",
  "aldehydes",
  "ozonic",
  "aquatic",
  "aldehydic",
])

const HEART_VOLATILITY = new Set<string>([
  "rose",
  "jasmine",
  "iris",
  "orris",
  "violet",
  "violet leaf",
  "peony",
  "lily",
  "casablanca lily",
  "geranium",
  "tuberose",
  "ylang ylang",
  "osmanthus",
  "magnolia",
  "orange blossom",
  "apple blossom",
  "cherry blossom",
  "white flowers",
  "white florals",
  "red apple",
  "green apple",
  "granny smith apple",
  "pitahaya",
  "orris butter",
  "orris root",
  "iris butter",
  "whipped cream",
  "vanilla cream",
  "peach",
  "apple",
  "plum",
  "apricot",
  "pear",
  "raspberry",
  "blackcurrant",
  "black currant",
  "strawberry",
  "banana",
  "melon",
  "guava",
  "watermelon",
  "cinnamon",
  "cardamom",
  "clove",
  "nutmeg",
  "ginger",
  "pink pepper",
  "black pepper",
  "mahonial",
  "carrot",
  "coffee",
  "immortelle",
  "heliotrope",
])

const BASE_VOLATILITY = new Set<string>([
  "sandalwood",
  "mysore sandalwood",
  "cedarwood",
  "cedar",
  "vetiver",
  "oud",
  "guaiac wood",
  "guaiac",
  "rosewood",
  "teak",
  "musk",
  "white musk",
  "black musk",
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
  "castoreum",
  "hay",
  "beeswax",
  "honey",
  "caramel",
  "cocoa",
  "chocolate",
  "suede",
  "styrax",
  "peru balsam",
  "balsam",
  "salted amber",
  "cashmere woods",
  "cashmere",
  "sandal",
  "soft musk",
  "skin musk",
  "solar musk",
  "powdery woods",
  "cashmere woods",
  "cashmere wood",
  "praline",
  "marshmallow",
  "marshmallow fluff",
  "tonka absolute",
  "benzoin resinoid",
  "golden patchouli",
  "oak moss",
  "oakmoss",
])

const classifyVolatilityToken = (token: string): "open" | "heart" | "base" => {
  const t = token.trim().toLowerCase()
  if (!t) return "heart"
  if (OPEN_VOLATILITY.has(t)) return "open"
  if (BASE_VOLATILITY.has(t)) return "base"
  if (HEART_VOLATILITY.has(t)) return "heart"
  for (const phrase of HEART_VOLATILITY) {
    if (phrase.includes(" ") && t.includes(phrase)) return "heart"
  }
  for (const phrase of BASE_VOLATILITY) {
    if (phrase.includes(" ") && t.includes(phrase)) return "base"
  }
  for (const phrase of OPEN_VOLATILITY) {
    if (phrase.includes(" ") && t.includes(phrase)) return "open"
  }
  return "heart"
}

/** Map a single note string to canonical English (lowercase). */
export const canonicalizeNote = (raw: string): string => {
  let s = raw.trim().toLowerCase().replace(/\s+/g, " ")
  if (!s) return s
  for (const [from, to] of NOTE_CANONICAL_PHRASES) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    if (re.test(s)) s = s.replace(re, to).replace(/\s+/g, " ").trim()
  }
  const words = s.split(/\s+/).filter(Boolean)
  const mapped = words.map(w => NOTE_CANONICAL_TOKENS[w] ?? w)
  return mapped.join(" ").replace(/\s+/g, " ").trim()
}

export const canonicalizeNoteLayers = (notes: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): { openNotes: string[]; heartNotes: string[]; baseNotes: string[] } => ({
  openNotes: notes.openNotes.map(canonicalizeNote).filter(Boolean),
  heartNotes: notes.heartNotes.map(canonicalizeNote).filter(Boolean),
  baseNotes: notes.baseNotes.map(canonicalizeNote).filter(Boolean),
})

/**
 * When all notes landed in openNotes (flat merchant list), spread by typical volatility.
 * Unknown multi-word notes go to heart (safe default).
 */
export const assignVolatilityLayersFromFlatOpen = (flatOpen: string[]): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} => {
  const open: string[] = []
  const heart: string[] = []
  const base: string[] = []
  for (const n of flatOpen) {
    const c = canonicalizeNote(n)
    if (!c) continue
    const layer = classifyVolatilityToken(c)
    if (layer === "open") open.push(c)
    else if (layer === "base") base.push(c)
    else heart.push(c)
  }
  const uniq = (arr: string[]) => [...new Set(arr.map(x => x.trim().toLowerCase()))].filter(Boolean)
  return {
    openNotes: uniq(open),
    heartNotes: uniq(heart),
    baseNotes: uniq(base),
  }
}

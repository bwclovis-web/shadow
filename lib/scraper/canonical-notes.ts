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
  ["tree moss", "tree moss"],
  ["salt water", "salt water"],
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

/**
 * Words that signal a multi-token merchant phrase (e.g. "inky violet air"), not a run of
 * single-word materials jammed together by a bad scrape or LLM merge.
 */
const _SPACE_LIST_PROSE_MODIFIERS = new Set([
  "soft",
  "powdery",
  "inky",
  "golden",
  "airy",
  "delicate",
  "warm",
  "cool",
  "sweet",
  "rich",
  "deep",
  "bright",
  "smoky",
  "creamy",
  "juicy",
  "lush",
  "silken",
  "velvety",
  "lingering",
  "honeyed",
  "steaming",
  "mist",
  "lift",
  "glow",
  "warmth",
  "air",
  "smoke",
  "petals",
  "structure",
  "radiance",
  "sparkle",
])

let singleWordMaterialsCache: Set<string> | null = null

const EXTRA_SINGLE_WORD_MATERIALS = [
  "litchi",
  "litchee",
  "lychee",
  "passionfruit",
  "passion fruit",
  "orchid",
  "hibiscus",
  "fig",
  "nectar",
  "saffron",
  "oudh",
  "milk",
  "mimosa",
  "brown",
  "blossom",
  "coconut",
  "almond",
  "ambroxan",
  "hedione",
  "mahogany",
  "cotton",
  "anise",
  "leather",
  "vetiver",
  "ginger",
  "sugar",
  "cane",
  "rum",
  "caviar",
]

/** Filler words between materials in bad space-joined merchant blobs (skip during greedy split). */
const NOTE_BLOB_FILLER_WORDS = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "with",
  "then",
  "accord",
  "notes",
  "note",
])

/** Common indie-house multi-word note phrases (Andromeda's Moon, etc.). */
const MERCHANT_MULTI_WORD_PHRASES: string[] = [
  "lingering woody glow",
  "amber warmth",
  "inky violet air",
  "aromatic lift",
  "incense smoke",
  "soft powdery woods",
  "soft powdery wood",
  "powdery woods",
  "almond blossom",
  "vanilla orchid",
  "honeyed sweetness",
  "lavender mist",
  "steaming black tea",
  "balsamic amber",
  "golden amber",
  "white musk",
  "peach nectar",
  "vanilla bean",
  "fig milk",
  "candied almond",
  "cotton candy",
  "natural musk",
  "marshmallow accord",
  "orange blossom",
  "tonka bean",
  "sugar cane",
  "brown sugar",
  "coffee-cream",
  "coffee cream",
  "australian sandalwood",
  "creamy rice",
  "steamed milk",
  "soft incense",
  "forest fruits",
  "powdery notes",
  "woody notes",
  "floral notes",
  "bourbon vanilla",
  "vanilla caviar",
  "glowing orange blossom",
  "amaretto liqueur accord",
  "bulgarian rose",
  "turkish rose",
  "vanilla absolute",
  "akigalawood",
  "brown sugar",
  "fig milk",
  "almond blossom",
  "macadamia",
  "matcha gelato",
  "marshmallow cloud",
  "waffle cone",
  "cotton candy air",
  "whipped marshmallow",
  "powdered vanilla",
  "vanilla cloud cream",
  "tonka bean absolute",
  "creamy almond",
  "soft wood",
  "cozy spices",
  "sapodilla",
  "ambrette",
  "green and flowering plants",
  "almond milk",
  "night blooming cereus",
  "fresh watermelon",
  "sea breeze",
  "amberwood",
  "mandarin orange",
  "toasted hazelnut",
]

const getExplodePhrases = (): string[] => {
  const phrases = new Set<string>()
  for (const [, to] of NOTE_CANONICAL_PHRASES) phrases.add(to.toLowerCase())
  for (const [from] of NOTE_CANONICAL_PHRASES) phrases.add(from.toLowerCase())
  for (const p of MERCHANT_MULTI_WORD_PHRASES) phrases.add(p.toLowerCase())
  for (const bucket of [OPEN_VOLATILITY, HEART_VOLATILITY, BASE_VOLATILITY]) {
    for (const n of bucket) {
      if (n.includes(" ")) phrases.add(n.toLowerCase())
    }
  }
  return [...phrases].sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length)
}

const greedyPhraseSplit = (raw: string): string[] | null => {
  const words = raw.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return null
  const phrases = getExplodePhrases()
  const materials = getSingleWordNoteMaterials()
  const out: string[] = []
  let i = 0
  while (i < words.length) {
    let bestLen = 0
    for (const phrase of phrases) {
      const pw = phrase.split(/\s+/).filter(Boolean)
      if (pw.length <= bestLen || i + pw.length > words.length) continue
      const slice = words.slice(i, i + pw.length).join(" ").toLowerCase()
      if (slice === phrase.toLowerCase()) bestLen = pw.length
    }
    if (bestLen > 0) {
      const chunk = words.slice(i, i + bestLen).join(" ").toLowerCase()
      const c = canonicalizeNote(chunk)
      if (c) out.push(c)
      i += bestLen
      continue
    }
    const w = words[i].toLowerCase()
    if (NOTE_BLOB_FILLER_WORDS.has(w) && out.length > 0) {
      i += 1
      continue
    }
    const m = NOTE_CANONICAL_TOKENS[w] ?? w
    if (materials.has(m)) {
      out.push(canonicalizeNote(m))
      i += 1
      continue
    }
    return null
  }
  return out.length >= 2 ? out : null
}

const TAIL_SINGLE_MATERIALS = new Set(["rum", "musk", "oud", "amber", "benzoin", "vetiver"])

/** Split paired tail notes like "lavender rum" when the merchant list ends with a solo material. */
const splitKnownTailMaterial = (notes: string[]): string[] => {
  if (notes.length === 0) return notes
  const last = notes[notes.length - 1]?.trim().toLowerCase() ?? ""
  if (!last || matchesKnownMultiWordPhrase(last)) return notes
  const parts = last.split(/\s+/).filter(Boolean)
  if (parts.length === 2 && TAIL_SINGLE_MATERIALS.has(parts[1])) {
    return [...notes.slice(0, -1), parts[0], parts[1]].map(n => canonicalizeNote(n)).filter(Boolean)
  }
  return notes
}

/**
 * Greedy left-to-right walk preferring longest known merchant phrases/materials.
 * Used by both glued Main Notes runs and space-joined CSV blobs.
 */
const walkKnownMaterialChunks = (raw: string): string[] => {
  const s = raw.trim().replace(/\s+/g, " ")
  if (!s) return []
  const words = s.split(/\s+/).filter(Boolean)
  const materials = getSingleWordNoteMaterials()
  const phrases = new Set(getExplodePhrases())
  const isKnownChunk = (chunk: string): boolean => {
    const lc = chunk.trim().toLowerCase()
    if (!lc) return false
    if (phrases.has(lc)) return true
    if (matchesKnownMultiWordPhrase(lc)) return true
    const token = NOTE_CANONICAL_TOKENS[lc] ?? lc
    return !lc.includes(" ") && materials.has(token)
  }

  const out: string[] = []
  let i = 0
  while (i < words.length) {
    let matched = false
    for (let len = Math.min(4, words.length - i); len >= 1; len--) {
      const chunk = words.slice(i, i + len).join(" ")
      if (!isKnownChunk(chunk)) continue
      const c = canonicalizeNote(chunk)
      if (!c) continue
      out.push(c)
      i += len
      matched = true
      break
    }
    if (!matched) return []
  }
  return out
}

const explodeSpaceSeparatedNoteBlobInner = (s: string): string[] => {
  const words = s.split(/\s+/).filter(Boolean)
  const materials = getSingleWordNoteMaterials()
  const mapped =
    words.length >= 2
      ? words.map(w => {
          const lc = w.toLowerCase()
          return NOTE_CANONICAL_TOKENS[lc] ?? lc
        })
      : []

  const greedy = greedyPhraseSplit(s)
  if (greedy) return splitKnownTailMaterial(greedy)

  if (words.length >= 3 && mapped.length === words.length && mapped.every(w => materials.has(w))) {
    return mapped.map(w => canonicalizeNote(w)).filter(Boolean)
  }

  if (words.length < 3) {
    const c = canonicalizeNote(s)
    return c ? [c] : []
  }

  if (!mapped.every(w => materials.has(w))) {
    const c = canonicalizeNote(s)
    return c ? [c] : []
  }

  return mapped.map(w => canonicalizeNote(w)).filter(Boolean)
}

/** Mask parenthetical groups so comma/decorator splits stay outside `(…)`. */
const maskParenGroupsForSplit = (s: string): { masked: string; groups: string[] } => {
  const groups: string[] = []
  const masked = s.replace(/\([^()]*\)/g, m => {
    groups.push(m)
    return `«p${groups.length - 1}»`
  })
  return { masked, groups }
}

const unmaskParenGroupsForSplit = (s: string, groups: string[]): string =>
  s.replace(/«p(\d+)»/g, (_, i) => groups[Number(i)] ?? "")

const splitOnDecoratorsOutsideParens = (s: string): string[] => {
  const { masked, groups } = maskParenGroupsForSplit(s)
  return masked
    .split(/[,;•·|✧✦\u2726-\u2728]+/)
    .map(part => unmaskParenGroupsForSplit(part.trim(), groups))
    .filter(Boolean)
}

/**
 * Andromeda's Moon / Shopify PDPs: "Main Notes Bourbon Vanilla Orange Blossom … Rum" (no colon, no commas).
 * Greedy phrase split first; falls back to comma/decorator split or a single canonical note.
 */
export const splitGluedMerchantNoteRun = (raw: string): string[] => {
  const s = raw.trim().replace(/\s+/g, " ")
  if (!s) return []
  if (/[,;•·|✧✦]/.test(s)) {
    return splitOnDecoratorsOutsideParens(s)
      .map(part => canonicalizeNote(part))
      .filter(Boolean)
  }

  const words = s.split(/\s+/).filter(Boolean)

  const walked = walkKnownMaterialChunks(s)
  if (walked.length >= 2) return splitKnownTailMaterial(walked)

  /** Andromeda "Main Notes Bourbon Vanilla Orange Blossom … Rum" — Title Case pairs + optional tail. */
  if (words.length >= 4 && words.every(w => /^[A-Za-z][a-z'-]*$/u.test(w))) {
    const paired: string[] = []
    let j = 0
    while (j + 1 < words.length) {
      const c = canonicalizeNote(`${words[j]} ${words[j + 1]}`)
      if (c) paired.push(c)
      j += 2
    }
    if (j < words.length) {
      const tail = canonicalizeNote(words[j] ?? "")
      if (tail) paired.push(tail)
    }
    if (paired.length >= 2) return splitKnownTailMaterial(paired)
  }

  const greedy = greedyPhraseSplit(s.toLowerCase())
  if (greedy && greedy.length >= 2) return splitKnownTailMaterial(greedy)
  const exploded = explodeSpaceSeparatedNoteBlobInner(s)
  if (exploded.length >= 2) return splitKnownTailMaterial(exploded)
  const c = canonicalizeNote(s)
  return c ? [c] : []
}

/**
 * Split a single CSV note cell that incorrectly contains space-joined materials
 * ("vanilla caramel coffee litchi incense praline") into separate notes.
 */
export const explodeSpaceSeparatedNoteBlob = (raw: string): string[] => {
  const s = raw.trim()
  if (!s) return []

  if (/[,;•·|✧✦\u2726-\u2728]/.test(s)) {
    return splitOnDecoratorsOutsideParens(s)
      .map(part => canonicalizeNote(part))
      .filter(Boolean)
  }

  if (matchesKnownMultiWordPhrase(s)) {
    const c = canonicalizeNote(s)
    return c ? [c] : []
  }

  const walked = walkKnownMaterialChunks(s)
  if (walked.length >= 2) return splitKnownTailMaterial(walked)

  return explodeSpaceSeparatedNoteBlobInner(s)
}

const getSingleWordNoteMaterials = (): Set<string> => {
  if (singleWordMaterialsCache) return singleWordMaterialsCache
  const s = new Set<string>()
  for (const bucket of [OPEN_VOLATILITY, HEART_VOLATILITY, BASE_VOLATILITY]) {
    for (const n of bucket) {
      if (!n.includes(" ")) s.add(n)
    }
  }
  for (const v of Object.values(NOTE_CANONICAL_TOKENS)) s.add(v)
  for (const k of Object.keys(NOTE_CANONICAL_TOKENS)) s.add(k)
  for (const extra of EXTRA_SINGLE_WORD_MATERIALS) s.add(extra)
  singleWordMaterialsCache = s
  return s
}

const matchesKnownMultiWordPhrase = (text: string): boolean => {
  const lc = text.trim().toLowerCase().replace(/\s+/g, " ")
  if (!lc || !lc.includes(" ")) return false
  for (const [from, to] of NOTE_CANONICAL_PHRASES) {
    if (lc === from || lc === to) return true
  }
  for (const p of MERCHANT_MULTI_WORD_PHRASES) {
    if (lc === p.toLowerCase()) return true
  }
  return (
    OPEN_VOLATILITY.has(lc) || HEART_VOLATILITY.has(lc) || BASE_VOLATILITY.has(lc)
  )
}

/** Expand any merged space-separated blobs in a note layer array. */
export const expandLayerNoteBlobs = (notes: string[]): string[] =>
  notes.flatMap(explodeSpaceSeparatedNoteBlob)

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

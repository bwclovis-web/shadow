/**
 * Single source of truth for "is this a valid scent note for display?"
 * Used by: app (getAllTags / scent quiz) and note-materials tooling so only confirmed notes are shown.
 *
 * Stopwords apply only to exact single-word matches. Multi-word notes are valid, e.g.:
 * cut grass, hot cocoa, gray musk, cold steel, old makeup, hot melted wax, grey iris.
 */

function normalize(name) {
  if (typeof name !== 'string') return ''
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Only single-word notes matching these are filtered. "cut grass", "hot sand", "gray musk" etc. pass.
const STOPWORDS = [
  'and', 'of', 'with', 'the', 'a', 'an', 'or', 'but', 'in', 'on', 'at', 'to',
  'for', 'from', 'by', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
  'may', 'might', 'must', 'can',
  'null', 'cut', 'grey', 'gray', 'hot', 'cold', 'ups', 'fedex', 'usps', 'yes', 'no',
  'other', 'various', 'etc', 'new', 'old', 'same', 'different', 'many', 'some', 'more',
  'most', 'all', 'any', 'each', 'every', 'both', 'such', 'what', 'which', 'who',
  'vegan', 'clothing',
  'padding', 'margin', 'border',
  'again', 'lively',
]

const PLACEHOLDER_PHRASES = [
  'few', 'no name', 'new name', 'unknown', 'unnamed', 'untitled', 'tbd', 'todo', 'n/a', 'none',
  'to be determined', 'not applicable', 'placeholder', 'test', 'example', 'sample', 'delete me',
  'test update note', 'test note', 'update note', 'null', 'nul',
  'to moments of pause',
  'entering the vault',
]

const TRAILING_FRAGMENT_REGEX = /\s+(of|in|with|to|for|and|or|from|by|as|at|on|that|which|who|when|where|a|an|the)$/i

// EU/IFRA-style allergens and raw synthesis materials — not consumer-facing scent notes.
const INCI_LIKE_PATTERNS = [
  /\bsalicylate\b/i,
  /\bbenzoate\b/i,
  /\bphthalate\b/i,
  /\bbenzoic acid\b/i,
  /\bparaben\b/i,
  /\b(?:alpha|beta)[-\s]?isomethyl ionone\b/i,
  /\bmethyl ionone\b/i,
  /\bhydroxycitronellal\b/i,
  /\bfarnesol\b/i,
  /\beugenol\b/i,
  /\blinalool\b/i,
  /\blimonene\b/i,
  /\bcitronellol\b/i,
  /\bgeraniol\b/i,
  /\bcitral\b/i,
  /\bcoumarin\b/i,
  /\blinalyl acetate\b/i,
  /\bgeranyl acetate\b/i,
  /\bneryl acetate\b/i,
  /\bethyl acetate\b/i,
  /\bethyl vanillin\b/i,
  /\b(amyl|benzyl|butyl|ethyl|hexyl|methyl|propyl|isopropyl|cetyl|stearyl|isobutyl|phenethyl|anisyl)\s+(alcohol|salicylate|benzoate|cinnamate|cinnamal|paraben|lactate|acetate)\b/i,
  /\b(hexyl|amyl|benzyl|methyl|ethyl|isobutyl)\s+cinnamal\b/i,
]

const KNOWN_BAD_PATTERNS = [
  /^two\s+differences?\s*1$/i,
  /^limited\s+time\s+only$/i,
  /\s+but\s+not\s+in$/i,
  /^\d+\s*ml\b/i,
  /^test\s+/i,
  /\bgift\s+ideas\b/i,
  /\bpower source\b/i,
  /\bextra info\b/i,
  /\bif you'?re\s+curious\b/i,
  /\bbelow\s+if\s+you\b/i,
  /\baugeo\b/i,
  /\brenewable resources\b/i,
  /\bmade from renewable\b/i,
  /\bwhich is (colourless|colorless)\b/i,
  /\b(is vegan|colourless|colorless|odourless|odorless)\b/i,
  /\broom sprays\b/i,
  /\bwhat does\b.*\b(smell|smells)\b/i,
  /\bmanly accord\b/i,
  /\bopening with\b/i,
  /\benhanced by\b/i,
  /\benriched by\b/i,
  /\bhints?\s+of\b/i,
  /\bcreating a rich\b/i,
  /\d+(?:rem|em|ch|vw|vh|px|pt)\b/i,
  /\bpatchouli\s+a\s+chocolate\s+orange\b/i,
  ...INCI_LIKE_PATTERNS,
]

const VALID_WORD_COUNT = { min: 1, max: 5 }
const VALID_LENGTH = { min: 2, max: 50 }

/**
 * Returns true if the note is valid for display as a scent note; false if it should be hidden.
 * Use this to filter note lists (e.g. scent quiz) so only confirmed notes are shown.
 */
export function isDisplayableScentNote(name) {
  if (!name || typeof name !== 'string') return false
  const n = normalize(name)
  if (!n) return false

  if (STOPWORDS.includes(n)) return false
  if (PLACEHOLDER_PHRASES.includes(n)) return false
  if (TRAILING_FRAGMENT_REGEX.test(n)) return false
  for (const pattern of KNOWN_BAD_PATTERNS) {
    if (pattern.test(n)) return false
  }

  const words = n.split(/\s+/).filter(Boolean)
  if (words.length < VALID_WORD_COUNT.min || words.length > VALID_WORD_COUNT.max) return false
  if (n.length < VALID_LENGTH.min || n.length > VALID_LENGTH.max) return false

  return true
}

/** Shared lists/patterns so validation stays consistent across app and scripts. */
export { STOPWORDS, PLACEHOLDER_PHRASES, TRAILING_FRAGMENT_REGEX, KNOWN_BAD_PATTERNS }
export { normalize as normalizeForValidation }

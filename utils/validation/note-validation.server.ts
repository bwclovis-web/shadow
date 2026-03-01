/**
 * Display validation for scent notes. Only notes that pass are shown in the UI (e.g. scent quiz).
 * Keep in sync with scripts/note-validation.js.
 * Stopwords apply only to exact single-word matches. Multi-word notes pass, e.g.:
 * cut grass, hot cocoa, gray musk, old makeup, hot melted wax, grey iris.
 */

const normalize = (name: string): string =>
  typeof name !== "string" ? "" : name.trim().toLowerCase().replace(/\s+/g, " ")

const STOPWORDS = new Set([
  "and", "of", "with", "the", "a", "an", "or", "but", "in", "on", "at", "to",
  "for", "from", "by", "as", "is", "was", "are", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "should", "could",
  "may", "might", "must", "can",
  "null", "cut", "grey", "gray", "hot", "cold", "ups", "fedex", "usps", "yes", "no",
  "other", "various", "etc", "new", "old", "same", "different", "many", "some", "more",
  "most", "all", "any", "each", "every", "both", "such", "what", "which", "who",
])

const PLACEHOLDER_PHRASES = new Set([
  "few", "no name", "new name", "unknown", "unnamed", "untitled", "tbd", "todo", "n/a", "none",
  "to be determined", "not applicable", "placeholder", "test", "example", "sample", "delete me",
  "test update note", "test note", "update note", "null", "nul",
])

const TRAILING_FRAGMENT_REGEX = /\s+(of|in|with|to|for|and|or|from|by|as|at|on|that|which|who|when|where|a|an|the)$/i

const KNOWN_BAD_PATTERNS = [
  /^two\s+differences?\s*1$/i,
  /^limited\s+time\s+only$/i,
  /\s+but\s+not\s+in$/i,
  /^\d+\s*ml\b/i,
  /^test\s+/i,
]

const VALID_WORD_COUNT = { min: 1, max: 5 } as const
const VALID_LENGTH = { min: 2, max: 50 } as const

/** Returns true only if the note should be shown as a scent option (e.g. in scent quiz). */
export const isDisplayableScentNote = (name: string | null | undefined): boolean => {
  if (!name || typeof name !== "string") return false
  const n = normalize(name)
  if (!n) return false

  if (STOPWORDS.has(n)) return false
  if (PLACEHOLDER_PHRASES.has(n)) return false
  if (TRAILING_FRAGMENT_REGEX.test(n)) return false
  for (const pattern of KNOWN_BAD_PATTERNS) {
    if (pattern.test(n)) return false
  }

  const words = n.split(/\s+/).filter(Boolean)
  if (words.length < VALID_WORD_COUNT.min || words.length > VALID_WORD_COUNT.max) return false
  if (n.length < VALID_LENGTH.min || n.length > VALID_LENGTH.max) return false

  return true
}

export type NoteValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

/**
 * Validates a note for API use (e.g. createTag). Returns a result object so routes can return
 * a clear 400 message. Use isDisplayableScentNote for filtering lists.
 */
export const validateNoteForApi = (name: string | null | undefined): NoteValidationResult => {
  if (!name || typeof name !== "string") {
    return { valid: false, reason: "Note name is required" }
  }
  const n = normalize(name)
  if (!n) {
    return { valid: false, reason: "Note name is required" }
  }
  if (STOPWORDS.has(n)) {
    return { valid: false, reason: "That note is not allowed" }
  }
  if (PLACEHOLDER_PHRASES.has(n)) {
    return { valid: false, reason: "Placeholder or test names are not allowed" }
  }
  if (TRAILING_FRAGMENT_REGEX.test(n)) {
    return { valid: false, reason: "Note cannot end with a fragment word" }
  }
  for (const pattern of KNOWN_BAD_PATTERNS) {
    if (pattern.test(n)) {
      return { valid: false, reason: "Note format is not allowed" }
    }
  }
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length < VALID_WORD_COUNT.min || words.length > VALID_WORD_COUNT.max) {
    return { valid: false, reason: `Note must be ${VALID_WORD_COUNT.min}-${VALID_WORD_COUNT.max} words` }
  }
  if (n.length < VALID_LENGTH.min || n.length > VALID_LENGTH.max) {
    return { valid: false, reason: `Note must be ${VALID_LENGTH.min}-${VALID_LENGTH.max} characters` }
  }
  return { valid: true }
}

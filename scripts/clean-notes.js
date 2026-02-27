#!/usr/bin/env node

/**
 * Clean Duplicate and Erroneous Notes Script
 * 
 * Safely removes duplicate notes, invalid notes (with special characters), stopwords, and descriptive phrases.
 * All perfume relationships are preserved by reassociating to canonical notes.
 * 
 * IMPORTANT: Run `npm run db:backup` before executing this script!
 * If rollback is needed, use `npm run db:restore` with the backup created before cleanup.
 * 
 * Usage:
 *   node scripts/clean-notes.js           # Execute cleanup
 *   node scripts/clean-notes.js --dry-run  # Preview changes without applying
 */

import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"
import { join } from "path"
import { dirname } from "path"
import { fileURLToPath } from "url"
import { normalizeName, normalizeForDuplicateDetection } from './note-utils.js'
import { STOPWORDS, PLACEHOLDER_PHRASES, TRAILING_FRAGMENT_REGEX, KNOWN_BAD_PATTERNS } from './note-validation.js'
import { writeFileSync, mkdirSync } from "fs"
import { existsSync } from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")

// Load environment variables
process.env.DOTENV_CONFIG_QUIET = "true"
dotenv.config({ path: join(projectRoot, ".env") })

// Use same DB as dev app when running locally (app uses LOCAL_DATABASE_URL in development)
if (process.env.NODE_ENV !== "production" && process.env.LOCAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.LOCAL_DATABASE_URL
}

const prisma = new PrismaClient()

const isDryRun = process.argv.includes("--dry-run")

// Report generation for dry-run
let reportContent = []
let reportPath = null

function addToReport(content) {
  reportContent.push(content)
}

function generateReportPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const reportsDir = join(projectRoot, "reports")
  
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true })
  }
  
  return join(reportsDir, `clean-notes-dry-run-${timestamp}.md`)
}

function saveReport() {
  if (isDryRun && reportContent.length > 0) {
    reportPath = generateReportPath()
    const fullReport = reportContent.join('\n')
    writeFileSync(reportPath, fullReport, 'utf-8')
    console.log(`\n📄 Dry-run report saved to: ${reportPath}`)
  }
}

// Stopwords, placeholders, trailing-fragment regex: from note-validation.js (single source of truth for display + cleanup)
// PROTECTED_MULTI_WORD_NOTES and TRAILING_GARBAGE_PHRASES stay here (cleanup-only)
const PROTECTED_MULTI_WORD_NOTES = [
  "white birch wood", "ancient white oak", "black tea", "green tea", "white tea",
  "white musk", "black musk", "red musk", "white amber", "black amber",
  "white woods", "black pepper", "white pepper", "pink pepper",
  "crisp paper", "sweet red apple", "sugared ginger", "motor oil", "dirt", "coppery blood",
  "salt water taffy", "madagascar vanilla beans", "blue cotton candy", "strawberry buttercream frosting",
  "australian blue peppercorn", "italian white clove", "spanish tonka bean", "gâteau à la vanille", "egyptian marsh-mallow cream"
]

const TRAILING_GARBAGE_PHRASES = [
  ' plus several others', ' add loads of', ' or any of', ' and loads of',
  ' or any', ' and any of', ' with a hint of', ' and a touch of',
  ' and more', ' or more', ' and then some', ' and others'
].map(s => s.toLowerCase()).sort((a, b) => b.length - a.length)

// Delete rules from note-validation.js + extract rules (cleanup-only)
const KNOWN_BAD_PHRASE_RULES = [
  ...KNOWN_BAD_PATTERNS.map((pattern) => ({ pattern, action: "delete", type: "known-bad-noise" })),
  { pattern: /\bcoffee\s+in\s+your\s+hand\b/i, action: "extract", type: "known-bad-extract", extract: "coffee" },
  { pattern: /\bpurrfect\s+patisserie\b/i, action: "extract", type: "known-bad-extract", extract: "patisserie" },
]

// Valid characters: letters, numbers, spaces, hyphens, apostrophes
const VALID_CHAR_REGEX = /^[a-zA-Z0-9\s\-']+$/


/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Check if note name contains only valid characters
 */
function isValidNoteName(name) {
  return VALID_CHAR_REGEX.test(name)
}

/**
 * Clean note name by removing invalid characters
 */
function cleanNoteName(name) {
  return name.replace(/[^a-zA-Z0-9\s\-']/g, '').trim()
}

/**
 * Check if note is a stopword
 */
function isStopword(name) {
  return STOPWORDS.includes(normalizeName(name))
}

function isProtectedMultiWordNote(name) {
  return PROTECTED_MULTI_WORD_NOTES.includes(normalizeName(name))
}

function resolveExtractedNote(candidate, existingNotes) {
  const cleanedCandidate = removeTrailingPunctuation(normalizeName(candidate).trim())
  if (!cleanedCandidate || isStopword(cleanedCandidate)) {
    return null
  }

  const foundNote = existingNotes.find(n =>
    normalizeName(n.name) === normalizeName(cleanedCandidate)
  )
  if (foundNote) {
    return foundNote.name
  }

  const wordCount = cleanedCandidate.split(/\s+/).filter(w => w.length > 0).length
  if (wordCount >= 1 && wordCount <= 5 && cleanedCandidate.length >= 2 && cleanedCandidate.length <= 50) {
    return cleanedCandidate
  }

  return null
}

function classifyKnownBadPhrase(name, existingNotes) {
  const normalizedName = removeTrailingPunctuation(normalizeName(name).trim())
  if (!normalizedName || isProtectedMultiWordNote(normalizedName)) {
    return null
  }

  if (PLACEHOLDER_PHRASES.includes(normalizedName)) {
    return { action: "delete", type: "known-bad-noise", extractedNote: null }
  }

  // Trailing garbage or trailing fragment: send to Crew AI instead of rule-based extract/delete
  for (const suffix of TRAILING_GARBAGE_PHRASES) {
    if (normalizedName.endsWith(suffix)) {
      return { action: "delete", type: "descriptive-ai", extractedNote: null }
    }
  }
  if (TRAILING_FRAGMENT_REGEX.test(normalizedName)) {
    return { action: "delete", type: "descriptive-ai", extractedNote: null }
  }

  for (const rule of KNOWN_BAD_PHRASE_RULES) {
    if (!rule.pattern.test(normalizedName)) continue
    if (rule.action === "delete") {
      return { action: "delete", type: rule.type, extractedNote: null }
    }
    if (rule.action === "extract" && rule.extract) {
      const extracted = resolveExtractedNote(rule.extract, existingNotes)
      if (extracted) {
        return { action: "extract", type: rule.type, extractedNote: extracted }
      }
      return { action: "delete", type: "known-bad-noise", extractedNote: null }
    }
  }

  return null
}

/**
 * Detect note names that have a slug/ID suffix (e.g. "lemon-adamo-8du3rk").
 * If the part after the first hyphen contains digits or looks like an id, extract the leading word as the note.
 */
function classifyNoteWithSlugId(name, existingNotes) {
  const normalizedName = removeTrailingPunctuation(normalizeName(name).trim())
  if (!normalizedName || normalizedName.indexOf('-') === -1) {
    return null
  }
  const firstHyphen = normalizedName.indexOf('-')
  const leadingPart = normalizedName.slice(0, firstHyphen).trim()
  const suffix = normalizedName.slice(firstHyphen + 1).trim()
  if (!leadingPart || !suffix) return null
  // Suffix looks like an id only if it contains a digit (e.g. adamo-8du3rk); avoid stripping valid hyphenated notes like cherry-blossom, lily-of-the-valley
  const suffixLooksLikeId = /\d/.test(suffix)
  if (!suffixLooksLikeId) return null
  const extracted = resolveExtractedNote(leadingPart, existingNotes)
  if (extracted) {
    return { action: "extract", type: "slug-id-suffix", extractedNote: extracted }
  }
  return null
}

/**
 * Clean note name by removing trailing punctuation
 */
function removeTrailingPunctuation(name) {
  return name.replace(/[.,;:!?\]\[\)\}\{]+$/g, '').trim()
}

/**
 * Split note by slash separator
 * Examples: "opoponax/resins" → ["opoponax", "resins"]
 * Returns array of notes or null if no slash found
 */
function splitBySlash(name, existingNotes) {
  if (!name.includes('/')) {
    return null
  }
  
  const parts = name.split('/').map(part => part.trim()).filter(part => part.length > 0)
  if (parts.length < 2) {
    return null
  }
  
  const notes = []
  for (const part of parts) {
    const cleaned = removeTrailingPunctuation(part)
    if (cleaned.length >= 2 && cleaned.length <= 50) {
      // Check if it matches an existing note
      const foundNote = existingNotes.find(n => 
        normalizeName(n.name) === normalizeName(cleaned)
      )
      if (foundNote) {
        notes.push(foundNote.name)
      } else if (!isStopword(cleaned)) {
        notes.push(cleaned)
      }
    }
  }
  
  return notes.length > 0 ? notes : null
}

/**
 * Detect multiple distinct notes in a phrase.
 * Conservative: only split when phrase has 5+ words (or 4+ and starts with article) to avoid false positives
 * like "wild bergamot tea" or "white pepper flowers" being split.
 * Examples: "the fabulous vanilla bean orchid" → ["vanilla bean", "orchid"]
 * Returns array of extracted notes or null
 */
function detectMultipleDistinctNotes(name, existingNotes) {
  const normalized = normalizeName(name)
  let trimmed = normalized.trim()
  trimmed = removeTrailingPunctuation(trimmed)
  
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  const startsWithArticle = /^(the|a|an)\s+/i.test(trimmed)
  if (words.length < 5 && !(words.length >= 4 && startsWithArticle)) {
    return null
  }
  
  // Look for patterns where the last word(s) might be a separate note
  // e.g., "the fabulous vanilla bean orchid" - "orchid" is likely separate from "vanilla bean"
  
  // Common note endings that might indicate a separate note
  const commonNoteEndings = ['orchid', 'rose', 'lily', 'jasmine', 'iris', 'violet', 'peony', 'tulip', 'daisy', 'lavender', 'mint', 'basil', 'sage', 'thyme', 'cedar', 'pine', 'oak', 'amber', 'musk', 'sandalwood', 'patchouli', 'vanilla', 'cinnamon', 'clove', 'nutmeg', 'ginger', 'pepper', 'bergamot', 'lemon', 'orange', 'lime', 'grapefruit', 'mandarin', 'tangerine', 'apple', 'pear', 'peach', 'berry', 'cherry', 'plum', 'fig', 'coconut', 'almond', 'hazelnut', 'walnut', 'coffee', 'tea', 'chocolate', 'honey', 'sugar', 'caramel', 'toffee', 'cream', 'milk', 'butter', 'leather', 'tobacco', 'smoke', 'incense', 'frankincense', 'myrrh', 'benzoin', 'labdanum', 'opoponax', 'resin', 'resins', 'balsam', 'wood', 'woods', 'bean', 'beans']
  
  // Check if last 1-2 words match a common note ending
  for (let i = 1; i <= 2; i++) {
    if (words.length < i + 2) break // Need at least 2 words before the ending
    
    const lastWords = words.slice(-i).join(' ')
    const beforeLast = words.slice(0, -i).join(' ')
    
    // Check if last word(s) is a known note ending
    const isKnownNote = commonNoteEndings.some(ending => 
      normalizeName(lastWords) === normalizeName(ending) || 
      normalizeName(lastWords).endsWith(normalizeName(ending))
    )
    
    // Also check if it exists as a note in the database
    const foundNote = existingNotes.find(n => 
      normalizeName(n.name) === normalizeName(lastWords)
    )
    
    if (isKnownNote || foundNote) {
      // Try to extract the first part as a note
      // Remove leading articles/adjectives like "the fabulous"
      let firstPart = beforeLast
      // Remove multiple leading adjectives/articles
      firstPart = firstPart.replace(/^(the|a|an)\s+(fabulous|delicate|subtle|strong|soft|light|heavy|faint|intense|rich|deep|fresh|warm|cool|sweet|bitter|spicy|floral|woody|citrus)\s+/i, '')
      firstPart = firstPart.replace(/^(the|a|an|fabulous|delicate|subtle|strong|soft|light|heavy|faint|intense|rich|deep|fresh|warm|cool|sweet|bitter|spicy|floral|woody|citrus)\s+/i, '')
      
      // Only split when the first part exists as a note in DB (reduces false positives)
      const foundFirstNote = existingNotes.find(n =>
        normalizeName(n.name) === normalizeName(firstPart)
      )
      if (foundFirstNote) {
        const lastNote = foundNote ? foundNote.name : lastWords
        if (normalizeName(foundFirstNote.name) !== normalizeName(lastNote)) {
          return [foundFirstNote.name, lastNote]
        }
      }
    }
  }
  
  return null
}

/**
 * Extract multiple notes from a phrase (handles "and", commas, slashes, etc.)
 * Examples: 
 *   "dragon's blood and a river of wine" → ["dragon's blood", "river of wine"]
 *   "patchouli and orange blossom on a resinous bed of labdanum.]" → ["patchouli", "orange blossom", "labdanum"]
 *   "opoponax/resins" → ["opoponax", "resins"]
 *   "the fabulous vanilla bean orchid" → ["vanilla bean", "orchid"]
 * Returns array of extracted notes or null
 */
function extractMultipleNotes(name, existingNotes) {
  const normalized = normalizeName(name)
  let cleaned = normalized.trim()
  
  // First check for slash-separated notes
  const slashSplit = splitBySlash(cleaned, existingNotes)
  if (slashSplit && slashSplit.length > 0) {
    return slashSplit
  }
  
  // Remove trailing punctuation (., ], }, etc.)
  cleaned = removeTrailingPunctuation(cleaned)
  
  const notes = []
  
  // Handle complex phrases like "patchouli and orange blossom on a resinous bed of labdanum"
  // Extract notes before "on a", "in a", "of a", etc.
  const complexPattern = /^(.+?)\s+(?:on|in|at|over|under|within|inside)\s+(?:a|an|the)\s+(?:resinous|bed|base|foundation|layer|mix|blend)\s+(?:of|with)\s+(.+)$/i
  const complexMatch = cleaned.match(complexPattern)
  if (complexMatch) {
    // Extract notes from the first part (before "on a resinous bed")
    const firstPart = complexMatch[1].trim()
    const lastPart = complexMatch[2].trim()
    
    // Extract from first part (may contain "and")
    if (firstPart.includes(' and ')) {
      const andSplit = firstPart.split(/\s+and\s+/i)
      for (let part of andSplit) {
        part = removeTrailingPunctuation(part.trim())
        const extracted = extractSingleNoteFromPhrase(part, existingNotes)
        if (extracted) {
          notes.push(extracted)
        }
      }
    } else {
      const extracted = extractSingleNoteFromPhrase(firstPart, existingNotes)
      if (extracted) {
        notes.push(extracted)
      }
    }
    
    // Extract from last part (the note after "bed of")
    const lastExtracted = extractSingleNoteFromPhrase(lastPart, existingNotes)
    if (lastExtracted) {
      notes.push(lastExtracted)
    }
    
    if (notes.length > 0) {
      return notes
    }
  }
  
  // Split by "and" (but be careful with "dragon's blood" - apostrophes are valid)
  // Use word boundary for "and" to avoid splitting "land" or "sand"
  const andSplit = cleaned.split(/\s+and\s+/i)
  
  if (andSplit.length > 1) {
    // Multiple notes separated by "and"
    for (let part of andSplit) {
      part = part.trim()
      // Remove leading articles and prepositions
      part = part.replace(/^(a|an|the)\s+/i, '')
      part = part.replace(/^(of|on|in|at|to|for|with|from|by)\s+/i, '')
      part = removeTrailingPunctuation(part)
      
      // Try to extract note from this part
      const extracted = extractSingleNoteFromPhrase(part, existingNotes)
      if (extracted) {
        notes.push(extracted)
      }
    }
    if (notes.length > 0) {
      return notes
    }
  }
  
  // Try comma-separated notes
  const commaSplit = cleaned.split(/,/).map(s => s.trim())
  if (commaSplit.length > 1) {
    for (let part of commaSplit) {
      part = removeTrailingPunctuation(part.trim())
      const extracted = extractSingleNoteFromPhrase(part, existingNotes)
      if (extracted) {
        notes.push(extracted)
      }
    }
    if (notes.length > 1) {
      return notes
    }
  }
  
  // Try to detect multiple distinct notes (e.g., "the fabulous vanilla bean orchid")
  const distinctNotes = detectMultipleDistinctNotes(cleaned, existingNotes)
  if (distinctNotes && distinctNotes.length > 1) {
    return distinctNotes
  }
  
  return null
}

/**
 * Extract a single note name from descriptive phrase
 * Examples: "the delicate scent of roses" → "roses", "a hint of vanilla" → "vanilla"
 * Returns null if no note can be extracted
 */
function extractSingleNoteFromPhrase(name, existingNotes) {
  let normalized = normalizeName(name)
  let trimmed = normalized.trim()
  
  // Remove trailing punctuation
  trimmed = removeTrailingPunctuation(trimmed)
  
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  
  // Patterns that indicate a note name follows
  const extractionPatterns = [
    // "soaked in [note]" - captures "black tea" from "petites madeleines soaked in black tea"
    /soaked\s+in\s+(\w+(?:\s+\w+){0,4})/i,
    // "hints of [note]" or "hint of [note]" - captures "musk" from "along with hints of musk"
    /(?:along\s+with\s+)?hints?\s+of\s+(\w+(?:\s+\w+){0,4})/i,
    // "touch of [note]" - captures note from "a touch of [note]"
    /(?:a\s+)?touch\s+of\s+(?:the\s+)?(\w+(?:\s+\w+){0,4})/i,
    // "smells like: [adjective] [note]" - captures "vanilla" from "smells like: velvety vanilla"
    // Try to capture just the note name (last word(s)) if there's an adjective
    /smells?\s+like:?\s+(?:(?:velvety|delicate|subtle|strong|soft|light|heavy|faint|intense|rich|deep|fresh|warm|cool|sweet|bitter|spicy|floral|woody|citrus)\s+)?(\w+(?:\s+\w+){0,4})/i,
    // "the [adjective] scent of [note]" - captures "roses" from "the delicate scent of roses"
    /(?:the\s+)?(?:\w+\s+)?scent\s+of\s+(\w+(?:\s+\w+){0,4})/i,
    // "a hint of [note]" - captures "vanilla" from "a hint of vanilla"
    /(?:a\s+)?hint\s+of\s+(\w+(?:\s+\w+){0,4})/i,
    // "notes of [note]" or "note of [note]"
    /notes?\s+of\s+(\w+(?:\s+\w+){0,4})/i,
    // "with notes of [note]" or "featuring [note]"
    /(?:with|featuring)\s+(?:notes?\s+of\s+)?(\w+(?:\s+\w+){0,4})/i,
    // "velvety [note]", "delicate [note]", etc. - captures note after adjective
    /(?:velvety|delicate|subtle|strong|soft|light|heavy|faint|intense|rich|deep|fresh|warm|cool|sweet|bitter|spicy|floral|woody|citrus)\s+(\w+(?:\s+\w+){0,4})/i,
    // "[note] scent", "[note] aroma", "[note] fragrance" - captures note before descriptor
    /(\w+(?:\s+\w+){0,4})\s+(?:scent|aroma|fragrance|note|notes)/i,
    // "the [adjective] [note]" - e.g., "the delicate roses"
    /the\s+(?:delicate|subtle|strong|soft|light|heavy|faint|intense|rich|deep|fresh|warm|cool|sweet|bitter|spicy|floral|woody|citrus)\s+(\w+(?:\s+\w+){0,4})/i,
  ]
  
  // Try extraction patterns first
  for (const pattern of extractionPatterns) {
    const match = trimmed.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()
      
      // Skip if extracted is a stopword
      if (isStopword(extracted)) {
        continue
      }
      
      // Skip if too short (less than 2 characters)
      if (extracted.length < 2) {
        continue
      }
      
      // Try to strip common adjectives from the beginning (e.g., "velvety vanilla" → "vanilla", "fresh sugared ginger" → "sugared ginger")
      const adjectives = ['velvety', 'delicate', 'subtle', 'strong', 'soft', 'light', 'heavy', 'faint', 'intense', 'rich', 'deep', 'fresh', 'warm', 'cool', 'sweet', 'bitter', 'spicy', 'floral', 'woody', 'citrus', 'creamy', 'smooth', 'sharp', 'mellow', 'ancient', 'white', 'black', 'red', 'green', 'blue', 'yellow']
      let cleanedExtracted = extracted
      const extractedWords = extracted.split(/\s+/)
      if (extractedWords.length > 1 && adjectives.includes(normalizeName(extractedWords[0]))) {
        // Remove the first word if it's an adjective
        cleanedExtracted = extractedWords.slice(1).join(' ')
      }
      
      // Check if cleaned extracted note exists in database (case-insensitive)
      const foundNote = existingNotes.find(n => 
        normalizeName(n.name) === normalizeName(cleanedExtracted)
      )
      if (foundNote) {
        return foundNote.name
      }
      
      // Check original extracted note too
      const foundNoteOriginal = existingNotes.find(n => 
        normalizeName(n.name) === normalizeName(extracted)
      )
      if (foundNoteOriginal) {
        return foundNoteOriginal.name
      }
      
      // Also check if it's a valid note name (1-5 words for multi-word notes like "frosted pumpkin pecan cookies", reasonable length)
      const wordCount = cleanedExtracted.split(/\s+/).length
      if (wordCount >= 1 && wordCount <= 5 && cleanedExtracted.length <= 50) {
        return cleanedExtracted
      }
      
      // Fallback to original if cleaned is too short
      const originalWordCount = extracted.split(/\s+/).length
      if (originalWordCount >= 1 && originalWordCount <= 5 && extracted.length <= 50) {
        return extracted
      }
    }
  }
  
  // Fallback: try to find a known note name in the phrase
  // Check if any existing note name appears in the phrase
  for (const existingNote of existingNotes) {
    const noteName = normalizeName(existingNote.name)
    // Check if the note name appears as a whole word in the phrase
    const noteWords = noteName.split(/\s+/)
    if (noteWords.length === 1) {
      // Single word note - check if it appears as a whole word
      // Escape special regex characters in the note name
      const escapedNote = escapeRegex(noteWords[0])
      const wordBoundaryRegex = new RegExp(`\\b${escapedNote}\\b`, 'i')
      if (wordBoundaryRegex.test(trimmed)) {
        return existingNote.name
      }
    } else {
      // Multi-word note - check if the phrase contains it
      if (trimmed.includes(noteName)) {
        return existingNote.name
      }
    }
  }
  
  // Look for patterns like "smells like: [note]" at the end
  const smellsLikeMatch = trimmed.match(/smells?\s+like:?\s+(.+)$/i)
  if (smellsLikeMatch && smellsLikeMatch[1]) {
    const candidate = removeTrailingPunctuation(smellsLikeMatch[1].trim())
    if (candidate.length >= 2 && candidate.length <= 50) {
      const wordCount = candidate.split(/\s+/).length
      if (wordCount >= 1 && wordCount <= 5 && !isStopword(candidate)) {
        // Check if it matches an existing note
        const foundNote = existingNotes.find(n => 
          normalizeName(n.name) === normalizeName(candidate)
        )
        if (foundNote) {
          return foundNote.name
        }
        return candidate
      }
    }
  }
  
  // Try to extract meaningful phrases like "autumnal forest" from "fallen leaves deep in the autumnal forest"
  // Look for patterns like "in the [note]", "of [note]", "on a [note]", etc.
  // Prefer longer, more specific phrases at the end
  const phrasePatterns = [
    // "deep in the autumnal forest" → "autumnal forest"
    /(?:deep|deeply|within|inside)\s+(?:in|the|a|an)?\s*(\w+(?:\s+\w+){0,4})/i,
    // "in the autumnal forest" → "autumnal forest"
    /(?:in|on|of|at|to|for|with|from|by)\s+(?:the|a|an)?\s*(\w+(?:\s+\w+){0,4})/i,
    // "on a resinous bed of labdanum" → "labdanum"
    /(?:on|in|at|over|under)\s+(?:a|an|the)\s+(?:\w+\s+)*bed\s+of\s+(\w+(?:\s+\w+){0,4})/i,
  ]
  
  for (const pattern of phrasePatterns) {
    const matches = [...trimmed.matchAll(new RegExp(pattern.source, 'gi'))]
    // Take the last match (most likely the actual note at the end)
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1]
      if (lastMatch && lastMatch[1]) {
        let candidate = removeTrailingPunctuation(lastMatch[1].trim())
        
        // If candidate is just one word, try to get 2-3 words for context
        // e.g., "autumnal forest" instead of just "forest"
        if (candidate.split(/\s+/).length === 1 && words.length > 1) {
          const candidateIndex = trimmed.lastIndexOf(candidate)
          if (candidateIndex > 0) {
            // Try to get the word before it too
            const beforeCandidate = trimmed.substring(0, candidateIndex).trim()
            const beforeWords = beforeCandidate.split(/\s+/)
            if (beforeWords.length > 0) {
              const lastBeforeWord = beforeWords[beforeWords.length - 1]
              // If it's an adjective or descriptive word, include it
              if (!isStopword(lastBeforeWord) && lastBeforeWord.length > 2) {
                candidate = `${lastBeforeWord} ${candidate}`
              }
            }
          }
        }
        
        candidate = removeTrailingPunctuation(candidate.trim())
        if (candidate.length >= 2 && candidate.length <= 50) {
          const wordCount = candidate.split(/\s+/).length
          if (wordCount >= 1 && wordCount <= 5 && !isStopword(candidate)) {
            // Check if it matches an existing note
            const foundNote = existingNotes.find(n => 
              normalizeName(n.name) === normalizeName(candidate)
            )
            if (foundNote) {
              return foundNote.name
            }
            return candidate
          }
        }
      }
    }
  }
  
  // Try last 1-5 words as potential note name (for multi-word notes like "frosted pumpkin pecan cookies")
  if (words.length >= 3 && words.length <= 10) {
    for (let i = 1; i <= 5; i++) {
      let candidate = words.slice(-i).join(' ')
      candidate = removeTrailingPunctuation(candidate)
      if (candidate.length <= 50 && candidate.length >= 2) {
        // Skip if it's a stopword
        if (isStopword(candidate)) {
          continue
        }
        
        // Check if it matches an existing note
        const foundNote = existingNotes.find(n => 
          normalizeName(n.name) === normalizeName(candidate)
        )
        if (foundNote) {
          return foundNote.name
        }
        
        // If it's a reasonable length and not a stopword, return it
        // Prefer shorter extractions (1-3 words) over longer ones (4-5 words)
        if (i <= 3 || (i <= 5 && candidate.length <= 40)) {
          return candidate
        }
      }
    }
  }
  
  return null
}

/**
 * Extract note name from descriptive phrase (handles multiple notes)
 * Examples: 
 *   "the delicate scent of roses" → "roses"
 *   "dragon's blood and a river of wine" → ["dragon's blood", "river of wine"]
 *   "fallen leaves deep in the autumnal forest." → "autumnal forest"
 *   "patchouli and orange blossom on a resinous bed of labdanum.]" → ["patchouli", "orange blossom", "labdanum"]
 * Returns string (single note) or array (multiple notes) or null
 */
function extractNoteFromPhrase(name, existingNotes) {
  // First try to extract multiple notes
  const multipleNotes = extractMultipleNotes(name, existingNotes)
  if (multipleNotes && multipleNotes.length > 0) {
    // Return array if multiple, single value if one
    return multipleNotes.length === 1 ? multipleNotes[0] : multipleNotes
  }
  
  // Fall back to single note extraction
  return extractSingleNoteFromPhrase(name, existingNotes)
}

/**
 * Check if note is a descriptive phrase/sentence (not a valid perfume note)
 * Examples: "fall part one", "none of us really changes over time", "a tendril of smoke lighter"
 * Also includes phrases that can have notes extracted: "the delicate scent of roses"
 */
function isDescriptivePhrase(name) {
  const normalized = normalizeName(name)
  let trimmed = normalized.trim()
  
  // Remove trailing punctuation for length check
  trimmed = removeTrailingPunctuation(trimmed)
  
  // Check if it's a valid multi-word note that should be kept as-is
  // Examples: "white birch wood", "ancient white oak", "crisp paper", "sweet red apple"
  if (isProtectedMultiWordNote(trimmed)) {
    return false // Don't treat as descriptive phrase
  }
  
  // Too long to be a perfume note (allow up to 50 chars for multi-word notes like "frosted pumpkin pecan cookies")
  if (trimmed.length > 50) {
    return true
  }
  
  // Contains sentence-like patterns
  // Multiple common words that form a phrase (6+ words suggests a sentence/phrase, not a note)
  // Allow 4-5 words for valid multi-word notes like "frosted pumpkin pecan cookies"
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  if (words.length >= 6) {
    return true
  }
  
  // Phrases that should be removed (no extractable notes)
  // Patterns like "tad dirty - tone that is very alluring...", "with every inhale", "he spritzes a touch of the 80s"
  const removePatterns = [
    /^tad\s+\w+.*alluring/i,
    /^tone\s+that\s+is/i,
    /^very\s+alluring/i,
    /^.*-\s+tone\s+that/i,
    /^with\s+every\s+inhale/i,
    /^he\s+spritzes/i,
    /^.*touch\s+of\s+the\s+\d+s$/i, // "touch of the 80s"
    /^.*\d+s$/i, // Ends with decade like "80s"
  ]
  
  for (const pattern of removePatterns) {
    if (pattern.test(trimmed)) {
      return true
    }
  }
  
  // Contains common phrase patterns that should be removed (no extraction possible)
  const phrasePatterns = [
    /\b(part\s+(one|two|three|1|2|3))\b/i,
    /\b(none\s+of\s+us)\b/i,
    /\b(changes?\s+over\s+time)\b/i,
    /\b(a\s+tendril\s+of)\b/i,
    /\b(lighter|heavier|stronger|weaker)\s+(than|then)\b/i,
    /\b(one\s+of\s+the)\b/i,
    /\b(all\s+of\s+the)\b/i,
    /\b(some\s+of\s+the)\b/i,
    // Phrases that fade/transition without extractable notes
    /\b(but|and|or)\s+that\s+(fades?|transitions?|turns?|becomes?|changes?)\s+(into|to|from)\b/i,
    /\b(fades?|transitions?|turns?|becomes?|changes?)\s+(into|to|from)\s+(the|a|an)\s+\w+\s+\w+/i,
    // Phrases that might contain extractable notes (these will be handled by extraction logic)
    /\b(scent|aroma|fragrance|hint|note|notes)\s+(of|with)\b/i,
    /\b(the|a|an)\s+\w+\s+(scent|aroma|fragrance)\s+of\b/i,
    /\bsmells?\s+like:?\b/i,
  ]
  
  for (const pattern of phrasePatterns) {
    if (pattern.test(trimmed)) {
      return true
    }
  }
  
  return false
}

/**
 * Pre-flight validation checks
 */
async function validateDatabase() {
  console.log("🔍 Running pre-flight checks...\n")
  
  try {
    // Test database connection
    await prisma.$connect()
    console.log("✅ Database connection successful")
    
    // Count notes and relations
    const noteCount = await prisma.perfumeNotes.count()
    const relationCount = await prisma.perfumeNoteRelation.count()
    
    console.log(`✅ Found ${noteCount} notes and ${relationCount} note relations\n`)
    
    return { noteCount, relationCount }
  } catch (error) {
    console.error("❌ Pre-flight check failed:", error.message)
    throw error
  }
}

/**
 * Post-cleanup validation
 */
async function validateCleanup(initialCounts) {
  console.log("\n🔍 Running post-cleanup validation...\n")
  
  try {
    const finalNoteCount = await prisma.perfumeNotes.count()
    const finalRelationCount = await prisma.perfumeNoteRelation.count()
    
    // Check for orphaned relations (relations whose noteId no longer exists)
    const existingNoteIds = (await prisma.perfumeNotes.findMany({ select: { id: true } })).map(n => n.id)
    const orphanedRelations = existingNoteIds.length > 0
      ? await prisma.perfumeNoteRelation.findMany({
          where: { noteId: { notIn: existingNoteIds } }
        })
      : await prisma.perfumeNoteRelation.findMany()
    
    if (orphanedRelations.length > 0) {
      console.error(`❌ Found ${orphanedRelations.length} orphaned relations!`)
      throw new Error("Orphaned relations detected")
    }
    
    console.log(`✅ Final counts: ${finalNoteCount} notes, ${finalRelationCount} relations`)
    console.log(`✅ No orphaned relations found`)
    console.log(`✅ All notes are valid`)
    
    return {
      notesRemoved: initialCounts.noteCount - finalNoteCount,
      relationsUpdated: initialCounts.relationCount - finalRelationCount
    }
  } catch (error) {
    console.error("❌ Post-cleanup validation failed:", error.message)
    throw error
  }
}

/**
 * Phase 1: Identify and merge duplicates
 */
async function identifyDuplicates() {
  console.log("🔍 Phase 1: Identifying duplicate notes...\n")
  
  const allNotes = await prisma.perfumeNotes.findMany({
    include: {
      perfumeNoteRelations: true
    }
  })
  
  // Group by normalized name (using space-to-hyphen normalization for duplicate detection)
  const notesByName = new Map()
  
  for (const note of allNotes) {
    const normalizedName = normalizeForDuplicateDetection(note.name)
    
    if (!notesByName.has(normalizedName)) {
      notesByName.set(normalizedName, [])
    }
    notesByName.get(normalizedName).push(note)
  }
  
  // Find duplicates
  const duplicates = []
  for (const [normalizedName, notes] of notesByName.entries()) {
    if (notes.length > 1) {
      // Count relations for each note
      const notesWithCounts = notes.map(note => ({
        ...note,
        relationCount: note.perfumeNoteRelations.length
      }))
      
      // Sort by:
      // 1. Prefer hyphenated version (e.g., "lily-of-the-valley" over "lily of the valley")
      // 2. Then by relation count (desc)
      // 3. Then by createdAt (asc)
      notesWithCounts.sort((a, b) => {
        // First, prefer hyphenated version
        const aHasHyphens = a.name.includes('-')
        const bHasHyphens = b.name.includes('-')
        if (aHasHyphens && !bHasHyphens) {
          return -1 // Prefer a (hyphenated)
        }
        if (!aHasHyphens && bHasHyphens) {
          return 1 // Prefer b (hyphenated)
        }
        
        // If both have same format, sort by relation count
        if (b.relationCount !== a.relationCount) {
          return b.relationCount - a.relationCount
        }
        
        // Finally, by creation date (older first)
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
      
      duplicates.push({
        normalizedName,
        notes: notesWithCounts
      })
    }
  }
  
  return duplicates
}

/**
 * Phase 1: Merge duplicates
 */
async function mergeDuplicates(duplicates, isDryRun) {
  if (duplicates.length === 0) {
    const msg = "✅ No duplicate notes found!\n"
    console.log(msg)
    if (isDryRun) addToReport("## Phase 1: Duplicate Notes\n\n✅ No duplicate notes found!\n")
    return { merged: 0, relationsUpdated: 0 }
  }
  
  const msg1 = `📊 Found ${duplicates.length} duplicate group(s):\n`
  console.log(msg1)
  if (isDryRun) {
    addToReport("## Phase 1: Duplicate Notes\n")
    addToReport(`**Found ${duplicates.length} duplicate group(s):**\n\n`)
  }
  
  let totalNotesToMerge = 0
  for (const dup of duplicates) {
    totalNotesToMerge += dup.notes.length - 1
    const consoleMsg = `  "${dup.normalizedName}" (${dup.notes.length} variants):`
    console.log(consoleMsg)
    if (isDryRun) {
      addToReport(`### "${dup.normalizedName}" (${dup.notes.length} variants)\n\n`)
      addToReport("| # | Note Name | ID | Relations | Action |\n")
      addToReport("|---|-----------|----|-----------|--------|\n")
    }
    
    dup.notes.forEach((note, index) => {
      const keep = index === 0 ? " (KEEP - canonical)" : " (MERGE)"
      const action = index === 0 ? "KEEP (canonical)" : "MERGE"
      const consoleMsg = `    ${index + 1}. "${note.name}" (${note.id}) - ${note.relationCount} relations${keep}`
      console.log(consoleMsg)
      if (isDryRun) {
        addToReport(`| ${index + 1} | "${note.name}" | ${note.id} | ${note.relationCount} | ${action} |\n`)
      }
    })
    console.log("")
    if (isDryRun) addToReport("\n")
  }
  
  const summaryMsg = `📋 Summary: ${totalNotesToMerge} notes will be merged into ${duplicates.length} canonical notes\n`
  console.log(summaryMsg)
  if (isDryRun) {
    addToReport(`**Summary:** ${totalNotesToMerge} notes will be merged into ${duplicates.length} canonical notes\n\n`)
  }
  
  if (isDryRun) {
    console.log("✅ Dry run complete for Phase 1.\n")
    return { merged: 0, relationsUpdated: 0 }
  }
  
  console.log("🔄 Starting merge process...\n")
  
  let mergedCount = 0
  let relationsUpdatedCount = 0
  
  // Use transaction for safety - increase timeout for large operations (2 minutes)
  await prisma.$transaction(
    async (tx) => {
      for (const dup of duplicates) {
      const canonicalNote = dup.notes[0] // Most used (or oldest if tie)
      const notesToMerge = dup.notes.slice(1)
      
      console.log(`\n📦 Merging "${dup.normalizedName}"`)
      console.log(`   Canonical: "${canonicalNote.name}" (${canonicalNote.id})`)
      
      for (const duplicateNote of notesToMerge) {
        try {
          console.log(`   → Merging "${duplicateNote.name}" (${duplicateNote.id})`)
          
          // Get all relations pointing to the duplicate note
          const relations = await tx.perfumeNoteRelation.findMany({
            where: { noteId: duplicateNote.id }
          })
          
          console.log(`     Found ${relations.length} relations to reassociate`)
          
          // Reassociate all relations to canonical note
          for (const relation of relations) {
            // Check if canonical note already has this relation (same perfume + noteType)
            const existingRelation = await tx.perfumeNoteRelation.findUnique({
              where: {
                perfumeId_noteId_noteType: {
                  perfumeId: relation.perfumeId,
                  noteId: canonicalNote.id,
                  noteType: relation.noteType
                }
              }
            })
            
            if (existingRelation) {
              // Relation already exists, just delete the duplicate relation
              await tx.perfumeNoteRelation.delete({
                where: { id: relation.id }
              })
              console.log(`     → Removed duplicate relation (already exists for canonical)`)
            } else {
              // Update relation to point to canonical note
              await tx.perfumeNoteRelation.update({
                where: { id: relation.id },
                data: { noteId: canonicalNote.id }
              })
              console.log(`     → Reassociated relation to canonical note`)
            }
            relationsUpdatedCount++
          }
          
          // Delete the duplicate note (CASCADE will handle any remaining relations)
          await tx.perfumeNotes.delete({
            where: { id: duplicateNote.id }
          })
          
          mergedCount++
          console.log(`     ✅ Merged successfully`)
        } catch (error) {
          console.error(`     ❌ Error merging: ${error.message}`)
          throw error // Rollback transaction
        }
      }
    }
  }, {
    maxWait: 120000, // 2 minutes max wait for transaction to start
    timeout: 120000, // 2 minutes timeout for transaction execution
  })
  
  console.log(`\n✅ Phase 1 complete: Merged ${mergedCount} duplicate notes, updated ${relationsUpdatedCount} relations\n`)
  
  return { merged: mergedCount, relationsUpdated: relationsUpdatedCount }
}

/**
 * Phase 2: Identify notes with invalid characters
 */
async function identifyInvalidNotes() {
  console.log("🔍 Phase 2: Identifying notes with invalid characters...\n")
  
  const allNotes = await prisma.perfumeNotes.findMany()
  
  const invalidNotes = []
  for (const note of allNotes) {
    // Skip slash-separated notes - they'll be handled in Phase 3
    if (note.name.includes('/')) {
      continue
    }
    
    if (!isValidNoteName(note.name)) {
      const cleanedName = cleanNoteName(note.name)
      if (cleanedName.length === 0) {
        // Name becomes empty after cleaning - mark for deletion
        invalidNotes.push({
          note,
          action: "delete",
          cleanedName: null
        })
      } else {
        invalidNotes.push({
          note,
          action: "clean",
          cleanedName: cleanedName
        })
      }
    }
  }
  
  return invalidNotes
}

/**
 * Phase 2: Clean invalid notes
 */
async function cleanInvalidNotes(invalidNotes, isDryRun) {
  if (invalidNotes.length === 0) {
    const msg = "✅ No invalid notes found!\n"
    console.log(msg)
    if (isDryRun) addToReport("## Phase 2: Invalid Characters\n\n✅ No invalid notes found!\n")
    return { cleaned: 0, deleted: 0, relationsUpdated: 0 }
  }
  
  const msg1 = `📊 Found ${invalidNotes.length} invalid note(s):\n`
  console.log(msg1)
  if (isDryRun) {
    addToReport("## Phase 2: Invalid Characters\n")
    addToReport(`**Found ${invalidNotes.length} invalid note(s):**\n\n`)
    addToReport("| Note Name | ID | Action | New Name |\n")
    addToReport("|-----------|----|--------|----------|\n")
  }
  
  for (const item of invalidNotes) {
    if (item.action === "delete") {
      const msg = `  ❌ "${item.note.name}" (${item.note.id}) - Will be deleted (empty after cleaning)`
      console.log(msg)
      if (isDryRun) {
        addToReport(`| "${item.note.name}" | ${item.note.id} | DELETE | (empty after cleaning) |\n`)
      }
    } else {
      const msg = `  🔧 "${item.note.name}" (${item.note.id}) → "${item.cleanedName}"`
      console.log(msg)
      if (isDryRun) {
        addToReport(`| "${item.note.name}" | ${item.note.id} | CLEAN | "${item.cleanedName}" |\n`)
      }
    }
  }
  console.log("")
  if (isDryRun) addToReport("\n")
  
  if (isDryRun) {
    console.log("✅ Dry run complete for Phase 2.\n")
    return { cleaned: 0, deleted: 0, relationsUpdated: 0 }
  }
  
  console.log("🔄 Starting cleanup process...\n")
  
  let cleanedCount = 0
  let deletedCount = 0
  let relationsUpdatedCount = 0
  
  // Process in batches to avoid transaction timeouts
  const BATCH_SIZE = 50
  const batches = []
  for (let i = 0; i < invalidNotes.length; i += BATCH_SIZE) {
    batches.push(invalidNotes.slice(i, i + BATCH_SIZE))
  }
  
  console.log(`📦 Processing ${invalidNotes.length} invalid notes in ${batches.length} batch(es) of ${BATCH_SIZE}...\n`)
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    console.log(`\n🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)...`)
    
    // Use transaction for safety - increase timeout for large operations
    await prisma.$transaction(async (tx) => {
      for (const item of batch) {
      try {
        const { note, action, cleanedName } = item
        
        console.log(`\n🔧 Processing "${note.name}" (${note.id})`)
        
        if (action === "delete") {
          // Get relations before deletion for logging
          const relations = await tx.perfumeNoteRelation.findMany({
            where: { noteId: note.id }
          })
          
          console.log(`   Found ${relations.length} relations - will be removed (note is invalid)`)
          
          // Delete note (CASCADE will remove relations)
          await tx.perfumeNotes.delete({
            where: { id: note.id }
          })
          
          deletedCount++
          console.log(`   ✅ Deleted invalid note`)
        } else {
          // Get relations to reassociate
          const relations = await tx.perfumeNoteRelation.findMany({
            where: { noteId: note.id }
          })
          
          console.log(`   Found ${relations.length} relations to reassociate`)
          
          // Check if cleaned name already exists
          let cleanedNote = await tx.perfumeNotes.findUnique({
            where: { name: cleanedName }
          })
          
          if (!cleanedNote) {
            // No existing cleaned note - update the current note's name
            await tx.perfumeNotes.update({
              where: { id: note.id },
              data: { name: cleanedName }
            })
            cleanedNote = { ...note, name: cleanedName }
            console.log(`   Updated note name to cleaned version: "${cleanedName}"`)
          } else {
            // Cleaned note already exists - reassociate relations and delete invalid note
            console.log(`   Found existing cleaned note: "${cleanedName}" (${cleanedNote.id})`)
            
            // Reassociate relations
            for (const relation of relations) {
              // Check if cleaned note already has this relation
              const existingRelation = await tx.perfumeNoteRelation.findUnique({
                where: {
                  perfumeId_noteId_noteType: {
                    perfumeId: relation.perfumeId,
                    noteId: cleanedNote.id,
                    noteType: relation.noteType
                  }
                }
              })
              
              if (existingRelation) {
                // Relation already exists, delete duplicate
                await tx.perfumeNoteRelation.delete({
                  where: { id: relation.id }
                })
                console.log(`   → Removed duplicate relation (already exists for cleaned note)`)
              } else {
                // Update relation to point to cleaned note
                await tx.perfumeNoteRelation.update({
                  where: { id: relation.id },
                  data: { noteId: cleanedNote.id }
                })
                console.log(`   → Reassociated relation to cleaned note`)
              }
              relationsUpdatedCount++
            }
            
            // Delete the invalid note (relations already reassociated)
            await tx.perfumeNotes.delete({
              where: { id: note.id }
            })
            console.log(`   ✅ Deleted invalid note, kept existing cleaned version`)
          }
          
          cleanedCount++
        }
      } catch (error) {
        console.error(`   ❌ Error processing: ${error.message}`)
        throw error // Rollback transaction
      }
    }
  })
  }
  
  console.log(`\n✅ Phase 2 complete: Cleaned ${cleanedCount} notes, deleted ${deletedCount} notes, updated ${relationsUpdatedCount} relations\n`)
  
  return { cleaned: cleanedCount, deleted: deletedCount, relationsUpdated: relationsUpdatedCount }
}

// Leading words that are stopwords but often start valid scent notes; never strip these.
const PREFIX_STOPWORDS_NEVER_STRIP = ['hot', 'old', 'cold', 'grey', 'gray']
// Optional: add more prefixes to send to AI for confirmation (e.g. 'warm', 'cool', 'sweet', 'fresh').
const ADDITIONAL_CONFIRM_PREFIXES = []
const CONFIRM_PREFIXES = [...PREFIX_STOPWORDS_NEVER_STRIP, ...ADDITIONAL_CONFIRM_PREFIXES]

/**
 * Extract note from stopword-prefixed phrase
 * Examples: "and vanilla" → "vanilla", "of roses" → "roses", "base Bourbon Vetiver" → "Bourbon Vetiver"
 * Does NOT strip "hot", "old", "cold", "grey", "gray" (valid: hot leather, old makeup, hot melted wax, grey iris).
 */
function extractNoteFromStopwordPrefix(name, existingNotes) {
  const normalized = normalizeName(name)
  const trimmed = normalized.trim()
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)

  // If first word is a "never strip" prefix, keep the full phrase as-is (don't extract)
  if (words.length > 1 && PREFIX_STOPWORDS_NEVER_STRIP.includes(normalizeName(words[0]))) {
    return null
  }

  // Remove "base" prefix (e.g., "base Bourbon Vetiver" → "Bourbon Vetiver")
  if (words.length > 1 && normalizeName(words[0]) === 'base') {
    const candidate = words.slice(1).join(' ')

    // Check if candidate matches an existing note
    const foundNote = existingNotes.find(n =>
      normalizeName(n.name) === normalizeName(candidate)
    )
    if (foundNote) {
      return foundNote.name
    }

    // Check if candidate is a valid note
    const wordCount = candidate.split(/\s+/).length
    if (wordCount >= 1 && wordCount <= 5 && candidate.length <= 50 && !isStopword(candidate)) {
      return candidate
    }
  }

  // If first word is a stopword, try to extract the note from the rest
  if (words.length > 1 && isStopword(words[0])) {
    const candidate = words.slice(1).join(' ')

    // Check if candidate matches an existing note
    const foundNote = existingNotes.find(n =>
      normalizeName(n.name) === normalizeName(candidate)
    )
    if (foundNote) {
      return foundNote.name
    }

    // Check if candidate is a valid note (1-5 words, reasonable length, not a stopword)
    const wordCount = candidate.split(/\s+/).length
    if (wordCount >= 1 && wordCount <= 5 && candidate.length <= 50 && !isStopword(candidate)) {
      return candidate
    }
  }

  return null
}

/**
 * Clean note by removing suffixes like "& more", "and more", etc.
 * Examples: "vanilla & more" → "vanilla", "rose and more" → "rose"
 */
function removeSuffixes(name) {
  const normalized = normalizeName(name)
  let trimmed = normalized.trim()
  
  // Remove common suffixes
  const suffixes = [
    /\s+&\s+more$/i,
    /\s+and\s+more$/i,
    /\s+&$/, // Just "&" at the end
  ]
  
  for (const suffix of suffixes) {
    trimmed = trimmed.replace(suffix, '').trim()
  }
  
  return trimmed.length > 0 && trimmed !== normalized ? trimmed : null
}

/**
 * Phase 3: Identify stopwords and descriptive phrases
 */
async function identifyStopwords() {
  console.log("🔍 Phase 3: Identifying stopword and descriptive phrase notes...\n")
  
  const allNotes = await prisma.perfumeNotes.findMany({
    include: {
      perfumeNoteRelations: true
    }
  })
  
  const invalidNotes = []
  const extractablePhrases = []
  const notesToConfirm = []
  
  for (const note of allNotes) {
    // Skip notes that are already valid and shouldn't be modified
    // Check if the note name (normalized) matches a known valid note pattern
    const normalized = normalizeName(note.name)
    let trimmed = removeTrailingPunctuation(normalized.trim())
    
    // First, check if we need to remove suffixes like "& more"
    const cleanedSuffix = removeSuffixes(note.name)
    if (cleanedSuffix && cleanedSuffix !== normalized) {
      // This note has a suffix that should be removed - treat it as extractable
      const extractedFromSuffix = extractNoteFromStopwordPrefix(cleanedSuffix, allNotes) || cleanedSuffix
      extractablePhrases.push({ note, type: 'suffix-removal', extractedNote: extractedFromSuffix })
      continue
    }
    
    // Valid multi-word notes that should be kept as-is
    if (isProtectedMultiWordNote(trimmed)) {
      continue // Skip this note, it's already valid
    }
    
    // Also check patterns for similar valid notes
    const validMultiWordPatterns = [
      /^(white|black|red|green|ancient)\s+\w+\s+wood$/i, // "white birch wood"
      /^(white|black|ancient)\s+\w+\s+oak$/i, // "ancient white oak"
      /^(crisp)\s+\w+$/i, // "crisp paper"
      /^(sweet)\s+(red|green|white|black)\s+\w+$/i, // "sweet red apple"
      /^(motor)\s+oil$/i, // "motor oil"
      /^(coppery)\s+blood$/i, // "coppery blood"
    ]
    
    let isValidNote = false
    for (const pattern of validMultiWordPatterns) {
      if (pattern.test(trimmed)) {
        isValidNote = true
        break
      }
    }
    
    if (isValidNote) {
      continue // Skip this note, it's already valid
    }
    
    // First check for slash-separated notes (e.g., "opoponax/resins")
    const slashSplit = splitBySlash(note.name, allNotes)
    if (slashSplit && slashSplit.length > 1) {
      extractablePhrases.push({ note, type: 'slash-separated', extractedNote: slashSplit })
      continue
    }

    // Explicit policy for recurring noisy/bad phrases.
    // Prefer extraction when salvageable; otherwise mark as invalid.
    const knownBadClassification = classifyKnownBadPhrase(note.name, allNotes)
    if (knownBadClassification) {
      if (knownBadClassification.action === "extract") {
        extractablePhrases.push({
          note,
          type: knownBadClassification.type,
          extractedNote: knownBadClassification.extractedNote
        })
      } else {
        invalidNotes.push({
          note,
          type: knownBadClassification.type,
          extractedNote: null
        })
      }
      continue
    }

    // Note names with slug/ID suffix (e.g. "lemon-adamo-8du3rk") → extract leading word.
    const slugIdClassification = classifyNoteWithSlugId(note.name, allNotes)
    if (slugIdClassification && slugIdClassification.action === "extract") {
      extractablePhrases.push({
        note,
        type: slugIdClassification.type,
        extractedNote: slugIdClassification.extractedNote
      })
      continue
    }

    // Check if it's a pure stopword (just the stopword itself)
    if (isStopword(note.name)) {
      invalidNotes.push({ note, type: 'stopword', extractedNote: null })
    } 
    // Check if it starts with a stopword (e.g., "and vanilla")
    else {
      const extractedFromStopword = extractNoteFromStopwordPrefix(note.name, allNotes)
      if (extractedFromStopword) {
        // After removing stopword prefix, check if there are multiple distinct notes
        // e.g., "the fabulous vanilla bean orchid" → "fabulous vanilla bean orchid" → should be ["vanilla bean", "orchid"]
        const afterStopwordRemoval = note.name.replace(/^(the|a|an|and|of|with|but|or|in|on|at|to|for|from|by)\s+/i, '').trim()
        const distinctNotes = detectMultipleDistinctNotes(afterStopwordRemoval, allNotes)
        if (distinctNotes && distinctNotes.length > 1) {
          extractablePhrases.push({ note, type: 'multiple-distinct', extractedNote: distinctNotes })
        } else {
          extractablePhrases.push({ note, type: 'stopword-prefix', extractedNote: extractedFromStopword })
        }
      }
      // Multi-word notes starting with hot/old/cold/grey/gray (and optional more): send to AI to confirm valid
      else if (trimmed.split(/\s+/).filter(w => w.length > 0).length > 1 &&
          CONFIRM_PREFIXES.includes(normalizeName(trimmed.split(/\s+/)[0]))) {
        notesToConfirm.push({ note })
      }
      // Check if it's a descriptive phrase
      // NOTE: Descriptive phrases are now handled by AI script for better accuracy
      // We'll mark them for AI processing instead of trying to extract here
      else if (isDescriptivePhrase(note.name)) {
        // Skip simple cases that we can handle with rules (like "& more" suffix, "base" prefix)
        const cleanedSuffix = removeSuffixes(note.name)
        if (cleanedSuffix && cleanedSuffix !== normalizeName(note.name)) {
          // Simple suffix removal - handle it here
          const extractedFromSuffix = extractNoteFromStopwordPrefix(cleanedSuffix, allNotes) || cleanedSuffix
          extractablePhrases.push({ note, type: 'suffix-removal', extractedNote: extractedFromSuffix })
        } else {
          // For now, still try rule-based extraction as fallback
          // But mark complex ones for AI processing in the complete workflow
          const extractedNote = extractNoteFromPhrase(note.name, allNotes)
          if (extractedNote) {
            extractablePhrases.push({ note, type: 'extractable', extractedNote })
          } else {
            // No extraction possible with rules - mark for AI
            invalidNotes.push({ note, type: 'descriptive-ai', extractedNote: null })
          }
        }
      }
      // Check for multiple distinct notes only when phrase is long or clearly descriptive
      // (avoids splitting valid 3–4 word notes like "wild bergamot tea", "white pepper flowers")
      else {
        const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length
        const startsWithArticle = /^(the|a|an)\s+/i.test(note.name)
        if (wordCount >= 5 || (wordCount >= 4 && startsWithArticle)) {
          const distinctNotes = detectMultipleDistinctNotes(note.name, allNotes)
          if (distinctNotes && distinctNotes.length > 1) {
            extractablePhrases.push({ note, type: 'multiple-distinct', extractedNote: distinctNotes })
          }
        }
      }
    }
  }
  
  return { invalidNotes, extractablePhrases, notesToConfirm }
}

/**
 * Phase 3: Extract notes from phrases and remove stopwords/descriptive phrases
 */
async function removeStopwords(identificationResults, isDryRun) {
  const { invalidNotes, extractablePhrases, notesToConfirm = [] } = identificationResults
  
  const totalInvalid = invalidNotes.length
  const totalExtractable = extractablePhrases.length
  const totalToConfirm = notesToConfirm.length
  
  if (totalInvalid === 0 && totalExtractable === 0 && totalToConfirm === 0) {
    console.log("✅ No stopword or descriptive phrase notes found!\n")
    return { removed: 0, relationsRemoved: 0, relationsReassociated: 0 }
  }
  
  const msg1 = `📊 Found ${totalInvalid} invalid note(s), ${totalExtractable} extractable phrase(s)${totalToConfirm > 0 ? `, ${totalToConfirm} note(s) to confirm with AI` : ''}:\n`
  console.log(msg1)
  if (isDryRun) {
    addToReport("## Phase 3: Stopwords & Descriptive Phrases\n")
    addToReport(`**Found ${totalInvalid} invalid note(s), ${totalExtractable} extractable phrase(s)${totalToConfirm > 0 ? `, ${totalToConfirm} note(s) to confirm with AI` : ''}:**\n\n`)
  }
  
  // Show extractable phrases
  if (totalExtractable > 0) {
    console.log("  Phrases with extractable notes:")
    if (isDryRun) {
      addToReport("### Phrases with Extractable Notes\n\n")
      addToReport("| Original Phrase | Extracted Note(s) | Type | Relations |\n")
      addToReport("|-----------------|-------------------|------|-----------|\n")
    }
    for (const item of extractablePhrases) {
      const relationCount = item.note.perfumeNoteRelations.length
      const typeLabel = item.type || 'descriptive'
      const extractedNotes = Array.isArray(item.extractedNote) ? item.extractedNote : [item.extractedNote]
      const extractedDisplay = extractedNotes.map(n => `"${n}"`).join(', ')
      const msg = `  🔧 "${item.note.name}" → ${extractedDisplay} (${relationCount} relations will be reassociated)`
      console.log(msg)
      if (isDryRun) {
        addToReport(`| "${item.note.name}" | ${extractedDisplay} | ${typeLabel} | ${relationCount} |\n`)
      }
    }
    console.log("")
    if (isDryRun) addToReport("\n")
  }
  
  // Show invalid notes
  if (totalInvalid > 0) {
    console.log("  Invalid notes (will be removed):")
    if (isDryRun) {
      addToReport("### Invalid Notes (Will Be Removed)\n\n")
      addToReport("| Note Name | ID | Type | Relations |\n")
      addToReport("|-----------|----|------|-----------|\n")
    }
    let totalRelations = 0
    for (const item of invalidNotes) {
      const relationCount = item.note.perfumeNoteRelations.length
      totalRelations += relationCount
      const msg = `  ❌ "${item.note.name}" (${item.note.id}) - ${relationCount} relations will be removed (${item.type})`
      console.log(msg)
      if (isDryRun) {
        addToReport(`| "${item.note.name}" | ${item.note.id} | ${item.type} | ${relationCount} |\n`)
      }
    }
    console.log("")
    const descriptiveAiCount = invalidNotes.filter(i => i.type === 'descriptive-ai').length
    const removedByJs = totalInvalid - descriptiveAiCount
    const summaryMsg = descriptiveAiCount > 0
      ? `📋 Summary: ${totalInvalid} invalid notes (${removedByJs} will be removed by JS, ${descriptiveAiCount} sent to Crew AI)`
      : `📋 Summary: ${totalInvalid} invalid notes will be removed, ${totalRelations} relations will be deleted`
    console.log(summaryMsg)
    if (isDryRun) {
      const summaryText = descriptiveAiCount > 0
        ? `**Summary:** ${totalInvalid} invalid notes (${removedByJs} will be removed by JS, ${descriptiveAiCount} sent to Crew AI)\n\n`
        : `**Summary:** ${totalInvalid} invalid notes will be removed, ${totalRelations} relations will be deleted\n\n`
      addToReport(summaryText)
    }
  }
  
  if (totalExtractable > 0) {
    const totalExtractedRelations = extractablePhrases.reduce((sum, item) => 
      sum + item.note.perfumeNoteRelations.length, 0)
    const msg = `📋 Summary: ${totalExtractable} phrases will be converted, ${totalExtractedRelations} relations will be reassociated`
    console.log(msg)
    if (isDryRun) {
      addToReport(`**Summary:** ${totalExtractable} phrases will be converted, ${totalExtractedRelations} relations will be reassociated\n\n`)
    }
  }
  
  // Notes to confirm with AI (e.g. hot leather, old makeup) — reported only; no JS change
  if (totalToConfirm > 0) {
    console.log("  Notes to confirm with AI (valid scent notes?):")
    if (isDryRun) {
      addToReport("### Notes to Confirm (AI Validation)\n\n")
      addToReport("| Note Name | ID | Relations |\n")
      addToReport("|-----------|----|-----------|\n")
    }
    for (const item of notesToConfirm) {
      const relationCount = item.note.perfumeNoteRelations.length
      console.log(`  🔍 "${item.note.name}" (${item.note.id}) - ${relationCount} relations`)
      if (isDryRun) {
        addToReport(`| "${item.note.name}" | ${item.note.id} | ${relationCount} |\n`)
      }
    }
    console.log("")
    if (isDryRun) {
      addToReport(`**Summary:** ${totalToConfirm} note(s) will be sent to AI for confirmation (no change unless AI says invalid).\n\n`)
    }
  }
  console.log("")
  
  if (isDryRun) {
    console.log("✅ Dry run complete for Phase 3.\n")
    return { removed: 0, relationsRemoved: 0, relationsReassociated: 0 }
  }
  
  console.log("🔄 Starting processing...\n")
  
  let removedCount = 0
  let relationsRemovedCount = 0
  let relationsReassociatedCount = 0
  
  // Use transaction for safety - increase timeout for large operations
  await prisma.$transaction(async (tx) => {
    // First, handle extractable phrases
    for (const item of extractablePhrases) {
      try {
        const { note, extractedNote } = item
        const extractedNotes = Array.isArray(extractedNote) ? extractedNote : [extractedNote]
        
        console.log(`\n🔧 Processing phrase "${note.name}" → extracting ${extractedNotes.length > 1 ? 'notes' : 'note'}: ${extractedNotes.map(n => `"${n}"`).join(', ')}`)
        
        // Get all relations
        const relations = await tx.perfumeNoteRelation.findMany({
          where: { noteId: note.id }
        })
        
        console.log(`   Found ${relations.length} relations to reassociate`)
        
        // Find or create all extracted notes
        const targetNotes = []
        for (const extracted of extractedNotes) {
          let targetNote = await tx.perfumeNotes.findUnique({
            where: { name: extracted }
          })
          
          if (!targetNote) {
            // Create the extracted note
            targetNote = await tx.perfumeNotes.create({
              data: { name: extracted }
            })
            console.log(`   Created note: "${extracted}"`)
          } else {
            console.log(`   Found existing note: "${extracted}"`)
          }
          targetNotes.push(targetNote)
        }
        
        // Reassociate relations to all extracted notes
        // If multiple notes extracted, create relations to all of them (perfume has all these notes)
        for (const relation of relations) {
          let relationProcessed = false
          
          for (const targetNote of targetNotes) {
            // Check if target note already has this relation
            const existingRelation = await tx.perfumeNoteRelation.findUnique({
              where: {
                perfumeId_noteId_noteType: {
                  perfumeId: relation.perfumeId,
                  noteId: targetNote.id,
                  noteType: relation.noteType
                }
              }
            })
            
            if (!existingRelation) {
              // Create relation to this extracted note
              await tx.perfumeNoteRelation.create({
                data: {
                  perfumeId: relation.perfumeId,
                  noteId: targetNote.id,
                  noteType: relation.noteType
                }
              })
              relationProcessed = true
              relationsReassociatedCount++
            }
          }
          
          // Delete the original relation (we've created new ones for extracted notes)
          await tx.perfumeNoteRelation.delete({
            where: { id: relation.id }
          })
          
          if (relationProcessed) {
            console.log(`   → Reassociated relation to ${targetNotes.length} extracted note(s)`)
          } else {
            console.log(`   → Removed relation (all extracted notes already have this relation)`)
          }
        }
        
        // Delete the phrase note
        await tx.perfumeNotes.delete({
          where: { id: note.id }
        })
        
        console.log(`   ✅ Extracted ${extractedNotes.length} note(s) and reassociated ${relations.length} relations`)
      } catch (error) {
        console.error(`   ❌ Error processing: ${error.message}`)
        throw error // Rollback transaction
      }
    }
    
    // Then, handle invalid notes (stopwords and non-extractable phrases).
    // Skip descriptive-ai: those are left for Crew AI and apply-ai-recommendations.js.
    for (const item of invalidNotes) {
      try {
        const { note, type } = item
        if (type === "descriptive-ai") {
          console.log(`\n⏭️  Skipping "${note.name}" (${note.id}) - sent to Crew AI (descriptive-ai)`)
          continue
        }
        console.log(`\n🗑️  Removing ${type} "${note.name}" (${note.id})`)
        
        const relationCount = note.perfumeNoteRelations.length
        console.log(`   Found ${relationCount} relations - will be removed (${type} is not a valid note)`)
        
        // Delete note (CASCADE will automatically remove relations)
        await tx.perfumeNotes.delete({
          where: { id: note.id }
        })
        
        removedCount++
        relationsRemovedCount += relationCount
        console.log(`   ✅ Removed ${type} and ${relationCount} relations`)
      } catch (error) {
        console.error(`   ❌ Error removing: ${error.message}`)
        throw error // Rollback transaction
      }
    }
    }, {
      maxWait: 60000, // 1 minute max wait for transaction to start
      timeout: 60000, // 1 minute timeout per batch
    })
  
  console.log(`\n✅ Phase 3 complete:`)
  console.log(`   • Removed ${removedCount} invalid notes`)
  console.log(`   • Extracted notes from ${extractablePhrases.length} phrases`)
  console.log(`   • Deleted ${relationsRemovedCount} relations`)
  console.log(`   • Reassociated ${relationsReassociatedCount} relations\n`)
  
  return { 
    removed: removedCount, 
    relationsRemoved: relationsRemovedCount,
    relationsReassociated: relationsReassociatedCount
  }
}

/**
 * Main cleanup function
 */
async function cleanNotes() {
  try {
    const duplicatesOnly = process.argv.includes('--duplicates-only')
    
    const header = "=".repeat(60)
    const title = duplicatesOnly 
      ? "🔍 Duplicate Detection Only"
      : "🧹 Clean Duplicate and Erroneous Notes"
    console.log(header)
    console.log(title)
    console.log(header)
    console.log("")
    
    if (isDryRun) {
      const msg = "⚠️  DRY RUN MODE - No changes will be made\n"
      console.log(msg)
      if (!duplicatesOnly) {
        addToReport("# Clean Duplicate and Erroneous Notes - Dry Run Report\n\n")
        addToReport(`**Generated:** ${new Date().toISOString()}\n\n`)
        addToReport("⚠️ **DRY RUN MODE** - No changes will be made\n\n")
        addToReport("---\n\n")
      }
    } else {
      console.log("⚠️  IMPORTANT: Ensure you have run `npm run db:backup` before proceeding!\n")
    }
    
    // Pre-flight validation
    const initialCounts = await validateDatabase()
    if (isDryRun && !duplicatesOnly) {
      addToReport("## Pre-Flight Validation\n\n")
      addToReport(`- **Total Notes:** ${initialCounts.noteCount}\n`)
      addToReport(`- **Total Relations:** ${initialCounts.relationCount}\n\n`)
      addToReport("---\n\n")
    }
    
    // Phase 1: Merge duplicates (initial pass)
    console.log("\n" + "=".repeat(60))
    console.log("PHASE 1: Duplicate Detection & Merge")
    console.log("=".repeat(60) + "\n")
    const duplicates1 = await identifyDuplicates()
    const phase1Results = await mergeDuplicates(duplicates1, isDryRun)
    
    // If duplicates-only mode, exit after Phase 1 to prevent loops
    if (duplicatesOnly) {
      if (!isDryRun) {
        console.log("\n✅ Duplicate detection complete!")
      }
      return
    }
    
    // Phase 2: Clean invalid characters
    console.log("\n" + "=".repeat(60))
    console.log("PHASE 2: Clean Invalid Characters")
    console.log("=".repeat(60) + "\n")
    const invalidNotes = await identifyInvalidNotes()
    const phase2Results = await cleanInvalidNotes(invalidNotes, isDryRun)
    
    // Phase 2.5: Merge duplicates again (cleaning may have created new duplicates)
    if (!isDryRun && phase2Results.cleaned > 0) {
      console.log("\n" + "=".repeat(60))
      console.log("PHASE 2.5: Merge Duplicates (After Cleaning)")
      console.log("=".repeat(60) + "\n")
      const duplicates2 = await identifyDuplicates()
      const phase2_5Results = await mergeDuplicates(duplicates2, isDryRun)
      // Add to phase2 results
      phase2Results.merged = (phase2Results.merged || 0) + phase2_5Results.merged
      phase2Results.relationsUpdated = (phase2Results.relationsUpdated || 0) + phase2_5Results.relationsUpdated
    }
    
    // Phase 3: Extract notes from phrases and remove stopwords
    console.log("\n" + "=".repeat(60))
    console.log("PHASE 3: Extract Notes from Phrases & Remove Stopwords")
    console.log("=".repeat(60) + "\n")
    const invalidPhraseNotes = await identifyStopwords()
    const phase3Results = await removeStopwords(invalidPhraseNotes, isDryRun)
    
    // Phase 3.5: Merge duplicates again (extraction may have created new duplicates)
    // This catches cases like "and vanilla" → "vanilla" when "vanilla" already exists
    if (!isDryRun && (phase3Results.relationsReassociated > 0 || phase3Results.removed > 0)) {
      console.log("\n" + "=".repeat(60))
      console.log("PHASE 3.5: Merge Duplicates (After Extraction/Stopword Removal)")
      console.log("=".repeat(60) + "\n")
      const duplicates3 = await identifyDuplicates()
      const phase3_5Results = await mergeDuplicates(duplicates3, isDryRun)
      // Add to phase3 results
      phase3Results.merged = (phase3Results.merged || 0) + phase3_5Results.merged
      phase3Results.relationsUpdated = (phase3Results.relationsUpdated || 0) + phase3_5Results.relationsUpdated
    }
    
    // Post-cleanup validation
    if (!isDryRun) {
      const validationResults = await validateCleanup(initialCounts)
      
      // Final summary
      console.log("=".repeat(60))
      console.log("\n📊 CLEANUP SUMMARY")
      console.log("=".repeat(60))
      console.log(`\nPhase 1 - Initial Duplicates:`)
      console.log(`  • Merged: ${phase1Results.merged} notes`)
      console.log(`  • Relations updated: ${phase1Results.relationsUpdated}`)
      console.log(`\nPhase 2 - Invalid Characters:`)
      console.log(`  • Cleaned: ${phase2Results.cleaned} notes`)
      console.log(`  • Deleted: ${phase2Results.deleted} notes`)
      console.log(`  • Relations updated: ${phase2Results.relationsUpdated}`)
      if (phase2Results.merged > 0) {
        console.log(`\nPhase 2.5 - Duplicates After Cleaning:`)
        console.log(`  • Additional merged: ${phase2Results.merged} notes`)
        console.log(`  • Additional relations updated: ${phase2Results.relationsUpdated - (phase2Results.cleaned + phase2Results.deleted)}`)
      }
      console.log(`\nPhase 3 - Stopwords & Descriptive Phrases:`)
      console.log(`  • Removed: ${phase3Results.removed} invalid notes`)
      if (phase3Results.relationsReassociated > 0) {
        console.log(`  • Notes extracted from phrases: Yes`)
        console.log(`  • Relations reassociated: ${phase3Results.relationsReassociated}`)
      }
      console.log(`  • Relations removed: ${phase3Results.relationsRemoved}`)
      if (phase3Results.merged > 0) {
        console.log(`\nPhase 3.5 - Duplicates After Extraction:`)
        console.log(`  • Additional merged: ${phase3Results.merged} notes`)
        console.log(`  • Additional relations updated: ${phase3Results.relationsUpdated || 0}`)
      }
      console.log(`\nTotal:`)
      console.log(`  • Notes removed: ${validationResults.notesRemoved}`)
      const totalRelationsAffected = phase1Results.relationsUpdated + 
        (phase2Results.relationsUpdated || 0) + 
        phase3Results.relationsRemoved +
        (phase3Results.relationsUpdated || 0)
      console.log(`  • Relations affected: ${totalRelationsAffected}`)
      console.log(`\n✅ Cleanup completed successfully!`)
      console.log(`\n💡 If you need to rollback, use: npm run db:restore`)
    } else {
      console.log("\n✅ Dry run completed successfully!")
      console.log("   Run without --dry-run to apply changes.")
      
      // Add summary to report
      addToReport("## Summary\n\n")
      addToReport(`- **Phase 1 - Initial Duplicates:** ${phase1Results.merged} notes will be merged, ${phase1Results.relationsUpdated} relations updated\n`)
      addToReport(`- **Phase 2 - Invalid Characters:** ${phase2Results.cleaned} notes cleaned, ${phase2Results.deleted} notes deleted, ${phase2Results.relationsUpdated} relations updated\n`)
      if (phase2Results.merged > 0) {
        addToReport(`- **Phase 2.5 - Duplicates After Cleaning:** ${phase2Results.merged} additional notes will be merged\n`)
      }
      addToReport(`- **Phase 3 - Stopwords & Phrases:** ${phase3Results.removed} notes removed, ${phase3Results.relationsReassociated} relations reassociated, ${phase3Results.relationsRemoved} relations removed\n`)
      if (phase3Results.merged > 0) {
        addToReport(`- **Phase 3.5 - Duplicates After Extraction:** ${phase3Results.merged} additional notes will be merged\n`)
      }
      addToReport("\n---\n\n")
      addToReport("✅ **Dry run completed successfully!**\n\n")
      addToReport("To apply these changes, run:\n```bash\nnode scripts/clean-notes.js\n```\n\n")
      addToReport("**⚠️ Remember to backup first:**\n```bash\nnpm run db:backup\n```\n")
    }
    
    // Save report if in dry-run mode
    if (isDryRun) {
      saveReport()
    }
    
  } catch (error) {
    console.error("\n❌ Cleanup failed:", error.message)
    console.error(error.stack)
    throw error
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    await cleanNotes()
  } catch (error) {
    console.error("Fatal error:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("clean-notes.js")) {
  main()
}


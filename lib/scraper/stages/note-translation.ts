import { ChatOpenAI } from "@langchain/openai"
import { canonicalizeNoteLayers } from "@/lib/scraper/canonical-notes"
import { getLlmInvocationText, parseNotesFromLlmResponse } from "@/lib/scraper/stages/llm-extraction"

// ---------------------------------------------------------------------------
// Note translation (non-English → English)
// ---------------------------------------------------------------------------

// ASCII-only check is insufficient for French (musc, santal, vanille are all ASCII).
// We also flag known non-English perfumery words explicitly.
const KNOWN_NON_ENGLISH_NOTE_WORDS = new Set([
  "musc",
  "vanille",
  "ambre",
  "bois",
  "encens",
  "tabac",
  "cèdre",
  "cedre",
  "santal",
  "feve",
  "fève",
  "oud",
  "fleur",
  "violette",
  "trandafir",
  "mosc",
  "vanilie",
  "iasomie",
  "ambra",
  "rosa",
  "ámbar",
  "sándalo",
  "madera",
  "almizle",
  // Italian
  "muschio",
  "gelsomino",
  "sandalo",
  "legno",
  "cedro",
  // German (lowercase tokens)
  "moschus",
  "sandelholz",
  // Dutch
  "roos",
  "muskus",
  "sandelhout",
  // Portuguese
  "ambar",
  "almiscar",
  "almíscar",
])

function allNotesEnglish(notes: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] }): boolean {
  const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
  if (all.length === 0) return true
  return all.every(n => {
    const trimmed = n.trim().toLowerCase()
    // Non-ASCII characters → definitely non-English
    if (/[^\x00-\x7f]/.test(trimmed)) return false
    // Check each word against known non-English perfumery vocabulary
    return !trimmed.split(/\s+/).some(word => KNOWN_NON_ENGLISH_NOTE_WORDS.has(word))
  })
}

async function translateNotesToEnglish(
  llm: ChatOpenAI,
  notes: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
): Promise<{ openNotes: string[]; heartNotes: string[]; baseNotes: string[] }> {
  const mapped = canonicalizeNoteLayers(notes)
  if (allNotesEnglish(mapped)) return mapped
  try {
    const response = await llm.invoke([
      {
        role: "system",
        content: `Translate these perfume/fragrance note names to English. Return ONLY a JSON object: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}. Keep notes that are already English as-is. Translate each note to its standard English perfumery term (e.g. "trandafir" → "rose", "mosc" → "musk", "vanilie" → "vanilla", "tutun" → "tobacco", "paciuli" → "patchouli", "iasomie" → "jasmine", "ambra" → "amber", "lemn de santal" → "sandalwood"). Lowercase only. No explanation.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          openNotes: mapped.openNotes,
          heartNotes: mapped.heartNotes,
          baseNotes: mapped.baseNotes,
        }),
      },
    ])
    const translated = parseNotesFromLlmResponse(getLlmInvocationText(response))
    const total = translated.openNotes.length + translated.heartNotes.length + translated.baseNotes.length
    return total > 0 ? translated : mapped
  } catch {
    return mapped
  }
}
export { translateNotesToEnglish, allNotesEnglish }

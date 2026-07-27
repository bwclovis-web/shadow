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
  "zafferano",
  "foglie",
  "foglia",
  "essenza",
  "assoluta",
  "estratto",
  "bulgara",
  "turca",
  "bergamotto",
  "limone",
  "vaniglia",
  "pepe",
  "fiori",
  "fiore",
  "scorza",
  "arancia",
  "arancio",
  "resina",
  "legni",
  "spezie",
  "spezia",
  "incenso",
  "cuoio",
  "muschi",
  "fava",
  "carota",
  "rizomi",
  "rizoma",
  "spruzzi",
  "marini",
  "marino",
  "italiano",
  "italiana",
  "bianchi",
  "bianco",
  "bianche",
  "accordo",
  "daim",
  "violetta",
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

/** Italian / Romance phrasing that ASCII vocabulary alone often misses. */
const NON_ENGLISH_NOTE_PHRASE_RE =
  /\b(?:foglie|foglia|essenza|assoluta|estratto|olio|fiori|fiore|rizomi|rizoma|legno|legni)\s+di\b|\bdi\s+(?:rosa|limone|bergamotto|arancia|vaniglia|cedro|sandalo|patchouli|pepe|iris)\b|\b(?:rosa|limone|bergamotto)\s+(?:bulgara|turca|italiana|egiziana|italiano)\b|\b(?:fiori|muschi)\s+bianch[ie]\b|\bspruzzi\s+marin[io]\b|\bpepe\s+rosa\b|\blimone\s+italian[oa]\b/i

function allNotesEnglish(notes: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] }): boolean {
  const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
  if (all.length === 0) return true
  return all.every(n => {
    const trimmed = n.trim().toLowerCase()
    // Non-ASCII characters → definitely non-English
    if (/[^\x00-\x7f]/.test(trimmed)) return false
    if (NON_ENGLISH_NOTE_PHRASE_RE.test(trimmed)) return false
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

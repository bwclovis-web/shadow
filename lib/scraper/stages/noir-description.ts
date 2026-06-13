import { ChatOpenAI } from "@langchain/openai"
import { getLlmInvocationText } from "@/lib/scraper/stages/llm-extraction"
import { sanitizeCopyForNotePipeline } from "@/lib/scraper/stages/title-cleaning"

const NOIR_OPENING_VARIATIONS = [
  "Open with a specific place tied to the fragrance mood (rainy curb, service alley, last booth, hotel corridor) — never a random location unrelated to the scent.",
  "Open with an action or gesture (striking a match, checking a watch, snapping gloves shut, collar up).",
  "Open with light or weather (neon bleed in rain, fog halogen, wet asphalt glare).",
  "Open by treating one note from the list as a tangible object in the scene (not 'notes of …').",
  "Open with time or stakes (closing time, wrong room, last train, someone following).",
  "Open with contrast (polished vs tarnished, clean smoke vs dirty wool, heat vs cold metal).",
] as const

const NOIR_DESCRIPTION_SYSTEM = `You write short, evocative perfume descriptions for a film noir themed fragrance site. Style: sexy, mysterious, shadowy, seductive. Channel 1940s noir: smoke, rain-slick streets, trench coats, dim bars, dangerous allure.

Rules:
- Write 2–3 sentences only. No bullet lists.
- Weave in the actual fragrance notes naturally; do not list them.
- UNIQUE OPENING: Every description must start differently. NEVER begin with "A whisper of", "A cascade of", "A sun-drenched", "A warm", "A veil of", "A silken", "Somewhere", "Tonight", "In the heart", "Beneath the", or any opener starting with "A " plus an adjective. Prefer a strong noun, verb, place, or time clause as the first word.
- NEVER repeat phrases across products in the same batch: "dances in the air", "mingles with", "lingers in the air", "envelops the senses", "weaves a", "unfurls like", "sun-kissed", "sun-drenched", "silken", "velvet", "tapestry", "cherished secret", "starlit sky".
- Prefer concrete, odd noir specifics over stock luxury metaphor.
- The opening image must fit THIS perfume's notes and name — do not drop in unrelated set dressing (e.g. fire stairs, random architecture) unless the materials suggest heat, smoke, or ash.
- Grammar: every sentence must be complete — never leave empty subjects or objects (e.g. reject "scent of mingles", "as unfurls", "bouquet of unfurls"). If a note name is awkward in prose, rephrase the whole sentence.
- Tone: alluring, enigmatic, slightly dangerous. No cute or cheerful language.
- Return ONLY the description text — no labels, no "Description:", no quotes.`

/** Take a short "opening" fingerprint so we can ask the LLM to avoid similar starts. */
function openingFingerprint(description: string, maxLen = 60): string {
  const trimmed = description.trim().slice(0, maxLen)
  const firstSentence = trimmed.match(/^[^.!?]+[.!?]?/)?.[0] ?? trimmed
  return firstSentence.trim().slice(0, 50)
}

async function generateNoirDescription(
  llm: ChatOpenAI,
  productName: string,
  notes: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  originalDescriptionSnippet: string,
  previousOpenings: string[] = [],
  batchIndex = 0,
  batchTotal = 0,
): Promise<string> {
  const allNotes = [
    ...notes.openNotes,
    ...notes.heartNotes,
    ...notes.baseNotes,
  ].filter(Boolean)
  const notesText = allNotes.length ? allNotes.join(", ") : "unknown"
  const recent = previousOpenings.slice(-18)
  const avoidBlock =
    recent.length > 0
      ? `\nCRITICAL — Do NOT start your description with a phrase similar to these (already used by other products in this batch):\n${recent.map(o => `- "${o}"`).join("\n")}\nStart with a completely different angle, image, or first word.`
      : ""
  const variation = NOIR_OPENING_VARIATIONS[batchIndex % NOIR_OPENING_VARIATIONS.length]
  const pos = batchIndex + 1
  const totalStr = batchTotal > 0 ? String(batchTotal) : "?"
  const userContent = `Product: "${productName}"
Fragrance notes: ${notesText}
Original description (use only for mood/context; do not copy): ${originalDescriptionSnippet.slice(0, 800)}
Batch position: ${pos} of ${totalStr} — this row must feel distinct from every other.
Composition hint for THIS product only (obey it; each row in the batch gets a different hint): ${variation}${avoidBlock}

Write a unique, film noir styled description for this perfume (2–3 sentences).`

  try {
    const response = await llm.invoke([
      { role: "system", content: NOIR_DESCRIPTION_SYSTEM },
      { role: "user", content: userContent },
    ])
    const text = sanitizeCopyForNotePipeline(getLlmInvocationText(response).trim())
    return text.slice(0, 1200) || originalDescriptionSnippet.slice(0, 500)
  } catch {
    return originalDescriptionSnippet.slice(0, 500)
  }
}
export { generateNoirDescription, openingFingerprint }

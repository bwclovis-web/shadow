/**
 * LangGraph note-extraction pipeline.
 *
 * Takes an array of raw ScrapedItems (name, description, image, detailURL)
 * and returns PerfumeCsvRecord[] with openNotes / heartNotes / baseNotes
 * extracted from each product description using an LLM.
 *
 * Optional: clean product names (take before " - ", strip numbers), strip
 * extracted notes from description text, and generate film noir themed
 * descriptions from notes + original prose.
 *
 * Graph: START -> extractNotes -> (optional) generateNoirDescription -> END
 *
 * Uses @langchain/langgraph + @langchain/openai.
 * Requires OPENAI_API_KEY in environment.
 */

import { Annotation, StateGraph } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"

import type { PerfumeCsvRecord, ScrapedItem } from "@/types/scraper"

/** Options for title cleaning and description generation. */
export interface ScraperPipelineOptions {
  /** Use only the part of the product name before the first " - ". */
  titleTakeBeforeDash?: boolean
  /** Remove numbers and size patterns (e.g. 30ml, 1.7 fl oz) from product names. */
  titleStripNumbers?: boolean
  /** Words or phrases to strip from the title (case-insensitive). */
  titleOmitWords?: string[]
  /** Generate film noir themed descriptions; if false, use original with notes stripped. */
  generateNoirDescriptions?: boolean
}

// ---------------------------------------------------------------------------
// State definition
// ---------------------------------------------------------------------------

const ScraperState = Annotation.Root({
  items: Annotation<ScrapedItem[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  houseName: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  results: Annotation<PerfumeCsvRecord[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
})

type ScraperStateType = typeof ScraperState.State

// ---------------------------------------------------------------------------
// Title cleaning (no LLM)
// ---------------------------------------------------------------------------

/** Keep only the part before the first " - " and trim. */
function takeBeforeDash(name: string): string {
  const idx = name.indexOf(" - ")
  return idx >= 0 ? name.slice(0, idx).trim() : name.trim()
}

/** Remove numbers and common size patterns (30ml, 1.7 fl oz, etc.) from product name. */
function stripNumbersFromTitle(name: string): string {
  return name
    .replace(/\d+(\.\d+)?\s*(ml|fl\.?\s*oz|oz|fl\s*oz)\b/gi, "")
    .replace(/\b\d+(\.\d+)?\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function omitWordsFromTitle(name: string, words: string[]): string {
  if (!words?.length) return name
  let out = name
  for (const phrase of words) {
    if (!phrase?.trim()) continue
    const re = new RegExp(phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    out = out.replace(re, " ")
  }
  return out.replace(/\s+/g, " ").trim()
}

function cleanTitle(
  name: string,
  opts: {
    titleTakeBeforeDash?: boolean
    titleStripNumbers?: boolean
    titleOmitWords?: string[]
  },
): string {
  let out = name
  if (opts.titleTakeBeforeDash) out = takeBeforeDash(out)
  if (opts.titleStripNumbers) out = stripNumbersFromTitle(out)
  if (opts.titleOmitWords?.length) out = omitWordsFromTitle(out, opts.titleOmitWords)
  return out.replace(/\s+/g, " ").trim() || name
}

/** Remove extracted note phrases from description text so it's not redundant with the notes fields. */
function stripNotesFromDescription(description: string, notes: string[]): string {
  if (!description?.trim() || notes.length === 0) return description
  let text = description
  for (const note of notes) {
    if (!note?.trim()) continue
    const re = new RegExp(
      note.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"),
      "gi",
    )
    text = text.replace(re, " ").replace(/\s+/g, " ").trim()
  }
  return text.trim()
}

// ---------------------------------------------------------------------------
// LLM note-extraction helper
// ---------------------------------------------------------------------------

const NOTE_SYSTEM_PROMPT = `You are a master perfumer. Extract every fragrance note from the product description and assign them to three layers.

Return ONLY a JSON object with exactly these keys (use these exact names):
  "openNotes":  string[] — top/opening notes (first impression, evaporates first)
  "heartNotes": string[] — middle/heart notes (core of the scent)
  "baseNotes":  string[] — base/dry-down notes (last to fade, depth)

Layer detection:
- If the text uses section headers (e.g. "Top:", "Heart:", "Base:" or "Opening:", "Mid:", "Dry down:" or "Head/Heart/Base"), put each note in the matching layer.
- If it says "top notes include X, Y" or "heart: X, Y" or "base notes: X", follow that structure.
- If there is no layering, spread notes by typical volatility: citrus, herbs, light florals → openNotes; florals, spices, fruits → heartNotes; woods, musk, vanilla, amber, resins → baseNotes.
- When in doubt, prefer putting a note in heartNotes rather than omitting it.

Rules:
- Extract ALL notes mentioned — do not skip any. Include every ingredient or scent descriptor (e.g. vanilla, rose, black pepper, sandalwood, bergamot, jasmine, musk, amber, oud).
- Notes must be lowercase. Remove duplicates within each array.
- Omit only pure marketing fluff that is not a note (e.g. "luscious", "irresistible", "seductive" as standalone words). Adjectives that describe a note (e.g. "warm vanilla", "fresh bergamot") → keep the note (vanilla, bergamot).
- Return only the JSON object — no explanation, no markdown fences.`

const NAME_ONLY_PROMPT = `You are a master perfumer extracting fragrance notes from a product name.

STEP 1 — LITERAL INGREDIENTS: Does the name contain real scent ingredients? Extract every one.
Examples:
  "Lavender" → openNotes: ["lavender"]
  "Honey" → heartNotes: ["honey"], baseNotes: ["beeswax"]
  "Vanilla Ice Cream" → openNotes: ["vanilla cream", "sugar"], heartNotes: ["vanilla", "milk"], baseNotes: ["musk", "vanilla"]
  "Condensed Milk" → openNotes: ["cream", "sugar"], heartNotes: ["milk", "vanilla"], baseNotes: ["musk"]
  "Suntan Lotion" → openNotes: ["coconut", "tropical flowers"], heartNotes: ["banana", "orange blossom"], baseNotes: ["coconut milk", "solar musk", "vanilla"]
  "Sandalwood & Rose" → heartNotes: ["rose"], baseNotes: ["sandalwood"]
  "Lavender & Vanilla" → openNotes: ["lavender"], heartNotes: ["lavender"], baseNotes: ["vanilla"]

STEP 2 — THEMATIC INFERENCE: If the name doesn't contain literal ingredients, infer notes from the theme/mood:
  - Witchy/ritual names (e.g. "Shadow Work", "Hexbreaker", "Samhain") → dark amber, incense, patchouli, black musk, smoke, myrrh
  - Mythological names (e.g. "Aphrodite", "The Siren", "Persephone") → rose, jasmine, musk, pomegranate, neroli, ylang ylang
  - Nature names (e.g. "Forest Floor", "Awakening") → vetiver, moss, pine, cedar, earth, green
  - Fresh names → bergamot, citrus, green tea, aquatic
  - Romantic names → rose, jasmine, peony, violet
  - Gourmand names → vanilla, caramel, honey, tonka bean

Return ONLY a JSON object: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}.
Use lowercase. No duplicates. No explanation, no markdown.
Always provide at least 1-3 notes even when guessing.`

/** Used when description + name fallback still yield no notes: infer from name and/or known perfume databases. */
const FALLBACK_LOOKUP_SYSTEM_PROMPT = `You are a fragrance encyclopedia. This perfume returned NO notes from its listing. You MUST return notes — empty arrays are NOT acceptable.

How to find notes (use ALL of these):
1. NAME ANALYSIS — Many names include scent words (e.g. "Lavender & Vanilla" → lavender, vanilla; "Forest Floor" → pine, moss, earth, cedar; "The Siren" → aquatic, salt, jasmine, musk). Think creatively about what scents the name evokes.
2. PERFUME DATABASE KNOWLEDGE — If you recognize this as a known fragrance (from Fragrantica, Basenotes, or indie perfume communities), list its documented top/heart/base notes.
3. HOUSE KNOWLEDGE — If you know the perfume house, use their common ingredient palette.
4. THEMATIC INFERENCE — If the name is evocative/abstract (e.g. "Midnight", "Shadow Work", "Aphrodite"), infer notes that match the theme:
   - Dark/gothic names → oud, black musk, incense, patchouli, smoke, dark amber
   - Floral/romantic names → rose, jasmine, peony, ylang ylang, neroli
   - Fresh/nature names → bergamot, green tea, bamboo, vetiver, cedar
   - Mystical/witchy names → frankincense, myrrh, mugwort, lavender, sage, sandalwood
   - Gourmand names → vanilla, honey, cinnamon, cocoa, caramel, tonka bean

Rules:
- Return ONLY a JSON object: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}.
- NEVER return all empty arrays. Always provide at least 2-3 notes total.
- Use lowercase. No duplicates. No explanation, no markdown.
- Assign by volatility: citrus, herbs, green, light florals → openNotes; florals, spices, fruits → heartNotes; woods, musk, vanilla, amber, oud, resins → baseNotes.`

/** Keys the LLM might use for each layer; we normalize to openNotes, heartNotes, baseNotes. */
const OPEN_KEYS = ["openNotes", "open", "opening", "openingNotes", "topNotes", "top", "headNotes", "head"]
const HEART_KEYS = ["heartNotes", "heart", "middleNotes", "middle", "midNotes", "mid", "coreNotes"]
const BASE_KEYS = ["baseNotes", "base", "dryDownNotes", "dryDown", "dry-down", "endNotes", "end"]

function toNoteArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  const arr = (val as unknown[]).map(String).map(s => s.trim().toLowerCase()).filter(Boolean)
  return [...new Set(arr)]
}

function pickFirstArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const k of keys) {
    const v = obj[k]
    if (Array.isArray(v) && v.length > 0) return toNoteArray(v)
  }
  return []
}

function parseNotesFromLlmResponse(responseContent: unknown): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} {
  const empty = { openNotes: [] as string[], heartNotes: [] as string[], baseNotes: [] as string[] }
  const text = typeof responseContent === "string" ? responseContent : ""
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return empty
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const openNotes = pickFirstArray(parsed, OPEN_KEYS)
    const heartNotes = pickFirstArray(parsed, HEART_KEYS)
    const baseNotes = pickFirstArray(parsed, BASE_KEYS)
    return {
      openNotes: openNotes.length ? openNotes : toNoteArray(parsed.openNotes),
      heartNotes: heartNotes.length ? heartNotes : toNoteArray(parsed.heartNotes),
      baseNotes: baseNotes.length ? baseNotes : toNoteArray(parsed.baseNotes),
    }
  } catch {
    return empty
  }
}

async function extractNotesFromDescription(
  llm: ChatOpenAI,
  description: string,
  productNameFallback?: string,
): Promise<{ openNotes: string[]; heartNotes: string[]; baseNotes: string[] }> {
  const empty = { openNotes: [], heartNotes: [], baseNotes: [] }
  const descTrimmed = description?.trim() ?? ""
  const nameTrimmed = productNameFallback?.trim() ?? ""

  if (!descTrimmed && !nameTrimmed) return empty

  // ── Path A: We have a description ────────────────────────────────────────
  if (descTrimmed) {
    // Always include product name as context alongside the description
    const userContent = nameTrimmed
      ? `Product name: "${nameTrimmed.slice(0, 200)}"\n\nProduct description:\n"${descTrimmed.slice(0, 3500)}"`
      : `Product description:\n"${descTrimmed.slice(0, 3500)}"`

    // Attempt 1: standard extraction
    try {
      const response = await llm.invoke([
        { role: "system", content: NOTE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ])
      const notes = parseNotesFromLlmResponse(response.content)
      if (notes.openNotes.length + notes.heartNotes.length + notes.baseNotes.length > 0) return notes
    } catch {
      // fall through to retry
    }

    // Attempt 2: aggressive retry — also instructs it to check the product name
    try {
      const retryResponse = await llm.invoke([
        {
          role: "system",
          content:
            NOTE_SYSTEM_PROMPT +
            "\n\nIMPORTANT: Also look at the product name for scent ingredients (e.g. 'Vanilla Ice Cream' → vanilla, cream; 'Lavender Honey' → lavender, honey). Extract every fragrance ingredient or scent term you can find anywhere in the text, even single words. When layer is unclear, put in heartNotes.",
        },
        { role: "user", content: userContent },
      ])
      const retryNotes = parseNotesFromLlmResponse(retryResponse.content)
      if (retryNotes.openNotes.length + retryNotes.heartNotes.length + retryNotes.baseNotes.length > 0) {
        return retryNotes
      }
    } catch {
      // fall through to name-only
    }
  }

  // ── Path B: No description (or description extraction failed) — extract from name ──
  if (nameTrimmed) {
    try {
      const response = await llm.invoke([
        { role: "system", content: NAME_ONLY_PROMPT },
        { role: "user", content: `Product name: "${nameTrimmed.slice(0, 200)}"` },
      ])
      return parseNotesFromLlmResponse(response.content)
    } catch {
      return empty
    }
  }

  return empty
}

/**
 * Fallback when description + name extraction returned no notes: ask LLM to infer from
 * the perfume name and/or knowledge from Fragrantica, Basenotes, or common perfumery.
 */
async function extractNotesFallbackLookup(
  llm: ChatOpenAI,
  productName: string,
  houseName?: string,
): Promise<{ openNotes: string[]; heartNotes: string[]; baseNotes: string[] }> {
  const empty = { openNotes: [], heartNotes: [], baseNotes: [] }
  if (!productName?.trim()) return empty
  const name = productName.trim().slice(0, 300)
  const houseCtx = houseName?.trim() ? `\nPerfume house: "${houseName.trim()}"` : ""
  try {
    const response = await llm.invoke([
      { role: "system", content: FALLBACK_LOOKUP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Perfume name: "${name}"${houseCtx}\n\nReturn a JSON object with openNotes, heartNotes, baseNotes. Use the name, the house, and your knowledge (Fragrantica, Basenotes, indie perfume communities) to list as many notes as possible. Do NOT return empty arrays.`,
      },
    ])
    return parseNotesFromLlmResponse(response.content)
  } catch {
    return empty
  }
}

// ---------------------------------------------------------------------------
// Film noir description generation
// ---------------------------------------------------------------------------

const NOIR_DESCRIPTION_SYSTEM = `You write short, evocative perfume descriptions for a film noir themed fragrance site. Style: sexy, mysterious, shadowy, seductive. Channel 1940s noir: smoke, rain-slick streets, trench coats, dim bars, dangerous allure.

Rules:
- Write 2–3 sentences only. No bullet lists.
- Weave in the actual fragrance notes naturally; do not list them.
- UNIQUE OPENING: Every description must start in a different way. Never use the same or similar opening phrase as another product (e.g. avoid repeating "A shadowy...", "This scent...", "An intoxicating...", "Smoky..."). Vary rhythm, first word, and angle (e.g. start with a place, a gesture, a moment, a contrast, or the notes in an unexpected way).
- Each description must feel unique — avoid repeating the same phrases across products.
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
): Promise<string> {
  const allNotes = [
    ...notes.openNotes,
    ...notes.heartNotes,
    ...notes.baseNotes,
  ].filter(Boolean)
  const notesText = allNotes.length ? allNotes.join(", ") : "unknown"
  const avoidBlock =
    previousOpenings.length > 0
      ? `\nCRITICAL — Do NOT start your description with a phrase similar to these (already used by other products in this batch):\n${previousOpenings.map(o => `- "${o}"`).join("\n")}\nStart with a completely different angle, image, or first word.`
      : ""
  const userContent = `Product: "${productName}"
Fragrance notes: ${notesText}
Original description (use only for mood/context; do not copy): ${originalDescriptionSnippet.slice(0, 800)}${avoidBlock}

Write a unique, film noir styled description for this perfume (2–3 sentences).`

  try {
    const response = await llm.invoke([
      { role: "system", content: NOIR_DESCRIPTION_SYSTEM },
      { role: "user", content: userContent },
    ])
    const text = typeof response.content === "string" ? response.content : ""
    return text.trim().slice(0, 1200) || originalDescriptionSnippet.slice(0, 500)
  } catch {
    return originalDescriptionSnippet.slice(0, 500)
  }
}

// ---------------------------------------------------------------------------
// Graph node
// ---------------------------------------------------------------------------

function buildGraph(
  llm: ChatOpenAI,
  opts: ScraperPipelineOptions,
  noirLlm?: ChatOpenAI,
) {
  const extractNotes = async (state: ScraperStateType): Promise<Partial<ScraperStateType>> => {
    const results: PerfumeCsvRecord[] = []
    const previousOpenings: string[] = []

    for (const item of state.items) {
      const name = cleanTitle(item.name, opts)
      let notes = await extractNotesFromDescription(llm, item.description, name || item.name)
      const totalFromDescription =
        notes.openNotes.length + notes.heartNotes.length + notes.baseNotes.length
      if (totalFromDescription === 0 && (name || item.name)?.trim()) {
        const fallbackNotes = await extractNotesFallbackLookup(llm, name || item.name, item.perfumeHouse ?? state.houseName)
        const totalFallback =
          fallbackNotes.openNotes.length +
          fallbackNotes.heartNotes.length +
          fallbackNotes.baseNotes.length
        if (totalFallback > 0) notes = fallbackNotes
      }

      // If only one layer has notes, consolidate everything into openNotes so they are always visible.
      const layersWithNotes = [notes.openNotes, notes.heartNotes, notes.baseNotes].filter(a => a.length > 0)
      if (layersWithNotes.length === 1 && layersWithNotes[0] !== notes.openNotes) {
        notes = { openNotes: layersWithNotes[0], heartNotes: [], baseNotes: [] }
      }

      const allNoteStrs = [
        ...notes.openNotes,
        ...notes.heartNotes,
        ...notes.baseNotes,
      ]
      let description = stripNotesFromDescription(item.description, allNoteStrs)

      if (opts.generateNoirDescriptions && noirLlm) {
        description = await generateNoirDescription(
          noirLlm,
          name,
          notes,
          description || item.description,
          previousOpenings,
        )
        previousOpenings.push(openingFingerprint(description))
      } else if (description) {
        description = description.trim()
      } else {
        description = item.description
      }

      results.push({
        name,
        description,
        image: item.image,
        perfumeHouse: item.perfumeHouse ?? state.houseName,
        openNotes: JSON.stringify(notes.openNotes),
        heartNotes: JSON.stringify(notes.heartNotes),
        baseNotes: JSON.stringify(notes.baseNotes),
        detailURL: item.detailURL,
      })
    }

    return { results }
  }

  const graph = new StateGraph(ScraperState)
    .addNode("extractNotes", extractNotes)
    .addEdge("__start__", "extractNotes")
    .addEdge("extractNotes", "__end__")

  return graph.compile()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the LangGraph note-extraction pipeline.
 *
 * @param items - Raw scraped products from run_scraper.py
 * @param houseName - Perfume house name to attach when item.perfumeHouse is absent
 * @param options - Optional title cleaning and film noir description generation
 * @param model - OpenAI model to use (default: gpt-4o-mini)
 * @returns Array of PerfumeCsvRecord ready for CSV serialisation or direct DB import
 */
export async function extractNotesForItems(
  items: ScrapedItem[],
  houseName: string,
  options: ScraperPipelineOptions = {},
  model = "gpt-4o-mini",
): Promise<PerfumeCsvRecord[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Note extraction requires an OpenAI key.")
  }

  const llm = new ChatOpenAI({
    model,
    temperature: 0.1,
    apiKey: process.env.OPENAI_API_KEY,
  })

  const noirLlm = options.generateNoirDescriptions
    ? new ChatOpenAI({
        model,
        temperature: 0.7,
        apiKey: process.env.OPENAI_API_KEY,
      })
    : undefined

  const graph = buildGraph(llm, options, noirLlm)
  const finalState = await graph.invoke({ items, houseName, results: [] })
  return finalState.results
}

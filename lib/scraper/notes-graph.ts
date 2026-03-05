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

function cleanTitle(
  name: string,
  opts: { titleTakeBeforeDash?: boolean; titleStripNumbers?: boolean },
): string {
  let out = name
  if (opts.titleTakeBeforeDash) out = takeBeforeDash(out)
  if (opts.titleStripNumbers) out = stripNumbersFromTitle(out)
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

const NOTE_SYSTEM_PROMPT = `You are a master perfumer. Given a perfume product description, extract the fragrance notes.
Return ONLY a JSON object with exactly these three keys:
  "openNotes":  string[] — top/opening notes
  "heartNotes": string[] — middle/heart notes  
  "baseNotes":  string[] — base/dry-down notes

Rules:
- Each note must be a real fragrance ingredient or scent descriptor (e.g. "vanilla", "rose", "black pepper")
- If the description does not separate notes into layers, put all notes in "openNotes" and leave the other arrays empty
- Notes must be lowercase
- Remove duplicates
- Omit marketing words that are not actual notes (e.g. "luscious", "soft", "warm" used as adjectives alone)
- Return only the JSON object — no explanation, no markdown fences`

async function extractNotesFromDescription(
  llm: ChatOpenAI,
  description: string,
): Promise<{ openNotes: string[]; heartNotes: string[]; baseNotes: string[] }> {
  const empty = { openNotes: [], heartNotes: [], baseNotes: [] }
  if (!description?.trim()) return empty

  try {
    const response = await llm.invoke([
      { role: "system", content: NOTE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Product description:\n"${description.slice(0, 2000)}"`,
      },
    ])

    const text = typeof response.content === "string" ? response.content : ""

    // Strip optional markdown fences
    const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return empty

    const parsed = JSON.parse(jsonMatch[0])
    return {
      openNotes: Array.isArray(parsed.openNotes)
        ? (parsed.openNotes as unknown[]).map(String).filter(Boolean)
        : [],
      heartNotes: Array.isArray(parsed.heartNotes)
        ? (parsed.heartNotes as unknown[]).map(String).filter(Boolean)
        : [],
      baseNotes: Array.isArray(parsed.baseNotes)
        ? (parsed.baseNotes as unknown[]).map(String).filter(Boolean)
        : [],
    }
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
      const notes = await extractNotesFromDescription(llm, item.description)
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

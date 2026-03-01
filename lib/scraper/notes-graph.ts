/**
 * LangGraph note-extraction pipeline.
 *
 * Takes an array of raw ScrapedItems (name, description, image, detailURL)
 * and returns PerfumeCsvRecord[] with openNotes / heartNotes / baseNotes
 * extracted from each product description using an LLM.
 *
 * Graph: START -> extractNotes -> END
 *
 * Uses @langchain/langgraph + @langchain/openai.
 * Requires OPENAI_API_KEY in environment.
 */

import { Annotation, StateGraph } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"

import type { PerfumeCsvRecord, ScrapedItem } from "@/types/scraper"

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
// Graph node
// ---------------------------------------------------------------------------

function buildGraph(llm: ChatOpenAI) {
  const extractNotes = async (state: ScraperStateType): Promise<Partial<ScraperStateType>> => {
    const results: PerfumeCsvRecord[] = []

    for (const item of state.items) {
      const notes = await extractNotesFromDescription(llm, item.description)

      results.push({
        name: item.name,
        description: item.description,
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
 * @param model - OpenAI model to use (default: gpt-4o-mini)
 * @returns Array of PerfumeCsvRecord ready for CSV serialisation or direct DB import
 */
export async function extractNotesForItems(
  items: ScrapedItem[],
  houseName: string,
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

  const graph = buildGraph(llm)
  const finalState = await graph.invoke({ items, houseName, results: [] })
  return finalState.results
}

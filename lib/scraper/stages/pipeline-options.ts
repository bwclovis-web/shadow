import { Annotation } from "@langchain/langgraph"

import type {
  NoteInferenceMode,
  NoteValidationMode,
  PerfumeCsvRecord,
  ScrapedItem,
  TitleDashSegment,
} from "@/types/scraper"

/** Options for title cleaning and description generation. */
export interface ScraperPipelineOptions {
  /** Trim at the first ` - ` / `–` / `—` (ASCII or Unicode dashes), `~`, `.`, or `|`: before, after, or keep full title (`none`). */
  titleDashSegment?: TitleDashSegment
  /** @deprecated Use `titleDashSegment: "before"` instead. */
  titleTakeBeforeDash?: boolean
  /** Trim at the first `:`: before, after, or keep full title (`none`). */
  titleColonSegment?: TitleDashSegment
  /** Keep only text after the first comma when true. */
  titleTakeAfterFirstComma?: boolean
  /** Keep only text before the first comma when true. */
  titleTakeBeforeFirstComma?: boolean
  /** Remove numbers and size patterns (e.g. 30ml, 1.7 fl oz) from product names. */
  titleStripNumbers?: boolean
  /** Words or phrases to strip from the title (case-insensitive). */
  titleOmitWords?: string[]
  /** Generate film noir themed descriptions; if false, use original with notes stripped. */
  generateNoirDescriptions?: boolean
  /** Optional hook for long runs (e.g. admin scraper NDJSON stream). Not serialized on API requests. */
  onProgress?: (message: string) => void
  /** When set (e.g. request.signal), the pipeline stops between products if the client cancels the scrape. */
  abortSignal?: AbortSignal
  /**
   * When true, fetch each product detail URL if note-source text lacks an explicit merchant list
   * (Featured notes, Top:/Heart:, scent notes include, etc.). Default false so Vitest and fixtures stay offline.
   */
  fetchPdpNoteBootstrap?: boolean
  /** `standard` (default) may infer from name / encyclopedia fallback; `strict` keeps only merchant-stated notes. */
  noteInferenceMode?: NoteInferenceMode
  /** Minimum items in a flat merchant note list to treat as authoritative (default 2). */
  minConfidentFlatNotes?: number
  /** OpenAI model for extraction / merge / translate (optional; falls back to env or gpt-4o-mini). */
  notesPipelineModel?: string
  /** OpenAI model for noir descriptions (optional; falls back to env or extraction model). */
  noirPipelineModel?: string
  /** Post-extraction LLM validator over the union of unique notes. Default `"llm"`; `"off"` disables. */
  noteValidationMode?: NoteValidationMode
  /**
   * When true, merge newly extracted notes into any `openNotes` / `heartNotes` / `baseNotes` already
   * on scraped items (e.g. after the Python pipeline) instead of replacing them.
   */
  enrichOnly?: boolean
}

// ---------------------------------------------------------------------------
// State definition
// ---------------------------------------------------------------------------

export const ScraperState = Annotation.Root({
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
  batchWarnings: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
})

export type ScraperStateType = typeof ScraperState.State

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

import type { PerfumeCsvRecord, ScrapedItem, TitleDashSegment } from "@/types/scraper"
import { isDisplayableScentNote } from "@/utils/validation/note-validation.server"

/** Options for title cleaning and description generation. */
export interface ScraperPipelineOptions {
  /** Trim at the first ` - `: before, after, or keep full title (`none`). */
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
// Name from URL (when scraper returns hostname or empty)
// ---------------------------------------------------------------------------

/** True if the scraped "name" is empty or looks like a hostname (e.g. Www.lush.com). */
function isLikelyHostnameOrEmpty(name: string): boolean {
  const t = name?.trim() ?? ""
  if (!t) return true
  // e.g. "Www.lush.com", "lush.com", "www.example.co.uk"
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\s|$)/i.test(t)) return true
  if (/^www\./i.test(t) && /\.(com|co\.uk|org|net|io)(\s|$)/i.test(t)) return true
  return false
}

/**
 * Derive a product name from a product detail URL when the scraper returns a hostname or empty.
 * e.g. .../p/lord-of-misrule-perfume -> "Lord of Misrule Perfume"
 */
function nameFromProductUrl(detailURL: string): string | null {
  if (!detailURL?.trim()) return null
  try {
    const pathname = new URL(detailURL).pathname
    const segments = pathname.split("/").filter(Boolean)
    const slug = segments[segments.length - 1]
    if (!slug || slug.length > 120) return null
    const withSpaces = slug.replace(/-/g, " ")
    const titleCased = withSpaces.replace(/\b\w/g, c => c.toUpperCase())
    return titleCased.trim() || null
  } catch {
    return null
  }
}

/** Resolve display name: use URL-derived name when scraped name is hostname/empty. */
function resolveProductName(item: ScrapedItem): string {
  const raw = item.name?.trim() ?? ""
  if (!isLikelyHostnameOrEmpty(raw)) return raw
  const fromUrl = nameFromProductUrl(item.detailURL ?? "")
  return fromUrl ?? raw
}

// ---------------------------------------------------------------------------
// Title cleaning (no LLM)
// ---------------------------------------------------------------------------

const TITLE_SEGMENT_DELIMITER = /\s*[-~.]\s*/
const TITLE_COLON_DELIMITER = /\s*:\s*/

/** Keep only the part before the first segment delimiter and trim. */
const takeBeforeDash = (name: string): string => {
  const parts = name.split(TITLE_SEGMENT_DELIMITER, 2)
  return (parts[0] ?? name).trim()
}

/** Keep only the part after the first segment delimiter and trim; if no delimiter, keep full string trimmed. */
const takeAfterDash = (name: string): string => {
  const idx = name.search(TITLE_SEGMENT_DELIMITER)
  if (idx < 0) return name.trim()
  const match = name.slice(idx).match(TITLE_SEGMENT_DELIMITER)
  const delimiterLength = match?.[0]?.length ?? 0
  return name.slice(idx + delimiterLength).trim()
}

/** Keep only the part before the first colon and trim. */
const takeBeforeColon = (name: string): string => {
  const parts = name.split(TITLE_COLON_DELIMITER, 2)
  return (parts[0] ?? name).trim()
}

/** Keep only the part after the first colon and trim; if no delimiter, keep full string trimmed. */
const takeAfterColon = (name: string): string => {
  const idx = name.search(TITLE_COLON_DELIMITER)
  if (idx < 0) return name.trim()
  const match = name.slice(idx).match(TITLE_COLON_DELIMITER)
  const delimiterLength = match?.[0]?.length ?? 0
  return name.slice(idx + delimiterLength).trim()
}

/** Keep only the part after the first comma and trim; if no delimiter, keep full string trimmed. */
const takeAfterFirstComma = (name: string): string => {
  const idx = name.indexOf(",")
  return idx >= 0 ? name.slice(idx + 1).trim() : name.trim()
}

/** Keep only the part before the first comma and trim; if no delimiter, keep full string trimmed. */
const takeBeforeFirstComma = (name: string): string => {
  const idx = name.indexOf(",")
  return idx >= 0 ? name.slice(0, idx).trim() : name.trim()
}

const resolveTitleDashSegment = (opts: {
  titleDashSegment?: TitleDashSegment
  titleTakeBeforeDash?: boolean
}): TitleDashSegment => {
  if (opts.titleDashSegment === "before" || opts.titleDashSegment === "after" || opts.titleDashSegment === "none") {
    return opts.titleDashSegment
  }
  return opts.titleTakeBeforeDash === true ? "before" : "none"
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
    titleDashSegment?: TitleDashSegment
    titleTakeBeforeDash?: boolean
    titleColonSegment?: TitleDashSegment
    titleTakeAfterFirstComma?: boolean
    titleTakeBeforeFirstComma?: boolean
    titleStripNumbers?: boolean
    titleOmitWords?: string[]
  },
): string {
  let out = name
  const seg = resolveTitleDashSegment(opts)
  if (seg === "before") out = takeBeforeDash(out)
  else if (seg === "after") out = takeAfterDash(out)
  if (opts.titleColonSegment === "before") out = takeBeforeColon(out)
  else if (opts.titleColonSegment === "after") out = takeAfterColon(out)
  if (opts.titleTakeBeforeFirstComma) out = takeBeforeFirstComma(out)
  else if (opts.titleTakeAfterFirstComma) out = takeAfterFirstComma(out)
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

function uniqueNotes(notes: string[]): string[] {
  return [...new Set(notes.map(n => n.trim().toLowerCase()).filter(Boolean))]
}

function dedupeNotesAcrossLayers(notes: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} {
  const seen = new Set<string>()
  const keepFirstSeen = (arr: string[]): string[] => {
    const out: string[] = []
    for (const note of arr) {
      const normalized = note.trim().toLowerCase()
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      out.push(normalized)
    }
    return out
  }

  return {
    openNotes: keepFirstSeen(notes.openNotes),
    heartNotes: keepFirstSeen(notes.heartNotes),
    baseNotes: keepFirstSeen(notes.baseNotes),
  }
}

/** Mask `(...)` so `&` / `and` splitting does not break parenthetical accords (E.g. Pattern by Etsy). */
const maskParenGroups = (s: string): { masked: string; groups: string[] } => {
  const groups: string[] = []
  const masked = s.replace(/\([^()]*\)/g, m => {
    groups.push(m)
    return `«p${groups.length - 1}»`
  })
  return { masked, groups }
}

const unmaskParenGroups = (s: string, groups: string[]): string =>
  s.replace(/«p(\d+)»/g, (_, i) => groups[Number(i)] ?? "")

function splitNoteList(text: string): string[] {
  if (!text?.trim()) return []
  const normalized = text
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\\//g, "/")
    .replace(/\\u0026amp;/gi, "&")
    .replace(/\\u0026/gi, "&")
    .replace(/\\n|\\t/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r/g, "\n")
    .replace(/[•·]/g, ",")

  const { masked, groups } = maskParenGroups(normalized)
  const splitReady = masked
    .replace(/\s+\|\s+/g, ", ")
    .replace(/\s+\/\s+/g, ", ")
    .replace(/\s*;\s*/g, ", ")
    .replace(/\s*&\s*/g, ", ")
    .replace(/\band\b/gi, ",")

  return uniqueNotes(
    splitReady
      .split(/[\n,]+/)
      .map(part => unmaskParenGroups(part.trim(), groups))
      .map(part => part.replace(/^[&\-\u2022*:\s]+/, "").replace(/[.:\-\s]+$/, ""))
      .filter(part => !/^amp$/i.test(part))
      .filter(Boolean),
  )
}


function stripTrailingNonNoteSections(text: string): string {
  return text
    .replace(/\s+(?:additional information|ingredients|how to use|customer reviews?|reviews?)\b[\s\S]*$/i, "")
    .trim()
}

/** Pattern-by-Etsy and minified HTML glue layer headers: "AccordMiddle Notes:" → "Accord Middle Notes:" */
const splitGluedLayerLabels = (text: string): string =>
  text
    .replace(
      /(?<=[A-Za-z0-9)])(?=(?:top|open(?:ing)?|head|heart|middle|mid|core|base|dry[\s-]*down|drydown|end)(?:\s+notes?)?\s*:)/gi,
      " ",
    )
    .replace(
      /(?<=[A-Za-z0-9)])(?=(?:series|perfume\s+family|unisex|contains\s+true\s+animalics|scent\s+strength)\s*:)/gi,
      " ",
    )

/** Stop last layer chunk before Pattern/Etsy listing meta (avoids ':' in tokens → junk filter drops all base notes). */
const truncateAtShopMetaLabels = (s: string): string => {
  const m = s.match(/\s+(?:series|perfume\s+family|unisex|contains\s+true\s+animalics|scent\s+strength)\s*:/i)
  if (m?.index != null) return s.slice(0, m.index).trim()
  return s.trim()
}

// ---------------------------------------------------------------------------
// Junk / keep rules (needed before structured extraction — long accords fail isDisplayableScentNote)
// ---------------------------------------------------------------------------

const JUNK_NOTE_PATTERNS: RegExp[] = [
  /[.!?;:(){}\[\]"]/, // punctuation → sentence fragment or copy
  /\d{2,}/, // numbers like sizes, prices, percentages
  /\b(buy|shop|order|add to cart|checkout|shipping|delivery|free|sale|discount)\b/i,
  /\b(livrare|cumpara|adauga|comanda|rapid|gratuit)\b/i, // Romanian commerce
  /\b(livraison|acheter|commande|gratuit)\b/i, // French commerce
  /\b(extrait|parfum|eau de|huile|spray|ml|oz)\b/i,
  /\b(discover|explore|experience|transform|reinvent|secret|powerful|irresistible|seductive|sensual|intense|long-lasting|unisex|pure)\b/i,
  /\b(it is|you will|you can|this is|that is|with every|just a)\b/i,
  /\b(evokes?|creates?|inspires?|crafts?)\b/i,
  /\b(calm|calming|magnetic|luminous|confident|abundant|abundance|courage|vitality|clarity|motivation|amplification|prosperity|healing|grounding|balance)\b/i,
  // Crystals / gemstones — not fragrance notes
  /\b(quartz|amethyst|herkimer|tourmaline|labradorite|malachite|selenite|fluorite|pyrite|citrine|obsidian|moonstone|agate|jasper|onyx|garnet|gem\s*magic|crystal\s*magic)\b/i,
  // Carrier / base oils — not fragrance notes
  /\b(sunflower|jojoba|argan|sweet\s+almond|avocado)\s+oil\b/i,
  /\bshea\s+butter\b/i,
  // Non-fragrance product signals
  /\b(necklace|bracelet|earring|ring|pendant|jewel|crystal\s+chip|chain)\b/i,
  // E‑commerce / collection nav copy (e.g. Shopify “cosy gift ideas” blocks), not ingredients
  /\bgift\s+ideas\b/i,
  // French note names that slip through ASCII detection
  /\b(musc\s+blanc|musc\s+noir|bois\s+de|eau\s+de|huile\s+de|fleur\s+de|note\s+de)\b/i,
]

/** Junk checks for typical short notes — excludes the punctuation rule so accord phrases with () survive. */
const JUNK_NOTE_PATTERNS_NO_PUNCT: RegExp[] = JUNK_NOTE_PATTERNS.slice(1)

const looksLikeJunkNote = (note: string): boolean => {
  if (!note?.trim()) return true
  const n = note.trim().toLowerCase()
  if (n.split(/\s+/).length > 4) return true
  return JUNK_NOTE_PATTERNS.some(p => p.test(n))
}

/**
 * Etsy / Pattern listings: long accord lines ("Mesoamerican Incense (Copal & Palo Santo) Accord").
 * Those fail `isDisplayableScentNote` (5 words / 50 char caps for quiz UI).
 */
const isScraperExtendedAccordNote = (note: string): boolean => {
  const t = note.trim()
  if (!t) return false
  if (!/\baccord\b/i.test(t)) return false
  const lower = t.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 18) return false
  if (lower.length < 2 || lower.length > 140) return false
  return !JUNK_NOTE_PATTERNS_NO_PUNCT.some(p => p.test(lower))
}

const isScraperKeptNote = (note: string): boolean => {
  const t = note.trim()
  if (!t) return false
  if (isDisplayableScentNote(t) && !looksLikeJunkNote(t)) return true
  if (isScraperExtendedAccordNote(t)) return true
  return false
}

/** Candidates from labeled Top/Middle/Base list lines (parentheticals, long accords). */
const filterStructuredNoteParts = (parts: string[]): string[] =>
  parts.map(p => p.trim()).filter(p => p && isScraperKeptNote(p))

function classifyNoteLayer(label: string): "open" | "heart" | "base" | null {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, " ")
  if (/^(top|open|opening|head)(?: notes?)?$/.test(normalized)) return "open"
  if (/^(heart|middle|mid|core)(?: notes?)?$/.test(normalized)) return "heart"
  if (/^(base|dry down|drydown|end)(?: notes?)?$/.test(normalized)) return "base"
  return null
}

function extractInlineLayeredNotes(text: string): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} {
  const empty = { openNotes: [] as string[], heartNotes: [] as string[], baseNotes: [] as string[] }
  const source = splitGluedLayerLabels(
    stripTrailingNonNoteSections(text.replace(/\r/g, "\n").replace(/\s+/g, " ").trim()),
  )
  if (!source) return empty

  const sectionRe = /\b(top(?:\s+notes?)?|open(?:ing)?(?:\s+notes?)?|head(?:\s+notes?)?|heart(?:\s+notes?)?|middle(?:\s+notes?)?|mid(?:\s+notes?)?|core(?:\s+notes?)?|base(?:\s+notes?)?|dry\s*down(?:\s+notes?)?|drydown(?:\s+notes?)?|end(?:\s+notes?)?)\s*:/gi
  const matches = [...source.matchAll(sectionRe)]
  if (matches.length === 0) return empty

  const openNotes: string[] = []
  const heartNotes: string[] = []
  const baseNotes: string[] = []

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    const label = match[1] ?? ""
    const layer = classifyNoteLayer(label)
    if (!layer || match.index == null) continue
    const start = match.index + match[0].length
    const end = i + 1 < matches.length && matches[i + 1].index != null
      ? matches[i + 1].index!
      : source.length
    const chunk = truncateAtShopMetaLabels(stripTrailingNonNoteSections(source.slice(start, end)))
    const parsed = filterStructuredNoteParts(splitNoteList(chunk))
    if (layer === "open") openNotes.push(...parsed)
    if (layer === "heart") heartNotes.push(...parsed)
    if (layer === "base") baseNotes.push(...parsed)
  }

  return {
    openNotes: uniqueNotes(openNotes),
    heartNotes: uniqueNotes(heartNotes),
    baseNotes: uniqueNotes(baseNotes),
  }
}

/**
 * Detect flat "NOTES: X, Y, Z" or "Notes: X, Y, Z" patterns (no top/heart/base breakdown).
 * Places all notes into openNotes so the LLM volatility-spreading step can redistribute them,
 * and so they're always visible even when layer structure is unknown.
 */
function extractFlatNotes(text: string): string[] {
  const source = text?.trim()
  if (!source) return []
  // Match standalone "notes: ..." or "notes - ...". We intentionally avoid lookbehind here
  // so parsing is stable across runtimes/transpilers.
  const flatNoteRe = /(?:^|[\s.!?\n])notes?\s*[:\-]\s*([^\n]+)/gi
  const found: string[] = []
  let match: RegExpExecArray | null
  while ((match = flatNoteRe.exec(source)) !== null) {
    const rawPrefix = source.slice(Math.max(0, match.index - 24), match.index).toLowerCase()
    // Skip "top/open/heart/base notes: ..." since those are layered sections.
    if (/(?:top|open|opening|head|heart|middle|mid|core|base|dry\s*down)\s+$/.test(rawPrefix)) continue
    const chunk = match[1] ?? ""
    const parsed = filterStructuredNoteParts(splitNoteList(chunk))
    found.push(...parsed)
  }
  return uniqueNotes(found)
}

function extractNotesFromStructuredText(text: string): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} {
  const empty = { openNotes: [] as string[], heartNotes: [] as string[], baseNotes: [] as string[] }
  const source = splitGluedLayerLabels(
    (text ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim(),
  )
  if (!source) return empty

  const inlineNotes = extractInlineLayeredNotes(source)
  if (inlineNotes.openNotes.length || inlineNotes.heartNotes.length || inlineNotes.baseNotes.length) {
    return inlineNotes
  }

  const lines = source
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)

  const openNotes: string[] = []
  const heartNotes: string[] = []
  const baseNotes: string[] = []

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, " ").trim()
    const openMatch = normalized.match(/^(?:top|open|opening|head)(?:\s+notes?)?\s*[:\-]\s*(.+)$/i)
    if (openMatch) {
      openNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(openMatch[1]))))
      continue
    }
    const heartMatch = normalized.match(/^(?:heart|middle|mid|core)(?:\s+notes?)?\s*[:\-]\s*(.+)$/i)
    if (heartMatch) {
      heartNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(heartMatch[1]))))
      continue
    }
    const baseMatch = normalized.match(/^(?:base|dry\s*down|drydown|end)(?:\s+notes?)?\s*[:\-]\s*(.+)$/i)
    if (baseMatch) {
      baseNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(baseMatch[1]))))
      continue
    }
  }

  const layeredResult = {
    openNotes: uniqueNotes(openNotes),
    heartNotes: uniqueNotes(heartNotes),
    baseNotes: uniqueNotes(baseNotes),
  }

  // Flat "NOTES: X, Y, Z" can coexist with partial layered sections. Parse it regardless and merge.
  const flatNotes = extractFlatNotes(source)
  if (flatNotes.length > 0 && !(layeredResult.openNotes.length || layeredResult.heartNotes.length || layeredResult.baseNotes.length)) {
    return { openNotes: flatNotes, heartNotes: [], baseNotes: [] }
  }

  if (flatNotes.length > 0) {
    const alreadyLayered = new Set([
      ...layeredResult.openNotes,
      ...layeredResult.heartNotes,
      ...layeredResult.baseNotes,
    ])
    const toAdd = flatNotes.filter(n => !alreadyLayered.has(n))
    if (toAdd.length > 0) {
      return {
        openNotes: uniqueNotes([...layeredResult.openNotes, ...toAdd]),
        heartNotes: layeredResult.heartNotes,
        baseNotes: layeredResult.baseNotes,
      }
    }
  }

  if (layeredResult.openNotes.length || layeredResult.heartNotes.length || layeredResult.baseNotes.length) {
    return layeredResult
  }

  return empty
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
- Extract ALL fragrance notes mentioned — do not skip any. Include every scent ingredient (e.g. vanilla, rose, black pepper, sandalwood, bergamot, jasmine, musk, amber, oud).
- Notes must be lowercase and in ENGLISH. Translate any non-English note names: "santal" → "sandalwood", "musc" / "musc blanc" → "white musk", "vanille" → "vanilla", "ambre" → "amber", "bois" → "wood", "rose" → "rose", "fleur" → "flower", "tabac" → "tobacco", "encens" → "incense".
- Remove duplicates within each array.
- Adjectives that describe a note (e.g. "warm vanilla", "fresh bergamot") → keep the note as a phrase (warm vanilla, fresh bergamot).
- Omit pure marketing fluff that is not a note (e.g. "luscious", "irresistible", "seductive", "sensual", "confidence", "courage", "healing", "balance", "vitality" as standalone words).
- NEVER include crystals, gemstones, or minerals as notes (e.g. quartz, amethyst, herkimer diamond, topaz, tourmaline, moonstone, labradorite, gem magic, citrine, obsidian, selenite). These are not fragrance notes.
- NEVER include carrier oils or base ingredients as notes (e.g. sunflower oil, jojoba oil, shea butter, coconut oil, sweet almond oil, argan oil). These are not fragrance notes.
- If the product is clearly NOT a fragrance (e.g. jewelry, necklace, candle, body scrub, hair product, supplement), return all empty arrays: {"openNotes":[],"heartNotes":[],"baseNotes":[]}.
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
- NEVER return all empty arrays. Always provide at least 2-3 notes total (prefer 4+ for well-known perfumes).
- For recognized fragrances (e.g. Lush Lord of Misrule, Karma, Rose Jam), use the fragrance's documented top/heart/base notes — do not return only a single generic note like "musk".
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

const MERGE_STRUCTURED_SUPPLEMENT_PROMPT = `You enrich a perfume note list that was already parsed from labeled Top/Middle/Base lines on the page.

Return ONLY JSON: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}.

Rules:
- Every note in the provided structured arrays MUST still appear in your output (same spelling intent; lowercase).
- Add any additional real fragrance notes from the title or narrative (bergamot, jasmine, honey, musk, etc.) into the correct volatility layer.
- No duplicates across layers, no marketing sentences, lowercase only.
- Carrier oils, gemstones, and SKU/meta lines are not notes.`

const noteLayerCount = (n: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] }): number =>
  n.openNotes.length + n.heartNotes.length + n.baseNotes.length

const mergeStructuredNotesWithLlm = async (
  llm: ChatOpenAI,
  structured: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  fullText: string,
  productName: string,
): Promise<{ openNotes: string[]; heartNotes: string[]; baseNotes: string[] }> => {
  if (noteLayerCount(structured) === 0 || !fullText?.trim()) return structured
  const user = `Product: "${productName.slice(0, 200)}"

Structured notes already found (you must keep all of these; add more if the text mentions others):
openNotes: ${JSON.stringify(structured.openNotes)}
heartNotes: ${JSON.stringify(structured.heartNotes)}
baseNotes: ${JSON.stringify(structured.baseNotes)}

Full product text:
"${fullText.slice(0, 3500)}"`
  try {
    const response = await llm.invoke([
      { role: "system", content: MERGE_STRUCTURED_SUPPLEMENT_PROMPT },
      { role: "user", content: user },
    ])
    const merged = parseNotesFromLlmResponse(response.content)
    const before = noteLayerCount(structured)
    const after = noteLayerCount(merged)
    if (after === 0 || after < Math.ceil(before * 0.5)) return structured
    // Never drop structured layer content when the model omits a tier (common with base).
    return {
      openNotes: uniqueNotes([...structured.openNotes, ...merged.openNotes]),
      heartNotes: uniqueNotes([...structured.heartNotes, ...merged.heartNotes]),
      baseNotes: uniqueNotes([...structured.baseNotes, ...merged.baseNotes]),
    }
  } catch {
    return structured
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
// Note translation (non-English → English)
// ---------------------------------------------------------------------------

// ASCII-only check is insufficient for French (musc, santal, vanille are all ASCII).
// We also flag known non-English perfumery words explicitly.
const KNOWN_NON_ENGLISH_NOTE_WORDS = new Set([
  "musc", "vanille", "ambre", "bois", "encens", "tabac", "cèdre", "cedre",
  "santal", "feve", "fève", "oud", "fleur", "violette", "neroli",
  "trandafir", "mosc", "vanilie", "lemn", "iasomie", "ambra",
  "rosa", "ámbar", "sándalo", "madera", "almizle",
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
  const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
  if (all.length === 0 || allNotesEnglish(notes)) return notes
  try {
    const response = await llm.invoke([
      {
        role: "system",
        content: `Translate these perfume/fragrance note names to English. Return ONLY a JSON object: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}. Keep notes that are already English as-is. Translate each note to its standard English perfumery term (e.g. "trandafir" → "rose", "mosc" → "musk", "vanilie" → "vanilla", "tutun" → "tobacco", "paciuli" → "patchouli", "iasomie" → "jasmine", "ambra" → "amber", "lemn de santal" → "sandalwood"). Lowercase only. No explanation.`,
      },
      {
        role: "user",
        content: JSON.stringify({ openNotes: notes.openNotes, heartNotes: notes.heartNotes, baseNotes: notes.baseNotes }),
      },
    ])
    const translated = parseNotesFromLlmResponse(response.content)
    const total = translated.openNotes.length + translated.heartNotes.length + translated.baseNotes.length
    return total > 0 ? translated : notes
  } catch {
    return notes
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
      const resolvedName = resolveProductName(item)
      const name = cleanTitle(resolvedName, opts)
      const notesSource = item.notesText ?? item.description
      // Step 1: try structured/inline parser first (literal Top/Heart/Base sections).
      let notes = extractNotesFromStructuredText(notesSource)
      const totalParsedDirectly = notes.openNotes.length + notes.heartNotes.length + notes.baseNotes.length

      // Step 2: LLM extraction from description when no structured sections found.
      if (totalParsedDirectly === 0 && notesSource?.trim()) {
        notes = await extractNotesFromDescription(llm, notesSource, name || resolvedName)
      } else if (
        totalParsedDirectly > 0 &&
        (notesSource?.length ?? 0) > 100 &&
        notesSource?.trim()
      ) {
        // Long pages often repeat accords in "Note Structure" and list real notes only in prose/title
        // (e.g. Pattern by Etsy). Merge so bergamot, jasmine, honey, etc. are not skipped.
        notes = await mergeStructuredNotesWithLlm(llm, notes, notesSource, name || resolvedName)
      }

      // Step 2b: last-resort name-based lookup when no description text yielded notes.
      const totalAfterLlm = notes.openNotes.length + notes.heartNotes.length + notes.baseNotes.length
      if (totalAfterLlm === 0 && !notesSource?.trim()) {
        const fallbackName = name || resolvedName
        if (fallbackName?.trim()) {
          notes = await extractNotesFallbackLookup(llm, fallbackName, item.perfumeHouse ?? state.houseName)
        }
      }

      // Step 3: translate any non-English notes to English.
      if (!allNotesEnglish(notes)) {
        notes = await translateNotesToEnglish(llm, notes)
      }

      // If only one layer has notes, consolidate into openNotes so they are always visible.
      const layersWithNotes = [notes.openNotes, notes.heartNotes, notes.baseNotes].filter(a => a.length > 0)
      if (layersWithNotes.length === 1 && layersWithNotes[0] !== notes.openNotes) {
        notes = { openNotes: layersWithNotes[0], heartNotes: [], baseNotes: [] }
      }

      // Step 4: final filter — remove junk phrases, marketing copy, and non-displayable strings
      // from ALL notes regardless of which extraction path was used.
      const cleanNote = (n: string) => isScraperKeptNote(n)
      notes = {
        openNotes: notes.openNotes.filter(cleanNote),
        heartNotes: notes.heartNotes.filter(cleanNote),
        baseNotes: notes.baseNotes.filter(cleanNote),
      }
      notes = dedupeNotesAcrossLayers(notes)

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

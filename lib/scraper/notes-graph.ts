/**
 * LangGraph note-extraction pipeline.
 *
 * Takes an array of raw ScrapedItems (name, description, image, detailURL)
 * and returns PerfumeCsvRecord[] with openNotes / heartNotes / baseNotes
 * extracted from each product description using an LLM.
 *
 * Optional: clean product names (take before first of ` - ` / en or em dash, `~`, `.`, `|`, strip numbers), strip
 * extracted notes from description text, and generate film noir themed
 * descriptions from notes + original prose.
 *
 * Graph: START -> extractNotes -> (optional) generateNoirDescription -> END
 *
 * Uses @langchain/langgraph + @langchain/openai.
 * Requires OPENAI_API_KEY in environment.
 */

import { BaseMessage } from "@langchain/core/messages"
import { Annotation, StateGraph } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"

import type {
  NoteInferenceMode,
  NoteValidationMode,
  PerfumeCsvRecord,
  ScrapedItem,
  ScraperNoteSource,
  TitleDashSegment,
} from "@/types/scraper"
import {
  assignVolatilityLayersFromFlatOpen,
  canonicalizeNote,
  canonicalizeNoteLayers,
  expandLayerNoteBlobs,
  explodeSpaceSeparatedNoteBlob,
  HYPHEN_PROTECTED_NOTE_FRAGMENTS,
  splitGluedMerchantNoteRun,
} from "@/lib/scraper/canonical-notes"
import {
  buildNoteConfirmationCorpus,
  confirmNoteLayersAgainstSource,
  extractUnlabeledFragranceNotesBlock,
  isComplianceOrSourcingNote,
  isNoteSubstantiatedInSource,
  looksLikeProseNotePhrase,
  isObviousNonMaterialNote,
  peelMarketingDescriptorTail,
  sanitizeExtractedNoteCandidate,
} from "@/lib/scraper/note-source-confirmation"
import { isDisplayableScentNote } from "@/utils/validation/note-validation.server"

/** Flatten LangChain 1.x `AIMessage` output (`content` may be string or text blocks). */
const getLlmInvocationText = (response: BaseMessage): string => {
  const viaGetter = response.text
  if (typeof viaGetter === "string" && viaGetter.length > 0) return viaGetter
  const c = response.content
  if (typeof c === "string") return c
  if (Array.isArray(c)) {
    return c
      .map((block: unknown) => {
        if (typeof block === "string") return block
        if (block && typeof block === "object" && "text" in block) {
          return String((block as { text: unknown }).text ?? "")
        }
        return ""
      })
      .join("")
  }
  return ""
}

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
  batchWarnings: Annotation<string[]>({
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

/** Etsy / Pattern listing slugs often trail SEO phrases after `-a-`, `-an-`, `-for-`, etc. */
const ETSY_SLUG_TAIL_STARTERS = new Set([
  "a",
  "an",
  "the",
  "and",
  "for",
  "with",
  "or",
  "in",
  "on",
  "to",
  "of",
  "at",
  "by",
  "is",
  "it",
  "as",
])

const trimEtsyListingSlug = (slug: string): string => {
  const parts = slug.toLowerCase().split("-").filter(Boolean)
  if (parts.length < 4) return slug
  for (let i = 2; i < parts.length; i += 1) {
    if (!ETSY_SLUG_TAIL_STARTERS.has(parts[i])) continue
    const before = parts.slice(0, i)
    const alphaWords = before.filter(p => p.length > 1 && !/^\d+$/.test(p))
    if (alphaWords.length >= 2) return before.join("-")
  }
  return slug
}

const formatListingSlugAsTitle = (slug: string): string => {
  const withSpaces = slug.replace(/-/g, " ")
  return withSpaces
    .replace(/\bno\s*(\d+[a-z]?)\b/gi, (_, n: string) => `No. ${n.toUpperCase()}`)
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim()
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
    const rawSlug = segments[segments.length - 1]
    if (!rawSlug || rawSlug.length > 120) return null
    const slug =
      /listing/i.test(pathname) || /patternbyetsy|etsy\.com/i.test(detailURL)
        ? trimEtsyListingSlug(rawSlug)
        : rawSlug
    return formatListingSlugAsTitle(slug) || null
  } catch {
    return null
  }
}

const normalizeNameKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "")

/** Scraped Etsy titles often truncate before digits ("Burner Perfume No" vs slug `burner-perfume-no9b-…`). */
const isLikelyTruncatedProductName = (name: string, detailURL: string): boolean => {
  const t = name.trim()
  if (!t || !detailURL?.trim()) return false
  if (/\bno\.?\s*$/i.test(t)) return true
  if (/\bvol\.?\s*$/i.test(t)) return true
  const fromUrl = nameFromProductUrl(detailURL)
  if (!fromUrl) return false
  const nameKey = normalizeNameKey(t)
  const urlKey = normalizeNameKey(fromUrl)
  if (!nameKey || !urlKey || urlKey.length <= nameKey.length + 3) return false
  return urlKey.startsWith(nameKey) || nameKey.startsWith(urlKey.slice(0, Math.max(8, nameKey.length)))
}

/** Resolve display name: use URL-derived name when scraped name is hostname/empty. */
function resolveProductName(item: ScrapedItem): string {
  const raw = item.name?.trim() ?? ""
  const fromUrl = nameFromProductUrl(item.detailURL ?? "")
  if (isLikelyHostnameOrEmpty(raw)) return fromUrl ?? raw
  if (fromUrl && isLikelyTruncatedProductName(raw, item.detailURL ?? "")) return fromUrl
  return raw
}

/**
 * Use both optional notes-region scrape and main description for parsing. Some runs put the labeled
 * "Scent notes include …" line in one field and noir/short copy in the other; `notesText ?? description`
 * alone drops the authoritative list and the LLM invents a pyramid from prose.
 */
const resolveNotesSource = (item: ScrapedItem): string => {
  /** Listing titles often carry "with notes of …" / "Note Structure" when body copy is noir-only. */
  const nameForNotes =
    typeof item.name === "string" &&
    /\b(?:with\s+)?notes?\s+of\b/i.test(item.name) &&
    /,/.test(item.name)
      ? item.name.trim()
      : ""
  const parts = [item.notesText, nameForNotes, item.description]
    .map(s => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
  if (parts.length === 0) return ""
  return [...new Set(parts)].join("\n\n")
}

/** True when the page text includes a merchant-style note list or pyramid — not metaphor-only prose. */
const hasExplicitNoteListSignal = (text: string): boolean => {
  const t = text
  if (/\b(?:featured|key|main|primary|signature|dominant)\s+notes?\s*:/i.test(t)) return true
  if (/\b(?:top|heart|base)\s*[—–—-]\s*[A-Za-z]/i.test(t)) return true
  if (/\b(?:fragrance\s+profile\s+)?main\s+notes?\s+(?![:\-\u2013\u2014–—])[A-Za-z]/i.test(t)) return true
  if (/\bscent\s+profile\s+(?!(?:top|heart|base|middle)\s*:)[A-Za-z]/i.test(t)) return true
  if (/\b(?:top|middle|base)\s+notes?\s+(?:of|are|is)\s+[a-z]/i.test(t)) return true
  if (/\bnotes?\s+(?!(?:top|heart|base|middle)\s*:|[:-\u2013\u2014–—])[A-Z]/i.test(t) && /\bwear\s*(?:&|and)\s*layer\b/i.test(t))
    return true
  if (/\bscent\s+notes?\s+include\b/i.test(t)) return true
  if (/\bscent\s+notes?\s+(?:top|heart|base)\s*:/i.test(t)) return true
  if (/\bnote\s+breakdown\b/i.test(t)) return true
  if (/\bfragrance\s+notes?\s+are\b/i.test(t)) return true
  if (/\bnote\s+structure\b/i.test(t)) return true
  if (/\*{0,2}(?:top|heart|middle|mid|base|opening|dry[\s-]*down)\*{0,2}\s*(?:notes?)?\s*:/i.test(t))
    return true
  if (/\bfragrance\s+notes?\b(?!\s*(?:include|are|is|:))/i.test(t)) return true
  if (/(?<!(?:please|processing)\s)\bnotes?\s*:\s*[a-z0-9]/i.test(t)) return true
  if (/\b(?:kopfnoten?|herznoten?|basisnoten?|duftnoten)\s*:/i.test(t)) return true
  if (/\bnote\s+di\s+(?:testa|cuore|fondo|olfattive)\s*:/i.test(t)) return true
  if (/\b(?:topnoten?|hartnoten?|basisnoten?)\s*:/i.test(t)) return true
  if (/\bnotas\s+de\s+(?:salida|coraz[oó]n|fondo)\s*:/i.test(t)) return true
  if (/\bnotes?\s+of\s+[a-z]/i.test(t) && /,/.test(t)) return true
  if (/\bwith\s+notes?\s+of\s+/i.test(t)) return true
  if (/\b(?:sweetly\s+spiced\s+)?blending\s+[a-z][^.!?]{6,}/i.test(t) && /,/.test(t)) return true
  if (/\b(?:the\s+)?base\s+melts?\s+into\b/i.test(t)) return true
  if (/\bnotes?\b\s+top\b\s+.+?\s+heart\b\s+.+?\s+base\b/i.test(t)) return true
  if (/\bnotes?\s+pyramid\b/i.test(t)) return true
  if (/\bscent\s+profile\s+[A-Za-z0-9]/i.test(t) && /[•·]/.test(t)) return true
  return false
}

export const isPatternByEtsyProductUrl = (detailURL: string): boolean =>
  /patternbyetsy|etsy\.com\/listing/i.test(detailURL ?? "")

export const isAndromedaMoonProductUrl = (detailURL: string): boolean =>
  /andromedasmoon\.com/i.test(detailURL ?? "")

/** Shopify paths that are not individual fragrance PDPs (sampler sets, gift cards, promos). */
const NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE =
  /\/products\/(?:fragrance-sampler|gift-card|sample-pack|coupon|wish-list|file-claim|join-our-newsletter)/i

const URL_MATCH_NAME_STOPWORDS = new Set([
  "eau",
  "de",
  "parfum",
  "edp",
  "extrait",
  "the",
  "and",
  "or",
  "for",
  "with",
  "inspired",
  "by",
  "moon",
  "andromeda",
  "andromedas",
])

const significantNameTokensForUrlMatch = (name: string): string[] => {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  return words.filter(w => w.length >= 4 && !URL_MATCH_NAME_STOPWORDS.has(w))
}

/** True when the scraped PDP URL plausibly belongs to this product name. */
export const detailUrlAlignsWithProductName = (name: string, detailURL: string): boolean => {
  if (!name?.trim() || !detailURL?.trim()) return true
  if (NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE.test(detailURL)) return false
  try {
    const tokens = significantNameTokensForUrlMatch(name)
    if (tokens.length === 0) return true
    const slug = new URL(detailURL).pathname.toLowerCase().replace(/-/g, " ")
    return tokens.some(t => slug.includes(t))
  } catch {
    return true
  }
}

const buildAndromedaCandidateProductUrls = (name: string): string[] => {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2 && !URL_MATCH_NAME_STOPWORDS.has(w))
  if (words.length === 0) return []

  const slugs = new Set<string>()
  for (let n = Math.min(2, words.length); n <= Math.min(4, words.length); n += 1) {
    slugs.add(words.slice(0, n).join("-"))
  }
  slugs.add(words.join("-"))

  const prefixes = ["andromeda-s-inspired-by-", "andromedas-inspired-by-"]
  const coreSlugs = [...slugs].sort((a, b) => b.length - a.length).slice(0, 2)
  const suffixes = ["-eau-de-parfum", ""]
  const lastWord = words.filter(w => w.length >= 4).at(-1)
  if (lastWord) suffixes.push(`-eau-de-parfum-${lastWord}`)

  const urls: string[] = []
  for (const slug of coreSlugs) {
    if (slug.length < 6) continue
    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        urls.push(`https://www.andromedasmoon.com/products/${prefix}${slug}${suffix}`)
      }
    }
  }
  return [...new Set(urls)].slice(0, 16)
}

/** Pattern-by-Etsy PDPs almost always have Note Structure; fetch when the scrape missed it. */
const shouldAutoFetchPatternEtsyNotes = (detailURL: string, mergedBase: string): boolean =>
  isPatternByEtsyProductUrl(detailURL) && !hasExplicitNoteListSignal(mergedBase)

/**
 * Andromeda's Moon Shopify PDPs use "Notes Pyramid Top … Heart … Base …" (often no colons).
 * Selenium frequently captures Scent Story prose only; HTTP bootstrap recovers the pyramid.
 */
const shouldAutoFetchAndromedaMoonNotes = (detailURL: string, mergedBase: string): boolean =>
  isAndromedaMoonProductUrl(detailURL) && !hasExplicitNoteListSignal(mergedBase)

/** Same four "ingredients" the noir generator hammers — if that's all we extracted, PDP bootstrap likely failed first pass. */
const NOIR_NOTE_CLICHE = new Set(["plum", "rose", "brown sugar", "golden honey"])

const isLikelyNoirClicheOnlyNotes = (notes: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): boolean => {
  const union = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  if (union.length === 0 || union.length > 6) return false
  return union.every(n => NOIR_NOTE_CLICHE.has(n))
}

/**
 * Heuristic: should the PDP rescue fetch fire even when notes aren't strictly all-cliché?
 *
 * Catches mid-confidence outputs like `[plum, rose, brown sugar, golden honey, vanilla]` (4/5 are
 * cliché → likely noir prose contamination, but `every()` would fail) and short lists where the
 * merchant almost certainly has more notes available on the PDP.
 */
const JUNK_NOTE_RESCUE_RE =
  /\b(?:scent\s+description|pastel\s+girls|gentle\s+projection|hand-blended|for\s+milk\s+lovers|tihota\s+on\s+fire|a\s+soft\s+golden|the\s+caramelized\s+warmth|(?:f|of)\s+note|linear-gradient|radial-gradient|rgba\s*\(|font-family|blinkmacsystemfont|system-ui)\b/i

const hasObviousJunkExtractedNotes = (notes: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): boolean => {
  const union = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
  return union.some(
    n =>
      JUNK_NOTE_RESCUE_RE.test(n) ||
      isObviousNonMaterialNote(n) ||
      /^(?:with|fans|soft|cozy|roller|airy|whipped|glowing|kissed|fluffy|fabric|touch|then|rgba|margin|h[1-6]|body|html|sans-serif|serif|monospace|system-ui|blinkmacsystemfont|roboto|inter|helvetica|arial|radial-gradient|linear-gradient)$/i.test(
        n.trim(),
      ),
  )
}

const hasWeakNoteSubstantiation = (
  notes: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  source: string,
): boolean => {
  if (!source?.trim()) return false
  const union = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  if (union.length < 2) return false
  const corpus = buildNoteConfirmationCorpus(source)
  const unsubstantiated = union.filter(n => !isNoteSubstantiatedInSource(n, corpus, source)).length
  return unsubstantiated / union.length >= 0.3
}

const shouldAttemptPdpRescue = (
  notes: {
    openNotes: string[]
    heartNotes: string[]
    baseNotes: string[]
  },
  source?: string,
): boolean => {
  const union = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  if (union.length === 0) return true
  if (isLikelyNoirClicheOnlyNotes(notes)) return true
  if (hasObviousJunkExtractedNotes(notes)) return true
  if (source && hasWeakNoteSubstantiation(notes, source)) return true
  if (union.length <= 6) {
    const clicheHits = union.filter(n => NOIR_NOTE_CLICHE.has(n)).length
    // 2+ of a small list match the noir cliche set → likely contaminated; verify against PDP.
    if (clicheHits >= 2) return true
  }
  return false
}

const shouldPreferRescuedOverCurrent = (
  current: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  rescued: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  rescueSource: string,
  rescuedFlatCount: number,
  minFlat: number,
): boolean => {
  if (noteLayerCount(rescued) === 0) return false
  if (hasObviousJunkExtractedNotes(current)) return true
  if (
    rescueSource &&
    hasWeakNoteSubstantiation(current, rescueSource) &&
    !hasWeakNoteSubstantiation(rescued, rescueSource)
  ) {
    return true
  }
  if (rescuedFlatCount >= Math.max(minFlat, 3)) return true
  if (noteLayerCount(rescued) > noteLayerCount(current)) return true
  if (!isLikelyNoirClicheOnlyNotes(rescued) && isLikelyNoirClicheOnlyNotes(current)) return true
  return !isLikelyNoirClicheOnlyNotes(rescued) && noteLayerCount(rescued) > 0
}

/** One fetch per URL per process — scrapes hit the same PDPs many times in a single run. */
const pdpNoteBootstrapCache = new Map<string, string | null>()

const stripHtmlToPlainText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()

/** Shopify PDPs use "Concentration :" / "Volume :" (space before colon). Match those headers, not bare \bVolume\b (avoids false stops inside note lists). */
const FEATURED_LIST_SECTION_STOP = String.raw`(?=\s+Concentration\s*:|\s+Volume\s*:|\s+Size\s*:|\s+Shipping\s*:|\s+Ingredients\s*:|\s+Add to cart\b|\s+Buy it now\b|\s+You may also\b|Related products\b|Customer reviews\b|\s+📷|Tag us on|$)`

/** Pattern-by-Etsy / Aether Arts PDP meta after the note pyramid (Series, Reviews, etc.). */
const PATTERN_ETSY_NOTE_BLOCK_STOP = String.raw`(?=\s+Series\s*:|\s+Perfume\s+Family\s*:|\s+Unisex\s*:|\s+Contains\s+True\s+Animalics\s*:|\s+Reviews\s*:|\s+Returns\b|\s+Extra\s+Info\b|$)`

/**
 * Aether Arts / Pattern-by-Etsy pages pair accord pyramids ("Note Structure: Top Notes: Tawny Coat Accord")
 * with explicit materials in prose ("Notes of Bergamot, Orange, Turmeric, and Saffron") and in the
 * listing title ("with notes of Bergamot, Orange, …"). Pull those into labeled lines the structured
 * parser already understands.
 */
/** "A touch of Liatrix adds a subtle grass note" → Liatrix; "with a bit of Amber" → Amber. */
const extractProseMaterialCue = (capture: string): string => {
  const t = capture.trim()
  if (!t) return t
  const head = t.match(
    /^([A-Za-z][\p{L}'-]{1,24}(?:\s+[A-Za-z][\p{L}'-]{1,24}){0,2})(?:\s+(?:adds?|with|and|or|that|which|a|an|the|give)\b|\s*[,;])/iu,
  )
  const raw = head?.[1] ? head[1].trim() : (t.split(/\s+(?:adds?|with|that|which|give)\b/i)[0] ?? t).trim()
  return raw.replace(/\s+adds?\b.*$/i, "").trim()
}

const extractPatternEtsyNoteSegmentsFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  if (!collapsed) return []

  const segments: string[] = []
  const hasMainNotesBlock = /\b(?:fragrance\s+profile\s+)?main\s+notes?\s+(?![:\-\u2013\u2014–—])[A-Za-z]/i.test(
    collapsed,
  )

  const noteStruct = collapsed.match(
    new RegExp(String.raw`\bnote\s+structure\s*:\s*(.+?)${PATTERN_ETSY_NOTE_BLOCK_STOP}`, "i"),
  )
  if (noteStruct?.[1]) {
    const block = (noteStruct[0] ?? "")
      .replace(/^\s*note\s+structure\s*:\s*/i, "")
      .trim()
    if (block.length >= 12) segments.push(block)
  }

  for (const m of collapsed.matchAll(/\bnotes?\s+of\s+([^.;!?]{8,220})/gi)) {
    let list = (m[1] ?? "").trim()
    list = list.replace(/\s+give\s+the\s+scent\b[\s\S]*$/i, "").trim()
    /** Skip noir prose ("Notes of lush jungle greenery…") — merchant lists start with a material name. */
    if (!/^[A-Z]/.test(list)) continue
    if (/\b(?:perfume|inspired|animalic|giraffe)\b/i.test(list)) continue
    if (list && (/,/.test(list) || /\band\b/i.test(list)) && /[a-z]{3,}/i.test(list)) {
      segments.push(`top notes: ${list}`)
    }
  }

  const follow = collapsed.match(/\b(?:florals?|notes?)\s+follow(?:s|ed)?\s*:\s*([^.;!?]{8,160})/i)
  if (follow?.[1]) segments.push(`heart notes: ${follow[1].trim()}`)

  const bitOfAmber = collapsed.match(/\bwith\s+a\s+bit\s+of\s+([A-Za-z][\w-]+)\b/i)
  if (!hasMainNotesBlock && bitOfAmber?.[1]) segments.push(`base notes: ${bitOfAmber[1].trim()}`)

  const completes = collapsed.match(
    /\b(?:completes?|finishes?|closes?)\s+(?:the\s+composition\s+)?with\s+(?:a\s+)?(?:bit\s+of\s+)?(?:lavish\s+)?([^.!?]{6,100})/i,
  )
  if (!hasMainNotesBlock && completes?.[1]) {
    const material = extractProseMaterialCue(completes[1])
    if (material) segments.push(`base notes: ${material}`)
  }

  if (!hasMainNotesBlock) {
    for (const m of collapsed.matchAll(
      /\b(?:a\s+touch\s+of|with\s+a\s+bit\s+of)\s+([A-Za-z][^.!?]{4,60})/gi,
    )) {
      const material = extractProseMaterialCue((m[1] ?? "").trim())
      if (material) segments.push(`base notes: ${material}`)
    }
  }

  return [...new Set(segments)]
}

const unescapeHtmlAttr = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\u00a0/g, " ")

/** Andromeda's Moon PDPs: "Top — Sapodilla, Ambrette Heart — Magnolia … Base — Musk …" */
const extractAndromedaEmDashLayeredNotesFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()
  if (!/\bTop\s*[—–—-]\s*.+\bHeart\s*[—–—-]\s*.+\bBase\s*[—–—-]\s*/i.test(collapsed)) {
    return []
  }
  const segments: string[] = []
  for (const layer of ["top", "heart", "base"] as const) {
    const m = collapsed.match(
      new RegExp(
        `\\b${layer}\\s*[—–—-]\\s*([\\s\\S]+?)(?=\\s+(?:Top|Heart|Base)\\s*[—–—-]|\\s+Scent\\s+Story|\\s+Available\\s+Sizes?|\\s+Wear\\s*(?:&|and)\\s*Layer|\\s+Sizes?\\b|\\s+Processing\\b|\\s+ANDROMEDA|$)`,
        "i",
      ),
    )
    if (m?.[1]?.trim()) segments.push(`${layer} notes: ${m[1].trim()}`)
  }
  return segments
}

/**
 * Andromeda emoji PDPs: "🍉 Top notes of mandarin orange, lemon … 🥥 Middle notes of coconut …"
 * Whitespace-collapsed prose uses "Top/Middle/Base notes of|are|is …" without colons.
 */
const extractAndromedaNotesOfLayeredFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!/\b(?:top|middle|base)\s+notes?\s+(?:of|are|is)\s+/i.test(collapsed)) return []

  const segments: string[] = []
  const re = /\b(top|middle|base)\s+notes?\s+(?:of|are|is)\s+/gi
  const matches = [...collapsed.matchAll(re)]
  if (matches.length < 2) return []

  const stopRe =
    /\s+(?:Why\s+You(?:'|'|&#39;)ll|ORIGINAL|As with any|Processing|Important|Ingredients|Share\s+Share|\#{1,6}\s)/i

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const label = (m[1] ?? "").toLowerCase()
    const layer = label === "middle" ? "heart" : label === "base" ? "base" : "open"
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : collapsed.length
    let chunk = collapsed.slice(start, end).trim()
    const stop = chunk.match(stopRe)
    if (stop?.index != null) chunk = chunk.slice(0, stop.index).trim()
    chunk = chunk.replace(/[.!?]+\s*$/, "").trim()
    if (chunk) segments.push(`${layer} notes: ${chunk}`)
  }
  return segments
}

const LAYER_MARKER_ONLY_RE = /^(?:top|middle|base)\s+notes?$/i
const LAYER_MARKER_LEADING_RE = /^(?:top|middle|base)\s+notes?\s+(?:are|is|of)\s+(.+)$/i

const hasEmbeddedLayerMarkers = (layers: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): boolean => {
  const all = [...layers.openNotes, ...layers.heartNotes, ...layers.baseNotes]
  return all.some(n => {
    const p = n.trim()
    return LAYER_MARKER_ONLY_RE.test(p) || LAYER_MARKER_LEADING_RE.test(p)
  })
}

/** Flat comma lists that glued layer headers ("middle notes", "base notes are ebony") into openNotes. */
const relayerNotesWithEmbeddedLayerMarkers = (layers: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): { openNotes: string[]; heartNotes: string[]; baseNotes: string[] } => {
  const ordered = [...layers.openNotes, ...layers.heartNotes, ...layers.baseNotes]
  if (!hasEmbeddedLayerMarkers(layers)) return layers

  const open: string[] = []
  const heart: string[] = []
  const base: string[] = []
  let current: "open" | "heart" | "base" = "open"

  const pushSanitized = (note: string, layer: "open" | "heart" | "base") => {
    const sanitized = sanitizeExtractedNoteCandidate(note)
    if (!sanitized) return
    if (layer === "open") open.push(sanitized)
    else if (layer === "heart") heart.push(sanitized)
    else base.push(sanitized)
  }

  for (const raw of ordered) {
    const p = raw.trim()
    if (!p) continue
    if (LAYER_MARKER_ONLY_RE.test(p)) {
      if (/^middle/i.test(p)) current = "heart"
      else if (/^base/i.test(p)) current = "base"
      else if (/^top/i.test(p)) current = "open"
      continue
    }
    const glued = p.match(LAYER_MARKER_LEADING_RE)
    if (glued) {
      if (/^middle/i.test(p)) current = "heart"
      else if (/^base/i.test(p)) current = "base"
      else current = "open"
      for (const part of splitNoteList(glued[1] ?? "")) pushSanitized(part, current)
      continue
    }
    pushSanitized(p, current)
  }

  return {
    openNotes: uniqueNotes(open),
    heartNotes: uniqueNotes(heart),
    baseNotes: uniqueNotes(base),
  }
}

/**
 * Extract "Featured notes: …" / key notes from already-plain text (meta description, stripped body).
 */
const extractFeaturedBlockFromPlain = (t: string): string | null => {
  const plain = (t ?? "").replace(/\s+/g, " ").trim()

  /**
   * Wix / boutique PDPs (e.g. Seventh Muse): product blurb is a prose line with
   * "sweet/spicy blend of Patchouli, Vanilla, …" — no "Featured notes:" header.
   * Run before the length gate so short meta descriptions still bootstrap.
   */
  /**
   * Stop boundaries for inline-prose blend phrases. Wix / Shopify / Etsy PDPs render UI labels
   * (Quantity, Add to Cart, Buy It Now, Subscribe, Details) immediately after the description
   * with no real punctuation in between, so the boundary needs to include them — otherwise the
   * regex consumes past the last real note and "Persian Lime" becomes "Persian Lime Quantity".
   */
  const ECOMMERCE_STOP =
    String.raw`(?=\s+\$\d|\s+Price\s|\s+Quantity\b|\s+Qty\b|\s+SKU\b|\s+Add\s+to\s+(?:Cart|Wishlist|Bag|Favorites)\b|\s+Buy\s+(?:Now|It\s+Now)\b|\s+Subscribe\b|\s+View\s+full\s+details\b|\s+Choose\s+a\s+selection\b|[.!?]|$)`

  const blendPhrase = plain.match(
    new RegExp(
      String.raw`\b(?:[\w.]+\s+){0,6}(?:sweet\/spicy\s+)?blend\s+of\s+.+?${ECOMMERCE_STOP}`,
      "i",
    ),
  )
  if (blendPhrase?.[0]) {
    const raw = blendPhrase[0].trim()
    const listLike =
      /,/.test(raw) ||
      /\band\s+a\s+hint\s+of\b/i.test(raw) ||
      /\b(?:\w+,\s*){2,}\w+\b/i.test(raw)
    if (raw.length >= 25 && listLike) return raw.slice(0, 4000)
  }

  const aromaBlend = plain.match(
    new RegExp(
      String.raw`\b(?:scent|fragrance|aroma)\s+blend\s+of\s+.+?${ECOMMERCE_STOP}`,
      "i",
    ),
  )
  if (aromaBlend?.[0]) {
    const raw = aromaBlend[0].trim()
    if (raw.length >= 22 && /,/.test(raw)) return raw.slice(0, 4000)
  }

  /**
   * "Dew and Honeysuckle…just what we imagine" (Wix PDPs, e.g. seventhmuse.net spring-fairy-perfume-oil).
   * List-like fragment before ellipsis + marketing; excludes `$` so price tails do not merge.
   */
  const ellipsisHook = plain.match(
    /\b([A-Z][^.!?\n*$]{2,85}?)\s*(?:\.{2,}|\u2026)\s*(?:just\b|here'?s|here\s+is|this\s+is|we\s+|you\s+'?ll|read\s+more|learn\s+more|click\s+)/i,
  )
  if (ellipsisHook?.[1]) {
    /**
     * Wix / boutique PDPs render the price label INLINE just before the description (e.g.
     * "Spring Fairy Perfume Oil $21.00 Price Dew and Honeysuckle…just what we imagine…").
     * The `[A-Z]` start-anchor latches on to "Price"/"Quantity"/etc., not the actual scent line —
     * strip any leading e-commerce labels so "Dew and Honeysuckle" is what `splitNoteList` sees.
     */
    const raw = ellipsisHook[1]
      .trim()
      .replace(
        /^(?:\$?\d+(?:[.,]\d+)?|price|quantity|qty|sku|item|product|in\s+stock|out\s+of\s+stock)\b[\s:,-]*/gi,
        "",
      )
      .trim()
    const listLike = /\band\b/i.test(raw) || /,/.test(raw)
    if (listLike && raw.length >= 8 && raw.length <= 120) return raw.slice(0, 4000)
  }

  if (plain.length < 30) return null

  const featured = plain.match(
    new RegExp(String.raw`\bfeatured\s+notes?\s*:\s*(.+?)${FEATURED_LIST_SECTION_STOP}`, "i"),
  )
  if (featured?.[1]) {
    const body = featured[1].trim().replace(/[,;]\s*$/, "")
    if (body.length >= 12 && /[a-z]{2,}/i.test(body)) {
      return `featured notes: ${body}`.slice(0, 4000)
    }
  }

  const keyNotes = plain.match(
    new RegExp(
      String.raw`\b(?:key|main|signature|primary|dominant)\s+notes?\s*:\s*(.+?)${FEATURED_LIST_SECTION_STOP}`,
      "i",
    ),
  )
  if (keyNotes?.[1]) {
    const body = keyNotes[1].trim().replace(/[,;]\s*$/, "")
    if (body.length >= 12 && /[a-z]{2,}/i.test(body)) {
      return `key notes: ${body}`.slice(0, 4000)
    }
  }

  const featuring = plain.match(/\bfeaturing\s+notes?\s+of\s+([^.]{12,2000})\./i)
  if (featuring?.[1]) {
    const body = featuring[1].trim()
    return `fragrance notes: ${body}.`.slice(0, 4000)
  }

  const scentInc = plain.match(/\bscent\s+notes?\s+include\s+([^.]{12,2000})\./i)
  if (scentInc?.[1]) {
    const body = scentInc[1].trim()
    return `scent notes include ${body}.`.slice(0, 4000)
  }

  const fragAre = plain.match(/\bfragrance\s+notes?\s+are\s+([^.]{12,2000})\./i)
  if (fragAre?.[1]) {
    const body = fragAre[1].trim()
    return `fragrance notes are ${body}.`.slice(0, 4000)
  }

  const patternEtsy = extractPatternEtsyNoteSegmentsFromPlain(plain)
  if (patternEtsy.length > 0) return patternEtsy.join("\n").slice(0, 4000)

  const shopifyIndie = extractShopifyIndieNoteSegmentsFromPlain(plain)
  if (shopifyIndie.length > 0) return shopifyIndie.join("\n").slice(0, 4000)

  const unlabeled = extractUnlabeledFragranceNotesBlock(plain)
  if (unlabeled.length >= 2) {
    return `fragrance notes: ${unlabeled.join(", ")}`.slice(0, 4000)
  }

  const emDashLayers = extractAndromedaEmDashLayeredNotesFromPlain(plain)
  if (emDashLayers.length >= 2) {
    return emDashLayers.join("\n").slice(0, 4000)
  }

  const mainNotesGlued = plain.match(
    /\b(?:fragrance\s+profile\s+)?main\s+notes?\s+(?![:\-\u2013\u2014–—])([A-Za-z][^.!?]{8,220}?)(?=\s+Overall\s+Vibe|\s+Main\s+Accords?|\s+When\s+to\s+Wear|\s+Available\s+Sizes?|\s+How\s+(?:It\s+)?Wears|$)/i,
  )
  if (mainNotesGlued?.[1]) {
    const parsed = splitGluedMerchantNoteRun(mainNotesGlued[1].trim())
    if (parsed.length >= 2) {
      return `main notes: ${parsed.join(", ")}`.slice(0, 4000)
    }
  }

  return null
}

/**
 * Andromeda's Moon PDPs: bare "Notes" header then stacked materials (no colon, no bullets).
 * Example: Notes Almond Amaretto Liqueur Accord Wear & Layer …
 */
const extractAndromedaStackedNotesFromPlain = (plain: string): string[] => {
  const stacked = plain.match(
    /\bnotes?\s+(?!(?:top|heart|base|middle)\s*:|[:-\u2013\u2014–—])([A-Z][A-Za-z\s&'’-]{3,280}?)(?=\s+Wear\s*(?:&|and)\s*Layer|\s+Available\s+Sizes?|\s+What\s+You(?:'|'|&#39;)ll\s+Smell|\s+Important\b|\s+\*?\s*Processing\b|\s+Scent\s+Vibe|\s+How\s+(?:It\s+)?Wears|\s+Main\s+Accords?|\s+Overall\s+Vibe|$)/i,
  )
  if (!stacked?.[1]) return []
  const body = stacked[1].trim()
  if (!body || /^(?:top|heart|base|middle)\b/i.test(body)) return []
  return splitGluedMerchantNoteRun(body)
}

/** Thin scrape fallback when Orgasmo-style copy mentions amaretto but omits the Notes block. */
const inferAndromedaAmarettoNotesFromProse = (text: string): string[] => {
  const t = text ?? ""
  if (!/\bamaretto\b/i.test(t)) return []
  const hasAlmondSignal =
    /\balmond\b/i.test(t) ||
    /\bamaretto\s*[-–—]\s*(?:\s*almond|\s*gourmand)\b/i.test(t) ||
    /\bamaretto\s+on\s+the\s+rocks\b/i.test(t) ||
    /\bamaretto(?:\s+|-)almond\b/i.test(t)
  if (!hasAlmondSignal) return []
  return ["almond", "amaretto liqueur accord"]
}

/**
 * Andromeda's Moon PDPs: "Scent Profile" block (no colon) — space-glued merchant materials
 * before Vibe / Wear It When / Strength sections.
 * Example: Scent Profile Tahitian Vanilla Tonka Bean Sugar Cane Almond Milk White Musk Amber
 */
const extractAndromedaScentProfileFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()
  if (!collapsed) return []
  const m = collapsed.match(
    /\bscent\s+profile\s+(?!(?:top|heart|base|middle)\s*:)([A-Za-z0-9][A-Za-z0-9\s&'’·•.\-]{2,220}?)(?=\s+(?:Vibe\b|Wear\s+It\s+When\b|Strength\b|Available\s+Sizes?|Fragrance\s+Description\b|Important\s+Information\b|Store\s+Policy\b|Andromeda(?:'|'|&#39;)s\s+Moon\s+is|Processing\b|Important\b)|$)/i,
  )
  if (!m?.[1]) return []
  const blob = m[1]
    .trim()
    .replace(/[•·]/g, ",")
    .replace(/\s+/g, " ")
    .trim()
  const parsed = splitNoteList(blob)
  return parsed.length >= 2 ? parsed : []
}

/** Turn a Top/Heart/Base layer chunk (bullets or space-glued) into a comma list for splitNoteList. */
const andromedaLayerChunkToList = (raw: string): string => {
  const cleaned = raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}✨]/gu, " ")
    .replace(/[•·]/g, ",")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return ""
  if (/[,;]/.test(cleaned)) return cleaned
  const split = splitGluedMerchantNoteRun(cleaned)
  if (split.length >= 2) return split.join(", ")
  if (cleaned.split(/\s+/).filter(Boolean).length >= 3) {
    const exploded = explodeSpaceSeparatedNoteBlob(cleaned)
    if (exploded.length >= 2) return exploded.join(", ")
  }
  return cleaned
}

/**
 * Andromeda prose PDPs without a pyramid block (e.g. Ginger Biscuit Jo Malone):
 * "…sweetly spiced blending ginger, cinnamon, and nutmeg with the comforting richness of
 * caramel and toasted hazelnut. The base melts into soft vanilla and smooth tonka bean…"
 */
const extractAndromedaBlendingProseNotesFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()
  if (!/\bblending\b/i.test(collapsed) && !/\b(?:the\s+)?base\s+melts?\s+into\b/i.test(collapsed)) {
    return []
  }

  const segments: string[] = []

  const blendingMatch = collapsed.match(
    /\b(?:sweetly\s+spiced\s+)?blending\s+([^.!?]{8,220}?)(?:\.\s*(?:The\s+(?:base|heart|drydown|dry\s+down)|Please|✨|Andromeda)|\.|$)/i,
  )
  if (blendingMatch?.[1]) {
    const blendBody = blendingMatch[1].trim()
    const withSplit = blendBody.match(
      /^(.+?)\s+with\s+(?:the\s+)?(?:comforting\s+richness|warmth|hint|touch|notes?|heart|depth)\s+of\s+(.+)$/i,
    )
    if (withSplit?.[1] && withSplit[2]) {
      segments.push(`open notes: ${withSplit[1].trim()}`)
      segments.push(`heart notes: ${withSplit[2].trim()}`)
    } else {
      const simpleWith = blendBody.match(/^(.+?)\s+with\s+(.+)$/i)
      if (simpleWith?.[1] && simpleWith[2] && /,/.test(simpleWith[1])) {
        segments.push(`open notes: ${simpleWith[1].trim()}`)
        segments.push(`heart notes: ${simpleWith[2].trim()}`)
      } else {
        segments.push(`open notes: ${blendBody}`)
      }
    }
  }

  const baseMatch = collapsed.match(
    /\b(?:the\s+)?base\s+(?:melts?|settles?|lingers?|dries?|opens?|evolves?)\s+(?:into|on|with|in|to)\s+([^.!?]{6,140})/i,
  )
  if (baseMatch?.[1]) {
    const baseList = baseMatch[1]
      .trim()
      .replace(/,?\s*creating\b.*$/i, "")
      .replace(/,?\s*leaving\b.*$/i, "")
      .trim()
    if (baseList) segments.push(`base notes: ${baseList}`)
  }

  return segments
}

/**
 * Andromeda PDPs: ## Notes / Notes Pyramid with stacked Top / Heart / Base (• bullets or space-glued).
 * Collapsed: "Notes Top Passionfruit • … Heart … Base …" or "Notes Pyramid Top Orange Bergamot … Heart … Base … Vibe"
 */
const extractAndromedaBulletPyramidFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()

  const block = collapsed.match(
    /\b(?:notes?\s+pyramid|notes?)\b\s+top\b\s+(.+?)\s+heart\b\s+(.+?)\s+base\b\s+(.+?)(?=\s+(?:scent\s+story|opening\b|wear\s+guide|vibe\s*&\s*wear|vibe\b|good\s+to\s+know|layering\s+ideas|drydown\b|fragrance\s+description|important\s+information|original\s+manufacturers)|$)/i,
  )
  if (!block?.[1] || !block[2] || !block[3]) return []

  const segments: string[] = []
  const open = truncateAtShopMetaLabels(andromedaLayerChunkToList(block[1]))
  const heart = truncateAtShopMetaLabels(andromedaLayerChunkToList(block[2]))
  const base = truncateAtShopMetaLabels(andromedaLayerChunkToList(block[3]))
  if (open && /[a-z]{3,}/i.test(open)) segments.push(`open notes: ${open}`)
  if (heart && /[a-z]{3,}/i.test(heart)) segments.push(`heart notes: ${heart}`)
  if (base && /[a-z]{3,}/i.test(base)) segments.push(`base notes: ${base}`)
  return segments
}

/**
 * Top/Middle/Base, or "Scent Notes" with Top:/Heart:/Base: bullets.
 */
const extractShopifyIndieNoteSegmentsFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  if (!collapsed) return []

  const segments: string[] = []
  const bulletToComma = (s: string) => s.replace(/[•·]/g, ",").replace(/\s+/g, " ").trim()

  for (const segment of extractAndromedaBulletPyramidFromPlain(collapsed)) {
    segments.push(segment)
  }

  for (const segment of extractAndromedaNotesOfLayeredFromPlain(collapsed)) {
    segments.push(segment)
  }

  for (const segment of extractAndromedaBlendingProseNotesFromPlain(collapsed)) {
    segments.push(segment)
  }

  const scentProfile = extractAndromedaScentProfileFromPlain(collapsed)
  if (scentProfile.length >= 2) {
    segments.push(`top notes: ${scentProfile.join(", ")}`)
  }

  const stackedNotes = extractAndromedaStackedNotesFromPlain(collapsed)
  if (stackedNotes.length >= 1) {
    segments.push(`top notes: ${stackedNotes.join(", ")}`)
  }

  for (const segment of extractAndromedaEmDashLayeredNotesFromPlain(collapsed)) {
    segments.push(segment)
  }

  const notesLine = collapsed.match(
    /\bnotes?\s*:\s*([^.!?]{8,280}?)(?=\s+(?:A\s+dreamy|Note\s+Breakdown|Available\s+Sizes?|Important\s+Disclaimer|Store\s+Policy)|$)/i,
  )
  if (notesLine?.[1]) {
    const body = bulletToComma(notesLine[1])
    if ((/,/.test(body) || /[•·]/.test(notesLine[1])) && /[a-z]{3,}/i.test(body)) {
      segments.push(`top notes: ${body}`)
    }
  }

  const breakdown = collapsed.match(/\bnote\s+breakdown\s+(.+?)(?=\s+Available\s+Sizes?|Important\s+Disclaimer|$)/i)
  if (breakdown?.[1]) {
    const chunk = breakdown[1]
    for (const m of chunk.matchAll(
      /\b(top|middle|base)\s+([^.!?]{3,160}?)(?=\s+\b(?:top|middle|base)\s+|$)/gi,
    )) {
      const layer = m[1].toLowerCase() === "middle" ? "heart" : m[1].toLowerCase()
      segments.push(`${layer} notes: ${bulletToComma(m[2])}`)
    }
  }

  const scentNotes = collapsed.match(
    /\bscent\s+notes?\s+(.+?)(?=\s+(?:🧸|Cozy\s+and|For\s+milk|ORIGINAL\s+MANUFACTURERS|As\s+with\s+any\s+fragrance)|$)/i,
  )
  if (scentNotes?.[1]) {
    const chunk = scentNotes[1]
    for (const m of chunk.matchAll(
      /\*{0,2}(top|heart|base)\*{0,2}\s*:\s*([^*]{4,160}?)(?=\s+\*{0,2}(?:top|heart|base)\*{0,2}\s*:|$)/gi,
    )) {
      segments.push(`${m[1].toLowerCase()} notes: ${bulletToComma(m[2])}`)
    }
  }

  return [...new Set(segments)]
}

const extractFromMetaDescriptionTag = (html: string): string | null => {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)
  if (!m?.[1]) return null
  const plain = unescapeHtmlAttr(m[1]).replace(/\s+/g, " ").trim()
  return extractFeaturedBlockFromPlain(plain)
}

/** Shopify product JSON / JSON-LD often embeds the full RTE string with "Featured Notes: …" before scripts are stripped. */
const extractFeaturedFromRawHtmlQuotes = (html: string): string | null => {
  const idx = html.search(/Featured Notes\s*:/i)
  if (idx < 0) return null
  const slice = html.slice(idx, idx + 4500)
  const rough = slice
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return extractFeaturedBlockFromPlain(rough)
}

/**
 * Pull a single merchant-authored note line from raw PDP HTML when Selenium/plain description missed it.
 */
const extractMerchantNoteBootstrapFromHtml = (html: string): string | null => {
  if (!html?.trim()) return null

  const fromMeta = extractFromMetaDescriptionTag(html)
  if (fromMeta) return fromMeta

  const fromRaw = extractFeaturedFromRawHtmlQuotes(html)
  if (fromRaw) return fromRaw

  const t = stripHtmlToPlainText(html)
  return extractFeaturedBlockFromPlain(t)
}

const PDP_FETCH_ATTEMPTS = 3
const PDP_FETCH_BACKOFFS_MS = [400, 1200]

const sleep = (ms: number, sig: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve, reject) => {
    if (sig?.aborted) {
      reject(sig.reason ?? new Error("aborted"))
      return
    }
    const id = setTimeout(() => {
      sig?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(id)
      reject(sig?.reason ?? new Error("aborted"))
    }
    sig?.addEventListener("abort", onAbort, { once: true })
  })

/**
 * Resolve PDP HTML → "Featured Notes:" chunk with retry + on-progress logging.
 *
 * Resilience contract:
 *  - Successful parses (note chunk OR confirmed null content) ARE cached so a single PDP only ever
 *    parses once per process.
 *  - Transient failures (network errors, 5xx, abort-free timeouts) are NOT cached — the next caller
 *    (typically the noir-cliché rescue path) re-attempts from scratch.
 *  - Up to {@link PDP_FETCH_ATTEMPTS} attempts per call, with exponential-ish backoff between them.
 */
const tryFetchPdpNoteBootstrap = async (
  detailUrl: string,
  sig: AbortSignal | undefined,
  onProgress?: (msg: string) => void,
): Promise<string | null> => {
  const cached = pdpNoteBootstrapCache.get(detailUrl)
  if (cached !== undefined) return cached

  let u: URL
  try {
    u = new URL(detailUrl)
  } catch {
    pdpNoteBootstrapCache.set(detailUrl, null)
    return null
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    pdpNoteBootstrapCache.set(detailUrl, null)
    return null
  }

  let lastErrSummary: string | null = null
  for (let attempt = 0; attempt < PDP_FETCH_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const backoff = PDP_FETCH_BACKOFFS_MS[attempt - 1] ?? 1500
      try {
        await sleep(backoff, sig)
      } catch {
        return null
      }
    }
    try {
      const res = await fetch(detailUrl, {
        signal: sig,
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      })
      if (res.ok) {
        const html = await res.text()
        const chunk = extractMerchantNoteBootstrapFromHtml(html)
        pdpNoteBootstrapCache.set(detailUrl, chunk)
        return chunk
      }
      // Don't cache 4xx that may be a one-shot WAF challenge / 5xx that may recover; retry.
      lastErrSummary = `HTTP ${res.status}`
      if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408) {
        // Hard 4xx (404, 403 fixed) — won't recover; cache and bail.
        pdpNoteBootstrapCache.set(detailUrl, null)
        return null
      }
    } catch (err) {
      if (sig?.aborted) return null
      lastErrSummary =
        err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160)
    }
  }

  if (lastErrSummary) {
    onProgress?.(`PDP fetch failed for ${detailUrl} after ${PDP_FETCH_ATTEMPTS} attempts (${lastErrSummary})`)
  }
  // Don't cache failures: noir-cliché rescue path may benefit from another fresh attempt.
  return null
}

/**
 * Some PDPs bury "Featured notes:" / "Key notes:" after long prose. Pull those labeled spans up so
 * flat-list regex reliably runs (and so runs beat noir-only tails in the same string).
 */
const augmentNotesSourceWithLabeledLists = (raw: string): string => {
  const collapsed = (raw ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  if (!collapsed) return raw ?? ""

  const segments: string[] = [
    ...extractPatternEtsyNoteSegmentsFromPlain(collapsed),
    ...extractShopifyIndieNoteSegmentsFromPlain(collapsed),
  ]

  const re = new RegExp(
    String.raw`\b((?:featured|key|main|primary|signature|dominant)\s+notes?)\s*:\s*(.+?)${FEATURED_LIST_SECTION_STOP}`,
    "gi",
  )
  let m: RegExpExecArray | null
  while ((m = re.exec(collapsed)) !== null) {
    const label = (m[1] ?? "").trim().toLowerCase()
    const list = (m[2] ?? "").trim()
    if (list.length >= 8) segments.push(`${label}: ${list}`)
  }
  if (segments.length === 0) return raw

  const boost = [...new Set(segments)].join("\n")
  const collapsedLc = collapsed.toLowerCase()
  const allSegmentsAlreadyPresent = segments.every(seg => {
    const key = seg.slice(0, Math.min(48, seg.length)).toLowerCase()
    return key.length >= 8 && collapsedLc.includes(key)
  })
  if (allSegmentsAlreadyPresent) return raw
  return `${boost}\n\n${raw}`.trim()
}

// ---------------------------------------------------------------------------
// Title cleaning (no LLM)
// ---------------------------------------------------------------------------

/** Hyphen-minus plus common shop-title dashes (en/em dash, hyphen, minus sign) so "Name – 50ml" splits like "Name - 50ml". */
const TITLE_SEGMENT_DELIMITER =
  /\s*[-\u2010\u2011\u2012\u2013\u2014\u2212~.|]\s*/
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
  return out.replace(/\bthe\s+the\b/gi, "the").replace(/\s+/g, " ").trim() || name
}

const leavesBrokenProseAfterNoteStrip = (after: string): boolean =>
  /\btouch\s+of\s+or\b/i.test(after) ||
  /\bof\s+or\s+a\b/i.test(after) ||
  /\bfins?\s+with\s+or\b/i.test(after) ||
  /\bthen\s+finishes\s+with\s+a\s+touch\s+of\s+or\b/i.test(after)

const repairBrokenProseAfterNoteStrip = (text: string): string =>
  text
    .replace(/\btouch\s+of\s+or\s+a\b/gi, "touch of")
    .replace(/\bthen\s+finishes\s+with\s+a\s+touch\s+of\s+or\s+a\b/gi, "then finishes with")
    .replace(/\s+or\s+or\s+/gi, " or ")
    .replace(/\s{2,}/g, " ")
    .trim()

/** Remove extracted note phrases from description text so it's not redundant with the notes fields. */
function stripNotesFromDescription(description: string, notes: string[]): string {
  if (!description?.trim() || notes.length === 0) return description
  let text = description
  for (const note of notes) {
    const trimmed = note?.trim()
    if (!trimmed || isObviousNonMaterialNote(trimmed)) continue
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length
    if (wordCount > 4) continue
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
    const re = new RegExp(`\\b${escaped}\\b`, "gi")
    const next = text.replace(re, " ").replace(/\s+/g, " ").trim()
    if (next !== text && leavesBrokenProseAfterNoteStrip(next)) continue
    text = next
  }
  return repairBrokenProseAfterNoteStrip(text)
}

function uniqueNotes(notes: string[]): string[] {
  return [...new Set(expandLayerNoteBlobs(notes).map(n => canonicalizeNote(n)).filter(Boolean))]
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
  /** Dedupe within each layer only — vanilla/moss often repeat across Top/Heart/Base on merchant pyramids. */
  const dedupeLayer = (arr: string[]): string[] => {
    const seen = new Set<string>()
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
    openNotes: dedupeLayer(notes.openNotes),
    heartNotes: dedupeLayer(notes.heartNotes),
    baseNotes: dedupeLayer(notes.baseNotes),
  }
}

const ADJECTIVE_ONLY_NOTE_PREFIXES = new Set([
  "wild",
  "sparkling",
  "crushed",
  "smoked",
  "powdery",
  "creamy",
  "juicy",
  "fresh",
  "warm",
  "soft",
  "dark",
  "bright",
  "zesty",
  "tart",
  "sweet",
])

/**
 * Remove parser artifacts that sneak in during flat-list splitting:
 * - merged long phrases that are just concatenations of already-extracted notes
 * - lone adjective-prefix tokens (e.g. "wild") when "wild strawberry" is present
 */
const pruneLayerArtifactNotes = (arr: string[]): string[] => {
  const normalized = [...new Set(arr.map(n => n.trim().toLowerCase()).filter(Boolean))]
  if (normalized.length <= 1) return normalized

  const hasPhraseWithPrefix = (prefix: string): boolean =>
    normalized.some(
      other =>
        other !== prefix && other.startsWith(`${prefix} `) && other.split(/\s+/).filter(Boolean).length >= 2,
    )

  return normalized.filter(note => {
    const words = note.split(/\s+/).filter(Boolean)
    if (words.length === 1 && ADJECTIVE_ONLY_NOTE_PREFIXES.has(note) && hasPhraseWithPrefix(note)) {
      return false
    }

    if (words.length >= 3) {
      let covered = 0
      for (const other of normalized) {
        if (other === note) continue
        if (other.split(/\s+/).filter(Boolean).length < 2) continue
        if (new RegExp(`\\b${other.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(note)) {
          covered += 1
          if (covered >= 2) return false
        }
      }
    }
    return true
  })
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

const splitParentheticalInnerNotes = (inner: string): string[] =>
  inner
    .split(/\s*(?:,|&|\+)\s*/i)
    .map(s => s.trim())
    .filter(Boolean)

/**
 * Merchant accord lines use parentheses for materials ("Incense (Copal & Palo Santo)").
 * Expand to separate notes with no "(" — e.g. copal, palo santo — and repair dangling "(" from bad splits.
 */
const expandParentheticalNoteParts = (parts: string[]): string[] => {
  const out: string[] = []
  for (const raw of parts) {
    let t = raw.trim()
    if (!t) continue
    if (t.includes("(") && !t.includes(")")) {
      t = t.replace(/\(\s*$/, "").trim()
    }

    const closed = t.match(/^(.+?)\s*\(([^)]+)\)\s*(.*)$/i)
    if (closed) {
      const prefix = closed[1].trim()
      const innerParts = splitParentheticalInnerNotes(closed[2])
      const suffix = closed[3].trim()
      const prefixWithSuffix =
        suffix && !/\baccord\b/i.test(prefix) ? `${prefix} ${suffix}`.trim() : prefix

      if (innerParts.length === 0) {
        if (prefixWithSuffix) out.push(prefixWithSuffix)
        continue
      }

      const innerLc = new Set(innerParts.map(p => p.toLowerCase()))
      if (
        prefixWithSuffix &&
        (!innerLc.has(prefixWithSuffix.toLowerCase()) || /\baccord\b/i.test(prefixWithSuffix))
      ) {
        out.push(prefixWithSuffix)
      }
      out.push(...innerParts)
      continue
    }

    const orphan = t.match(/^(.+?)\s*\(([^)]+)$/i)
    if (orphan) {
      const prefix = orphan[1].trim()
      const innerParts = splitParentheticalInnerNotes(orphan[2])
      if (prefix) out.push(prefix)
      out.push(...innerParts)
      continue
    }

    out.push(t)
  }
  return out
}

const expandParentheticalLayers = (notes: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): { openNotes: string[]; heartNotes: string[]; baseNotes: string[] } => ({
  openNotes: expandParentheticalNoteParts(notes.openNotes),
  heartNotes: expandParentheticalNoteParts(notes.heartNotes),
  baseNotes: expandParentheticalNoteParts(notes.baseNotes),
})

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
    .replace(/[•·✧✦\u2726-\u2728\u2736\u2737\u2740]+/g, ",")

  const { masked, groups } = maskParenGroups(normalized)
  const splitReady = masked
    .replace(/\s+\|\s+/g, ", ")
    .replace(/\s+\/\s+/g, ", ")
    .replace(/\s*;\s*/g, ", ")
    .replace(/\s*&\s*/g, ", ")
    .replace(/\band\b/gi, (match, offset, whole) => {
      const after = whole.slice(offset + match.length)
      if (/^\s+[\w-]+(?:\s+[\w-]+){0,3}\s+accord\b/i.test(after)) return match
      return ","
    })

  /**
   * Defense-in-depth: strip trailing e-commerce UI labels that occasionally cling to the last
   * note when an upstream regex consumes past the actual list boundary (e.g. Wix renders
   * "Persian Lime Quantity" inline because Quantity is the next button label).
   */
  const stripTrailingEcommerceLabels = (part: string): string =>
    part
      .replace(
        /\s+(?:quantity|qty|sku|add\s+to\s+(?:cart|wishlist|bag|favorites)|buy\s+(?:now|it\s+now)|subscribe|view\s+full\s+details|choose\s+a\s+selection|details|share|copy\s+link)\s*$/i,
        "",
      )
      .replace(/\s+wear\s+guide\b.*$/i, "")
      .replace(/\s+wear\s*&\s*performance\b.*$/i, "")
      .replace(/\s+good\s+to\s+know\b.*$/i, "")
      .replace(/\s+whether\s+you(?:'|'|&#39;)re\b.*$/i, "")
      .replace(/\s+surrounds\s+you\s+in\b.*$/i, "")
      .replace(/\s+flirtatious\b.*$/i, "")
      .replace(/\s+glamorous\b.*$/i, "")
      .trim()

  return uniqueNotes(
    splitReady
      .split(/[\n,]+/)
      .map(part => unmaskParenGroups(part.trim(), groups))
      .map(part => part.replace(/^[&\-\u2022*:\s]+/, "").replace(/[.:\-\s*]+$/, ""))
      .map(stripTrailingEcommerceLabels)
      .map(peelMarketingDescriptorTail)
      .filter(part => !/^amp$/i.test(part))
      .filter(Boolean),
  )
}


function stripTrailingNonNoteSections(text: string): string {
  return text
    .replace(
      /\s+(?:additional information|ingredients|how to use|directions(?:\s+for\s+use)?|customer reviews?|reviews?|specifications|size [Gg]uide|care [Ii]nstructions|warnings?|disclaimer|how it wears|how (?:it\s+)?smells|wear(?:ability|ing)\s+notes?|wear\s+guide\b|good\s+to\s+know\b|whether\s+you(?:'|'|&#39;)re\b|original\s+manufacturers\b|important information|important\s+(?:shop|order)\s+info|available\s+sizes?|size\s+options?|available\s+in|shipping|processing|packing|please\s+note|please\s+read|about\s+this\s+fragrance|about\s+(?:our|the)\s+brand|(?:scent\s+)?profile\s+(?:guide|overview)|pairing\s+suggestions?|frequently\s+asked)\b[\s\S]*$/i,
      "",
    )
    .replace(/\s+extra info\b[\s\S]*$/i, "")
    .replace(/\s+---+\s*[\s\S]*$/i, "")
    .trim()
}

/**
 * Merchant policy / shipping / brand-disclaimer boilerplate that frequently follows the real PDP
 * copy on indie Shopify houses (e.g. Andromedas Moon). Truncate the description at the earliest
 * match — every character after the marker is operational / legal text, not scent prose.
 */
/** Indie Shopify PDP template sections — strip from stored descriptions only (not pre-extraction). */
const PDP_SECTION_BOILERPLATE_START_PATTERNS: RegExp[] = [
  /\bfragrance\s+profile\b/i,
  /\bscent\s+profile\b/i,
  /\boverall\s+vibe\b/i,
  /\bscent\s+vibe\b/i,
  /\bnotes\s+top\s*:/i,
  /\bhow\s+it\s+wears\b/i,
  /\bsizes\s+\d+\s*ml\b/i,
  /\bapplication\s+spray\b/i,
  /\*?\s*roller\s+balls?\s+are\s+never\s+sold/i,
  /\bimportant\s+shop\s+policy\b/i,
]

const POLICY_BOILERPLATE_START_PATTERNS: RegExp[] = [
  /\bprocessing\s*(?:&|and)\s*shipping\b/i,
  /\bprocessing\s*:?\s*at\s+least\s+\d/i,
  /\b(?:packing|packaging)\s*:\s*hand[-\s]?(?:filled|poured)/i,
  /\bshipping\s*(?:&|and)?\s*insurance\s*:/i,
  /\busps?\s*\/?\s*ups\b[^.]*\binsurance\b/i,
  /\bavailable\s+sizes\b\s*[:.]?\s*\d/i,
  /\bavailable\s+sizes\b\s*[\r\n]+\s*\d/i,
  /\bno\s+changes\s*,\s+no\s+cancellations\s*,\s+(?:and\s+)?no\s+refunds\b/i,
  /\ball\s+orders\s+are\s+final\s+once\s+placed\b/i,
  /\bonce\s+an\s+order\s+is\s+placed[^.]*no\s+changes\b/i,
  /\bcredit\s+card\s+processing\s+fees\s+are\s+non-refundable\b/i,
  /\bmaterials\s+(?:are\s+)?allocated\s+(?:to\s+order|immediately)\b/i,
  /\bandromedas?\s+moon\s+is\s+(?:an?\s+)?(?:independent|small)/i,
  /\bnot\s+affiliated\s+with[^.]*(?:manufacturers?|designers?|brand)/i,
  /\boriginal\s+manufacturers?\s+pictures?/i,
  /\binfringe\s+on\s+the\s+manufacturers?\b/i,
  /\ball\s+trademarks?\s+are\s+(?:property\s+of\s+)?their\s+respective\s+(?:owners|manufacturers)/i,
  /\bname\s+trademarks?\s+and\s+copyrights?\s+are\s+propert(?:y|ies)\b/i,
  /\bthis\s+fragrance\s+is\s+an\s+independent\s+interpretation\b/i,
  /\bplease\s+read\s+our\s+policy\s+page\b/i,
  /\binspired\s+by\s+is\s+used\s+only\s+to\s+describe\b/i,
  /\bstore\s+polic(?:y|ies)\s*[:.]?/i,
  /\bingredients?\s*:/i,
  /\bingredients?\s*:\s*(?:sugarcane|ethyl)\s+alcohol\b/i,
  /\borganic\s+sugarcane\s+alcohol\b/i,
  /\bwe\s+specialize\s+in\s+(?:making|using)\b/i,
  /\busing\s+uncut\b/i,
  /\bchemical\s+analysis\s+and\s+reproduction\b/i,
  /\bplease\s+note\s*:/i,
  /\b(?:carcinogen|phthalate)[-\s]?free\s+fragrance\b/i,
  /\bbi[-\s]?phase\s+fragrance\b/i,
  /\bdoes\s+require\s+shaking\s+before\s+use\b/i,
  /\bnot\s+responsible\s+for\s+(?:lost|stolen|customs)\b/i,
  /\bsales?\s+are\s+final\b/i,
  /\bsize\s+options?\s*-?\s*\d\s*ml\b/i,
  // "5ml • 15ml • …" sizing bullet lines
  /\b\d+\s*ml\s*[•·|\/,]\s*\d+\s*ml\b/i,
  // "Final Sale:" policy marker
  /\bfinal\s+sale\s*:/i,
  // "Sampling Size Policy:" marker
  /\bsampling\s+size\s+policy\s*:/i,
  // Independent-interpretation disclaimers
  /\bthis\s+(?:fragrance|scent|perfume)\s+is\s+an?\s+independent\b/i,
  /\bindependent\s+interpretation\s+inspired\b/i,
  /\ball\s+perfumes?\s+are\s+hand[-\s]?(?:filled|poured)\s+to\s+order\b/i,
  /\bhttps?:\/\//i,
]

/** Story copy before Fragrance Notes — must not truncate note extraction source. */
const POLICY_STRIP_DEFER_BEFORE_FRAGRANCE_NOTES: RegExp[] = [
  /\bi\s+was\s+told\b/i,
  /\bmaking\s+a\s+dupe\b/i,
  /\bplease\s+text\s+if\s+you\b/i,
]

const stripAtEarliestPatterns = (text: string, patterns: RegExp[]): string => {
  if (!text?.trim()) return ""
  const fragranceNotesIdx = text.search(/\bfragrance\s+notes?\b/i)
  let cutoff = text.length
  for (const re of patterns) {
    const m = re.exec(text)
    if (!m || m.index >= cutoff) continue
    const deferEarlyStory =
      fragranceNotesIdx >= 0 &&
      m.index < fragranceNotesIdx &&
      POLICY_STRIP_DEFER_BEFORE_FRAGRANCE_NOTES.some(dr => dr.test(m[0]))
    if (deferEarlyStory) continue
    cutoff = m.index
  }
  return text.slice(0, cutoff).replace(/\s+$/u, "").trim()
}

const stripPolicyBoilerplate = (text: string): string =>
  stripAtEarliestPatterns(text, POLICY_BOILERPLATE_START_PATTERNS)

/** Notes-source text after policy / ingredients / compliance blocks are removed. */
const prepareMerchantNotesSource = (text: string): string =>
  sanitizeCopyForNotePipeline(stripPolicyBoilerplate(text ?? ""))

/** PDP bootstrap chunk is useless when it is only shipping/legal/ingredients copy. */
const isUsablePdpNoteBootstrap = (chunk: string): boolean => {
  const prepared = prepareMerchantNotesSource(chunk)
  if (!prepared || prepared.length < 12) return false
  if (isPolicyOnlyMerchantDescription(chunk)) return false
  return hasExplicitNoteListSignal(prepared)
}

const probeAndromedaProductUrlForNotes = async (
  detailUrl: string,
  sig: AbortSignal | undefined,
): Promise<boolean> => {
  try {
    const res = await fetch(detailUrl, {
      signal: sig,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    })
    if (!res.ok) return false
    const html = await res.text()
    const chunk = extractMerchantNoteBootstrapFromHtml(html)
    if (!chunk || !isUsablePdpNoteBootstrap(chunk) || !hasExplicitNoteListSignal(chunk)) {
      return false
    }
    pdpNoteBootstrapCache.set(detailUrl, chunk)
    return true
  } catch {
    return false
  }
}

const resolveAndromedaDetailUrl = async (
  name: string,
  detailURL: string,
  sig: AbortSignal | undefined,
  onProgress?: (msg: string) => void,
): Promise<string> => {
  if (
    detailURL?.trim() &&
    detailUrlAlignsWithProductName(name, detailURL) &&
    !NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE.test(detailURL)
  ) {
    return detailURL
  }
  if (!name?.trim()) return detailURL

  for (const candidate of buildAndromedaCandidateProductUrls(name)) {
    if (candidate === detailURL) continue
    pdpNoteBootstrapCache.delete(candidate)
    if (await probeAndromedaProductUrlForNotes(candidate, sig)) {
      onProgress?.(
        `Notes pipeline: resolved Andromeda PDP URL for "${name.slice(0, 48)}" → ${candidate}`,
      )
      return candidate
    }
  }
  return detailURL
}

/** Wipe layers when every extracted token is alcohol/compliance boilerplate. */
const rejectComplianceDominatedLayers = (notes: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): { openNotes: string[]; heartNotes: string[]; baseNotes: string[] } => {
  const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
  if (all.length === 0) return notes
  const complianceCount = all.filter(n => isComplianceOrSourcingNote(n)).length
  if (complianceCount >= 2 && complianceCount >= all.length * 0.5) {
    return { openNotes: [], heartNotes: [], baseNotes: [] }
  }
  const drop = (arr: string[]) => arr.filter(n => !isComplianceOrSourcingNote(n))
  return {
    openNotes: drop(notes.openNotes),
    heartNotes: drop(notes.heartNotes),
    baseNotes: drop(notes.baseNotes),
  }
}

/** Template blocks (Scent Vibe, Sizes, Application, …) — for final CSV descriptions, not note extraction. */
const stripPdpSectionBoilerplate = (text: string): string =>
  stripAtEarliestPatterns(text, PDP_SECTION_BOILERPLATE_START_PATTERNS)

const stripMerchantDescriptionForStorage = (text: string): string =>
  stripPdpSectionBoilerplate(stripPolicyBoilerplate(text))

/**
 * Strip decorative Unicode (box drawing, fill blocks), ASCII-art divider lines, and C0 control
 * characters so labeled note lines and prose aren't hidden behind grid/marketing ornament.
 * Also fixes occasional LLM typos ("I cone" → "I come") that slip into noir copy.
 */
export const sanitizeCopyForNotePipeline = (text: string): string => {
  if (!text?.trim()) return ""
  let s = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
  s = s.replace(/[\u2500-\u257F\u2580-\u259F]/g, " ")
  const lines = s.split(/\r?\n/)
  const kept: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^[\s\-=*_|/\\·•]+$/u.test(trimmed) && trimmed.length >= 3) continue
    if (/^(?:body|html|\.color-|@media\b)/i.test(trimmed)) continue
    if (/\{[^}]*(?:font-family|radial-gradient|linear-gradient)/i.test(trimmed)) continue
    if (/\b(?:BlinkMacSystemFont|radial-gradient|font-family)\b/i.test(trimmed)) continue
    const decoChars = (trimmed.match(/[|*\-=_/\\·•─═│┼├┤]/gu) ?? []).length
    if (trimmed.length >= 8 && decoChars / trimmed.length > 0.55) continue
    const normalized = line.replace(/[ \t]+/g, " ").trimEnd()
    if (normalized) kept.push(normalized)
  }
  s = kept.join("\n")
  s = s.replace(/[\-*_=#]{4,}/g, " ")
  s = s.replace(/\n{3,}/g, "\n\n").trim()
  s = s.replace(/\bI\s+cone\b/gi, "I come")
  s = s.replace(/\bcone\s+to\b/gi, "come to")
  return s.trim()
}

/**
 * After stripping policy boilerplate, if the remaining narrative is too short to be useful, treat
 * the merchant description as unusable so the noir generator runs (when notes are available)
 * instead of preserving shipping/legal text.
 *
 * Returns `true` when the description should be wiped to "".
 */
const isPolicyOnlyMerchantDescription = (raw: string | null | undefined): boolean => {
  const t = (raw ?? "").trim()
  if (!t) return false
  const stripped = stripPolicyBoilerplate(t)
  // Less than 80 chars of real narrative after policy cutoff = treat as boilerplate-only.
  return stripped.length < 80
}

/** Pattern-by-Etsy and minified HTML glue layer headers: "AccordMiddle Notes:" → "Accord Middle Notes:" */
const splitGluedLayerLabels = (text: string): string =>
  text
    .replace(
      /(?<=[A-Za-z0-9)])(?=(?:top|open(?:ing)?|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry[\s-]*down|drydown|end)(?:\s+notes?)?\s*[:\-\u2013\u2014–—])/gi,
      " ",
    )
    .replace(
      /(?<=[A-Za-z0-9)])(?=(?:notes?\s+de\s+(?:tête|tete|cœur|coeur|fond))\s*:)/gi,
      " ",
    )
    .replace(
      /(?<=[A-Za-z0-9)])(?=(?:series|perfume\s+family|unisex|contains\s+true\s+animalics|scent\s+strength)\s*:)/gi,
      " ",
    )

/**
 * Shopify accordions (e.g. Parfums de Marly) often use "Top notes" as a heading with the list on the
 * next line. After `get_text` / whitespace collapse that becomes "Top notes Almond, Bergamot …"
 * without a colon, so layered parsers miss it — insert "Label: " before the list.
 */
const normalizeImplicitLayerColons = (text: string): string => {
  let s = text
  // "Top Notes Granny Smith" (label + "Notes" + list — no colon, whitespace-collapsed H3)
  s = s.replace(
    /\b(top|open(?:ing)?|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry[\s-]*down|drydown|end)\s+notes?\s+(?!(?:of|and|with|from|to|in|the|a|an|is|are)\b)(?=[A-Za-z])/gi,
    "$1: ",
  )
  // "Top: " already handled; also catch bare label standing alone before a capitalised list
  // e.g. "Fragrance Notes Top Granny Smith Apple, Pear" (no "Notes" suffix either)
  // Guard: only replace when immediately followed by a capital+lowercase material word,
  // NOT when followed by another layer label (to avoid "Top Middle Base" collapse).
  s = s.replace(
    /\b(top|opening|head|heart|middle|core|base|bottom|foundation|drydown)\s+(?!(?:notes?|of|and|with|from|to|in|the|a|an|is|are|open|mid|center|centre|body|background|bottom|foundation|dry|end)\b)(?=[A-Z][a-z])/g,
    "$1: ",
  )
  return s
}

/** Stop last layer chunk before Pattern/Etsy listing meta (avoids ':' in tokens → junk filter drops all base notes). */
const truncateAtShopMetaLabels = (s: string): string => {
  const m = s.match(
    /\s+(?:series|perfume\s+family|unisex|contains\s+true\s+animalics|scent\s+strength|extra info|cozy\s+and\s+soft|for\s+milk\s+lovers|pastel\s+girls|fans\s+of|extrait\s+de\s+parfum|hand-blended\s+with\s+care|gentle\s+projection|original\s+manufacturers|vibe\s*&\s*wear|vibe\b|wear\s*&\s*performance|wear\s+guide\b|good\s+to\s+know\b|season\s*:|projection\s*:|longevity\s*:|citrus\s+aromatic\b|amber-musky\b|seaside\s+breeze\b)\b/i,
  )
  if (m?.index != null) return s.slice(0, m.index).trim()
  return s.trim()
}

/**
 * When a note list chunk (e.g. a layer slice from `extractInlineLayeredNotes`) is followed
 * immediately by marketing prose — e.g. "Musk Perfect for anyone who loves..." — the
 * whitespace collapse in `extractNotesFromStructuredText` merges the note and prose into a
 * single comma token that the junk filter then drops.
 *
 * This function truncates the chunk at the start of the first clearly-prose run so that only
 * the material portion survives. We look for:
 *   1. "Perfect for", "Best for", "Great for", "A great", "A perfect", "Great choice",
 *      "A beautiful", "A wonderful", "Ideal for", "This fragrance", "This scent",
 *      "The opening", "The drydown", "The dry down", "The base" + verb, "Inspired by"
 *      — common Shopify PDP marketing paragraph starters
 *   2. A period or exclamation followed by a space + capital letter — hard sentence boundary
 *
 * The function is conservative: it only truncates when the prose marker appears AFTER at
 * least one comma-separated token (i.e., the chunk is not entirely prose).
 */
const truncateChunkAtProseStart = (chunk: string): string => {
  const paraIdx = chunk.search(/\n{2,}/)
  if (paraIdx > 0) {
    const cut = chunk
      .slice(0, paraIdx)
      .trimEnd()
      .replace(/,\s*$/, "")
      .trimEnd()
    if (cut.length > 0) return cut
  }

  // Marketing paragraph starters that signal the end of the note list and begin prose
  const PROSE_STARTS =
    /(?:\b(?:perfect|ideal|great|wonderful|excellent)\s+(?:for|choice|option)\b|\ba\s+(?:great|perfect|beautiful|wonderful|stunning|luxurious|gorgeous|rich|dark|warm|sensual|cozy)\s+choice\b|\b(?:this\s+(?:fragrance|scent|perfume|inspired|is)|the\s+(?:opening|drydown|dry\s+down|base\s+(?:lingers|settles|brings))|inspired\s+by|perfect\s+for\s+anyone|opens?\s+with\s+(?:a|the)|think\s+(?:crisp|fresh|warm|cool|dark|soft)|vibe\b|scent\s+story\b|how\s+it\s+wears|wear\s*&\s*performance\b|wear\s+guide\b|good\s+to\s+know\b|whether\s+you(?:'|'|&#39;)re\b|surrounds\s+you\s+in\b|sweet,\s*glamorous\b|glamorous\s*&\s*addictive\b|season\s*:|projection\s*:|longevity\s*:|available\s+sizes?|important\s+(?:information|shop|order)|all\s+perfumes?\s+are\s+hand|this\s+is\s+(?:a|an|the)\s+kind|cozy\s+and\s+soft|for\s+milk\s+lovers|pastel\s+girls|fans\s+of|extrait\s+de\s+parfum|hand-blended\s+with\s+care|gentle\s+projection|citrus\s+aromatic\b|amber-musky\b|seaside\s+breeze\b|original\s+manufacturers\b|wrap\s+(?:yourself|your\s+senses)|float\s+into|if\s+you\s+love)\b|description\s*:|like\s+(?:a|an)\b|each\s+(?:spray|spritz)\b)/i

  const sentenceBoundary = /[.!]\s+[A-Z]/

  // Only truncate if we have at least one real note already (comma in the string)
  const hasComma = chunk.indexOf(",") !== -1

  // "amber, vanilla, moss A flickering neon…" after bootstrap + noir collapse onto one line
  if (hasComma) {
    const gluedNoir = chunk.search(
      /\s+(?:A|An|The)\s+(?:flickering|neon|ghostly|electric|subtle|intoxicating)\b/i,
    )
    if (gluedNoir > 0) {
      const cut = chunk
        .slice(0, gluedNoir)
        .trimEnd()
        .replace(/,\s*$/, "")
        .trimEnd()
      if (cut.length > 0) return cut
    }
  }

  const proseMatch = PROSE_STARTS.exec(chunk)
  if (proseMatch?.index != null) {
    const cut = chunk.slice(0, proseMatch.index).trimEnd().replace(/,\s*$/, "").trimEnd()
    if (cut.length > 0) return cut
  }

  if (hasComma) {
    const sbMatch = sentenceBoundary.exec(chunk)
    if (sbMatch?.index != null) {
      const cut = chunk.slice(0, sbMatch.index + 1).trimEnd().replace(/,\s*$/, "").trimEnd()
      if (cut.length > 0) return cut
    }
  }

  return chunk
}

/**
 * When a long note+prose merge token makes it through comma-splitting (e.g.
 * "Musk Perfect for anyone who loves..." was last in the list with no comma),
 * try to rescue the valid note prefix that appears before the prose begins.
 * Returns the cleaned prefix if it looks like a valid 1–4 word note; otherwise null.
 */
const rescueNotePrefixFromProseToken = (
  token: string,
  isKept: (note: string) => boolean = isScraperKeptNote,
): string | null => {
  const t = token.trim()
  if (!t) return null
  // Already valid — don't process
  if (t.split(/\s+/).length <= 4) return null
  // Walk possible 1-to-4 word prefixes from the start of the token
  const words = t.split(/\s+/)
  for (let len = 1; len <= Math.min(4, words.length - 1); len++) {
    const candidate = words.slice(0, len).join(" ")
    if (isKept(candidate)) return candidate
  }
  return null
}

// ---------------------------------------------------------------------------
// Junk / keep rules (needed before structured extraction — long accords fail isDisplayableScentNote)
// ---------------------------------------------------------------------------

const JUNK_NOTE_PATTERNS: RegExp[] = [
  /[.!?;:(){}\[\]"]/, // punctuation → sentence fragment or copy
  /\d{2,}/, // numbers like sizes, prices, percentages
  /\d+(?:rem|em|ch|vw|vh|px|pt)\b/i, // CSS / layout tokens (e.g. 1rem, 12px)
  /\b(?:linear-gradient|rgba\s*\(|rgb\s*\(|hsl\s*\()\b/i,
  /^\b(?:rgba|margin|padding|border|display|flex|grid|position|z-index|font-size|background|opacity|transform|transition)(?:-\w+)?\b$/i,
  /^\b(?:touch|then|fabric|h[1-6]|body|html|sans-serif|serif|monospace|system-ui|blinkmacsystemfont|roboto|inter|helvetica|arial|radial-gradient|linear-gradient)\b$/i,
  /\b(?:font-family|webkit-font-smoothing)\b/i,
  /\b(?:f|of)\s+note\b/i,
  /\b(?:rum|whisky|whiskey)-like\b/i,
  /\b(?:warmth|embrace)\s+f\b/i,
  /\s+\bf\b$/i,
  /\b(buy|shop|order|add to cart|checkout|shipping|delivery|free|sale|discount|price|quantity|qty|sku)\b/i,
  /\b(livrare|cumpara|adauga|comanda|rapid|gratuit)\b/i, // Romanian commerce
  /\b(livraison|acheter|commande|gratuit)\b/i, // French commerce
  /\b(extrait|parfum|eau de|huile|spray|ml|oz)\b/i,
  /\b(discover|explore|experience|transform|reinvent|secret|powerful|irresistible|seductive|sensual|intense|long-lasting|unisex|pure|rebellious|unforgettable|alluring|intoxicating)\b/i,
  /\b(drenched\s+in|creating\s+an?\s+(?:unforgettable|experience)|rather\s+than|flanker\s+to|infused\s+cocktails?)\b/i,
  /\b(?:elegant\s+rather|dreamy\s+flanker|golden\s+light)\b/i,
  /\b\w+-kissed\b/i,
  /\bbecomes\s+your\s+skins?\b/i,
  /\bsoftened\s+with\b/i,
  /\bskins?\s+signature\b/i,
  /^(?:pink|red|blue|green|yellow|purple|blush|nude|fuchsia|magenta|turquoise|navy|teal|grey|gray)$/i,
  /\b(it is|you will|you can|this is|that is|with every|just a)\b/i,
  /\b(?:pastel\s+girls|gentle\s+projection|for\s+milk\s+lovers|hand-blended\s+with\s+care|scent\s+description)\b/i,
  /^(?:with|fans|roller)$/i,
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
  // Pattern / Etsy section fluff & non-fragrance “accords” (electronics, boilerplate)
  /\bpower source\b/i,
  /\bextra info\b/i,
  /\bif you'?re\s+curious\b/i,
  /\bbelow\s+if\s+you\b/i,
  // Site quotes / marketing leaked into note lists (e.g. Parfums de Marly founder blurbs, car copy)
  /\bfounder\b/i,
  /\ban iconic\b/i,
  /\btransmission\b/i,
  /\bcontinues the narrative\b/i,
  /\bexhilarates the senses\b/i,
  /^\bmystery\b$/i,
  // Room spray / candle PDP solvent copy and SEO blobs (not pyramid materials)
  /\baugeo\b/i,
  /\brenewable resources\b/i,
  /\bmade from renewable\b/i,
  /\b(?:non-gmo|non gmo|pesticides|fertilizers|phthalate|carcinogen|sugarcane alcohol|grown organically|sourced sustainably|using uncut|designers name|chemical analysis|environmentally friendly)\b/i,
  /^(?:organic|reproduction|ethically|uncut|gmo)$/i,
  /\bwhich is (colourless|colorless)\b/i,
  /\b(is vegan|colourless|colorless|odourless|odorless)\b/i,
  /\broom sprays\b/i,
  /\bwhat does\b.*\b(smell|smells)\b/i,
  /\bmanly accord\b/i,
  /\bopening with\b/i,
  /\bintermingle\b/i,
  /\bweaving\b/i,
  /\banimalic-foral\b/i,
  /\benhanced by\b/i,
  /\benriched by\b/i,
  /\bhints?\s+of\b/i,
  /\bcreating a rich\b/i,
  /\bclothing\b/i,
  // Shopify / theme copy: cookie banners, vault promos, prose fragments mis-parsed as notes
  /\bmoments?\s+of\s+pause\b/i,
  /\bentering\s+the\s+vault\b/i,
  // Marketing call-to-action sentences that occasionally land at the end of a "Featured Notes:"
  // line (e.g. Gallagher's Tulip Silk: "…sandalwood, tobacco, experiment for yourself")
  /\bexperiment\s+(?:for|with)\s+yourself\b/i,
  /\bexperiment\s+with\b/i,
  /\btry\s+(?:it|this)\s+(?:for|on)\s+yourself\b/i,
  /\bsee\s+for\s+yourself\b/i,
  /\bfor\s+yourself\b/i,
  // E‑commerce policy / ops copy mistaken for notes (e.g. indie Shopify PDPs)
  /\bcancellations?\b/i,
  /\bno\s+cancellations?\b/i,
  /\bno\s+changes?\b/i,
  /\bmaterials?\b/i,
  /\blabor\b/i,
  /\bprocessing\b/i,
  /\bexclude\s+weekends?\b/i,
  /\ball\s+sales\s+are\s+final\b/i,
  /\border\s+includes?\b/i,
  /\brefunds?\b/i,
  /\brefundable\b/i,
  /\bpolicy\b/i,
  /\ballocated\b/i,
  // Article-prefixed prose fragments ("a sweet", "an opening", "the center turns resinous")
  /^(?:a|an|the)\s+/i,
  // Preposition-prefixed prose fragments ("with aromatic longoza", "with a hint of")
  /^with\s+/i,
  // Marketing prose fragments / experience copy (not ingredient names)
  /\bthat\s+feels?\b/i,
  /\bgiving\s+it\s+a\b/i,
  /\ba\s+creamy\b/i,
  /\bjuicy\s+opening\b/i,
  /\bcreamy\s+heart\b/i,
  /\bcandy[-\s]like\b/i,
  /\bdessert[-\s]forward\b/i,
  /\bsmooth\s+finish\b/i,
  /\bgiving\s+it\b/i,
  /\bavailable\s+sizes\b/i,
  // Prose/experience words that are never standalone ingredients
  /\bfeel\b/i,
  /(?<!(?:amber|golden|honeyed|brown|burnt|warm|sheer|powdered|caramelized|rum-like|lingering woody)\s)\bwarmth\b/i,
  // Keep merchant phrases like "Honeyed Sweetness"; drop bare sensory descriptors only
  /(?<!(?:honeyed|brown|burnt|golden|warm|sheer|powdered|caramelized)\s)\bsweetness\b/i,
  /\btexture\b/i,
  /\bcharacter/i,
  /\bturns\b/i,
  /\bscents?\b/i,
  /\badding\b/i,
  /\bsoftly\b/i,
  /\bswirls?\s+of\b/i,
  /\bmake\s+it\b/i,
  /\bthrough\s+the\b/i,
  // "notes" at end of a phrase signals a header/descriptor, not a material
  /\bnotes?\s*$/i,
  // Single-token profile descriptors (genre labels, not materials)
  /^\bfeminine\b$/i,
  /^\bmasculine\b$/i,
  /^\bmusky\b$/i,
  /^\bwoody\b$/i,
  /^\bwood\b$/i,
  /^\bwoods\b$/i,
  /^\bfruity\b$/i,
  /^\bpowdery\b$/i,
  /^\bspicy\b$/i,
  /^\baquatic\b$/i,
  /^\baromatic\b$/i,
  /^\boriental\b$/i,
  /^\bgourmand\b$/i,
  /^\bfloral\b$/i,
  /^\bflorals\b$/i,
  /^\bflowers\b$/i,
  /^\bcitrus\b$/i,
  /^\bfresh\b$/i,
  /^\bfruit\b$/i,
  /^\bfruits\b$/i,
  /^\bspice\b$/i,
  /^\bspices\b$/i,
  /^\bresin\b$/i,
  /^\bresins\b$/i,
  /^\bsweet\b$/i,
  /^\bcozy\b$/i,
  /^\bjuicy\b$/i,
  /^\bplush\b$/i,
  /^\bsmoother\b$/i,
  /^\bwarmer\b$/i,
  /\bglowing\b/i,
  /\bmodern\b/i,
  /^\bplayful\b$/i,
  /^\bupscale\b$/i,
  /\beffortlessly\b/i,
  /^\bdelicate\b$/i,
  /\bairy\b/i,
  /^\bsmooth\b$/i,
  /^\bwarm\b$/i,
  /^\bcool\b$/i,
  /^\bluxe\b$/i,
  /^\bchanges\b$/i,
]

/** Junk checks for typical short notes — excludes the punctuation rule so accord phrases with () survive. */
const JUNK_NOTE_PATTERNS_NO_PUNCT: RegExp[] = JUNK_NOTE_PATTERNS.slice(1)

/**
 * Hard junk only — e-commerce, policy, and obvious non-note copy.
 * Merchant-labeled Top/Heart/Base (and flat "Featured notes:" lists) skip prose/sensory filters
 * like warmth, airy, or glowing that would otherwise drop valid indie-house note phrasing.
 */
const MERCHANT_LABELED_HARD_JUNK_PATTERNS: RegExp[] = [
  /\d{2,}/,
  /\d+(?:rem|em|ch|vw|vh|px|pt)\b/i,
  /\b(buy|shop|order|add to cart|checkout|shipping|delivery|free|sale|discount|price|quantity|qty|sku)\b/i,
  /\b(cancellations?|no\s+cancellations?|no\s+changes?|refunds?|refundable|processing|policy|allocated|labor)\b/i,
  /\b(?:non-gmo|pesticides|fertilizers|phthalate|carcinogen|sugarcane|grown organically|using uncut|designers name)\b/i,
  /\bgift\s+ideas\b/i,
  /\bpower source\b/i,
  /\bavailable\s+sizes\b/i,
  /\bexperiment\s+(?:for|with)\s+yourself\b/i,
  /\bfor\s+yourself\b/i,
  /^(?:a|an|the)\s+(?:sweet|night|center|mug|creamy)\b/i,
  /^(?:top|heart|base|middle|style|projection|facets|strength|concentration|margi|trail|halo|fabric|nuances|enveloping|sparkle|frosted|pastel|lactonic|originally|byredo|commodity)$/i,
  /\b(?:originally\s+from|frosted-pastel|summer\s+warm\s+days|clean\s+halo|longer\s+on\s+fabric|cloud\s+cream|candy\s+air|powdered\s+vanilla\s+style|the\s+creamy|cacao\s+the|a\s+mug|then\s+deepens|deepens\s+into|fluffy\s+glow)\b/i,
  /\b(?:projection|facets|trail|style|concentration|strength|nuances|enveloping|sparkle|halos?)\b/i,
  /\badds\b/i,
]

const isMerchantLabeledNote = (note: string): boolean => {
  const t = note.trim()
  if (!t) return false
  const lower = t.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 8) return false
  if (lower.length < 2 || lower.length > 80) return false
  if (MERCHANT_LABELED_HARD_JUNK_PATTERNS.some(p => p.test(lower))) return false
  if (looksLikeProseNotePhrase(t) || isObviousNonMaterialNote(t)) return false
  return isScraperKeptNote(t)
}

/**
 * Notes confirmed in merchant source text (labeled lists, flat lists, or material-line blocks).
 * Only these bypass strict junk filters and LLM validator drops — not arbitrary regex bleed.
 */
const collectMerchantTrustedNotes = (
  layers: {
    openNotes: string[]
    heartNotes: string[]
    baseNotes: string[]
  },
  source: string,
): Set<string> => {
  const corpus = buildNoteConfirmationCorpus(source)
  const trusted = new Set<string>()
  for (const n of [...layers.openNotes, ...layers.heartNotes, ...layers.baseNotes]) {
    const lc = n.trim().toLowerCase()
    if (!lc || !isMerchantLabeledNote(n)) continue
    if (isNoteSubstantiatedInSource(n, corpus, source)) trusted.add(lc)
  }
  return trusted
}

const mergeMerchantTrustedNotes = (
  into: Set<string>,
  layers: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
): void => {
  for (const n of [...layers.openNotes, ...layers.heartNotes, ...layers.baseNotes]) {
    const lc = n.trim().toLowerCase()
    if (lc) into.add(lc)
  }
}

const filterNotesByTrust = (arr: string[], _trusted: Set<string>): string[] =>
  arr.filter(n => isScraperKeptNote(n) && !looksLikeProseNotePhrase(n) && !isComplianceOrSourcingNote(n))

/** Expand space-joined blobs, sanitize marketing junk, and dedupe before CSV export. */
const finalizeNoteLayersForExport = (
  notes: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  merchantTrustedNotes: Set<string>,
): { openNotes: string[]; heartNotes: string[]; baseNotes: string[] } => {
  /** Drop lone `tonka` when `tonka bean` is already present in the same layer. */
  const dropSubsumedShorterNotes = (arr: string[]): string[] => {
    const normalized = arr.map(n => n.trim().toLowerCase())
    const hasTonkaBean = normalized.some(n => n === "tonka bean" || n === "tonka bean absolute")
    if (!hasTonkaBean) return arr
    return arr.filter(n => n.trim().toLowerCase() !== "tonka")
  }

  const sanitizeLayer = (arr: string[]) =>
    filterNotesByTrust(
      pruneLayerArtifactNotes(
        uniqueNotes(
          dropSubsumedShorterNotes(
            expandLayerNoteBlobs(arr)
              .map(n => sanitizeExtractedNoteCandidate(n))
              .filter((n): n is string => Boolean(n)),
          ),
        ),
      ),
      merchantTrustedNotes,
    )

  return dedupeNotesAcrossLayers({
    openNotes: sanitizeLayer(notes.openNotes),
    heartNotes: sanitizeLayer(notes.heartNotes),
    baseNotes: sanitizeLayer(notes.baseNotes),
  })
}

const looksLikeJunkNote = (note: string): boolean => {
  if (!note?.trim()) return true
  if (isObviousNonMaterialNote(note)) return true
  const n = note.trim().toLowerCase()
  if (n.split(/\s+/).length > 4) return true
  const hasProtectedHyphen = HYPHEN_PROTECTED_NOTE_FRAGMENTS.some(p => n.includes(p))
  if (
    !hasProtectedHyphen &&
    n.includes("-") &&
    /(?:like|forward|milky|creamy|juicy|heart|opening|feel)/i.test(n)
  ) {
    return true
  }
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

/** Strip leading prose wrappers before note tokens (e.g. "Notes of cinnamon" → "cinnamon"). */
const stripNoteListProsePrefix = (p: string): string =>
  p
    .replace(/^\s*(?:top|middle|base)\s+notes?\s+(?:are|is|of)\s+/i, "")
    .replace(/^\s*notes\s+of\s+/i, "")
    .replace(/^\s*note\s+of\s+/i, "")
    .replace(/^\s*a\s+hint\s+of\s+/i, "")
    .replace(/^\s*hints?\s+of\s+/i, "")
    .replace(/^\s*enhanced\s+by\s+/i, "")
    .replace(/^\s*enriched\s+by\s+/i, "")
    .replace(/^\s*creating\s+a\s+rich\s+/i, "")
    .trim()

/** Candidates from labeled Top/Middle/Base list lines (parentheticals, long accords). */
const filterStructuredNoteParts = (parts: string[]): string[] => {
  const out: string[] = []
  for (const raw of expandParentheticalNoteParts(parts)) {
    const cleaned = stripNoteListProsePrefix(raw.trim())
    if (!cleaned || looksLikeProseNotePhrase(cleaned)) continue
    const wordCount = cleaned.split(/\s+/).filter(Boolean).length
    if (wordCount > 4) {
      if (/\baccord\b/i.test(cleaned) && isMerchantLabeledNote(cleaned)) {
        const sanitized = sanitizeExtractedNoteCandidate(cleaned)
        if (sanitized) {
          out.push(sanitized)
          continue
        }
      }
      const rescued = rescueNotePrefixFromProseToken(cleaned, isMerchantLabeledNote)
      if (rescued) {
        const sanitized = sanitizeExtractedNoteCandidate(rescued)
        if (sanitized) {
          out.push(sanitized)
          continue
        }
      }
    }
    if (isMerchantLabeledNote(cleaned)) {
      const sanitized = sanitizeExtractedNoteCandidate(cleaned)
      if (sanitized) out.push(sanitized)
    } else {
      const rescued = rescueNotePrefixFromProseToken(cleaned, isMerchantLabeledNote)
      if (rescued) {
        const sanitized = sanitizeExtractedNoteCandidate(rescued)
        if (sanitized) out.push(sanitized)
      }
    }
  }
  return out
}

function classifyNoteLayer(label: string): "open" | "heart" | "base" | null {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, " ")
  // French pyramid labels (sites often use these; "notes de X" is one header)
  if (/^notes?\s+de\s+(tête|tete)$/.test(normalized)) return "open"
  if (/^notes?\s+de\s+(cœur|coeur)$/.test(normalized)) return "heart"
  if (/^notes?\s+de\s+fond$/.test(normalized)) return "base"
  if (/^note\s+di\s+(testa|olfattive)$/.test(normalized)) return "open"
  if (/^note\s+di\s+cuore$/.test(normalized)) return "heart"
  if (/^note\s+di\s+fondo$/.test(normalized)) return "base"
  if (/^notas\s+de\s+salida$/.test(normalized)) return "open"
  if (/^notas\s+de\s+(coraz[oó]n|corazon)$/.test(normalized)) return "heart"
  if (/^notas\s+de\s+fondo$/.test(normalized)) return "base"
  if (/^kopfnoten?$/.test(normalized)) return "open"
  if (/^herznoten?$/.test(normalized)) return "heart"
  if (/^basisnoten?$/.test(normalized)) return "base"
  if (/^duftnoten?$/.test(normalized)) return "open"
  if (/^topnoten?$/.test(normalized)) return "open"
  if (/^hartnoten?$/.test(normalized)) return "heart"
  if (/^(top|open|opening|head)(?: notes?)?$/.test(normalized)) return "open"
  if (/^(heart|middle|mid|core|body|center|centre)(?: notes?)?$/.test(normalized)) return "heart"
  if (/^(base|bottom|background|foundation|dry down|drydown|end)(?: notes?)?$/.test(normalized)) return "base"
  return null
}

function extractInlineLayeredNotes(text: string): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} {
  const empty = { openNotes: [] as string[], heartNotes: [] as string[], baseNotes: [] as string[] }
  const source = splitGluedLayerLabels(
    stripTrailingNonNoteSections(
      text
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, " ")
        .replace(/\r/g, "\n")
        .replace(/(?<!\n)\n(?!\n)/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    ),
  )
  if (!source) return empty

  const sectionRe =
    /\b(top(?:\s+notes?)?|open(?:ing)?(?:\s+notes?)?|head(?:\s+notes?)?|heart(?:\s+notes?)?|middle(?:\s+notes?)?|mid(?:\s+notes?)?|core(?:\s+notes?)?|body(?:\s+notes?)?|cent(?:er|re)(?:\s+notes?)?|base(?:\s+notes?)?|bottom(?:\s+notes?)?|background(?:\s+notes?)?|foundation(?:\s+notes?)?|dry\s*down(?:\s+notes?)?|drydown(?:\s+notes?)?|end(?:\s+notes?)?|notes?\s+de\s+(?:tête|tete)|notes?\s+de\s+(?:cœur|coeur)|notes?\s+de\s+fond|note\s+di\s+(?:testa|cuore|fondo|olfattive)|notas\s+de\s+(?:salida|coraz[oó]n|corazon|fondo)|kopfnoten?|herznoten?|basisnoten?|duftnoten?|topnoten?|hartnoten?)\s*[:\-\u2013\u2014–—]\s*/gi
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
    const chunk = truncateChunkAtProseStart(
      truncateAtShopMetaLabels(stripTrailingNonNoteSections(source.slice(start, end))),
    )
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
 * After whitespace collapse, "Notes: a, b, c Sweet as a slow…" becomes one line; capturing [^\n]+
 * pulls in the full PDP and splitNoteList's "and" → comma rule turns prose into fake notes.
 * Cut before marketing / accordion / cross-sell prose. Add new `RegExp` entries when a scrape
 * still bleeds PDP tail into note lists (each is tested with `.match()` — no `/g` flag).
 */
const FLAT_NOTE_PROSE_BOUNDARY_RES: RegExp[] = [
  // Next layer label — flat extraction captured beyond a single section (collapsed pyramid)
  /\s+(?:middle|mid|heart|center|centre|core|body|base|bottom|background|foundation|dry\s*down|drydown)(?:\s+notes?)?\s*:/i,
  // Shopify PDP specs after "Featured notes: …" (same paragraph when whitespace-collapsed)
  /\s+(?:Concentration|Volume)\s*:/i,
  // "Sweet " is gated below — it's also a real note prefix (Sweet Orange, Sweet Pea, Sweet Almond,
  // Sweet Basil, Sweet Pepper, Sweet Marjoram, Sweet Tea, Sweet Onion, Sweet Lime, Sweet Mandarin,
  // Sweet Cinnamon, Sweet Vanilla) and must not truncate mid-list.
  /\s+(?:Sipping |Read about|Beneath |Among |Caught |In the |A sudden |A whisper |A worn |A dusty |A low |A shimmering |A porcelain |A delicate |Fingers |Rain-soaked |Cloaked |Under the |Twist-top |Variation:|Join |Sign up|Select |Add to |Image \d+\s+of\s+\d+|Shop all|Skip to)\b/i,
  // "Sweet " only as a prose-tail (not "Sweet Orange" etc.). Negative lookahead lists common
  // compound notes that begin with "Sweet"; anything else means we hit prose like "Sweet as a memory".
  /\s+Sweet\s+(?!(?:Orange|Pea|Peas|Almond|Almonds|Basil|Pepper|Peppers|Marjoram|Tea|Onion|Lime|Mandarin|Sage|Corn|Potato|Cinnamon|Vanilla|Cherry|Plum|Rose|Apple|Caramel|Tobacco|Honey|Spice|Spices|Fennel|Clover|Grass|Wood|Woods|Cream|Milk|Butter|Bay|Pea|Pepper|Mint|Birch|Annie|William|Wattle|Acacia|Lemon|Magnolia|Osmanthus|Pea|Pepper))\b/i,
  /\s+(?:Available in |Originally (?:a |the )?|Our oil perfume|NOTE:|Packaging:|How to use|Shipping:|Return [Pp]olicy|Subscribe(?:\s+now|\s+today)?|You may also|Customers also|Related products|Complete the look|Pairs well|Also available|More from|Write a review|Questions\?|Leave a review)\b/i,
  /\s+#{1,6}\s*(?:Ingredients|How to use|Shipping|Returns?|FAQ|Details|Directions|Warnings?|Disclaimer|Specifications|Size [Gg]uide|Care [Ii]nstructions)\b/i,
  /\s+(?:Ingredients|Cruelty[- ]free|Vegan |Dermatologist|Clinically tested|Prop(?:osition|\.)?\s*65|FDA disclaimer)\b/i,
  // Common post-notes sections on indie Shopify PDP
  /\s+(?:When to Wear|Vibe|How It Wears|Wear\s*&\s*Performance|Wear\s+Guide\b|Good\s+to\s+Know\b|Whether\s+You(?:'|'|&#39;)re\b|Original\s+Manufacturers\b|Season\s*:|Projection\s*:|Longevity\s*:|How (?:It\s+)?Smells|Available Sizes?|Important Information|Important Shop Info|Final Sale|Sampling Size Policy|Fragrance Description(?!\s+:)|For\s+milk\s+lovers|pastel\s+girls|Hand-blended\s+with\s+care|Extrait\s+de\s+Parfum\s+strength|Citrus\s+Aromatic\b|Amber-Musky\b|Seaside\s+Breeze\b|Sweet,\s*Glamorous\b)\b/i,
  /\s+(?:Description\s*:|Like\s+(?:a|an)\b|Each\s+(?:spray|spritz)\b)/i,
  /\s+(?:Wrap\s+(?:yourself|your\s+senses)|Float\s+into|If\s+you\s+love|This\s+perfume\s+is)\b/i,
  /\s+(?:I was told|Making a dupe|Please text if you)\b/i,
  // Note set followed immediately by marketing paragraph openers (whitespace-collapsed)
  /\s+(?:Think\s+(?:crisp|fresh|warm|cool|dark|soft|juicy|lush)|Opens?\s+(?:with|on)|A\s+(?:crisp|juicy|dark|warm|rich|soft|bright|clean|bold|lush|fresh|dreamy|radiant|sleek|daring)\b|\bSparkling\b|\bThis\s+inspired\b)/i,
]

const MIN_FLAT_CHUNK_BEFORE_TRUNCATE = 8
/** "lemon, cedar — read more about …" / en-dash tails after lists (lower min — short lists still valid). */
const FLAT_NOTE_EM_DASH_TAIL_RE = /\s+[\u2013\u2014–—]\s+/
const MIN_FLAT_CHUNK_BEFORE_EM_DASH = 3

const truncateFlatNotesChunk = (chunk: string): string => {
  let s = chunk.trim().replace(/\*+\s*$/, "").trim()
  if (!s) return s
  let earliest = s.length
  for (const re of FLAT_NOTE_PROSE_BOUNDARY_RES) {
    const m = s.match(re)
    if (m?.index != null && m.index >= MIN_FLAT_CHUNK_BEFORE_TRUNCATE && m.index < earliest) {
      earliest = m.index
    }
  }
  const em = s.match(FLAT_NOTE_EM_DASH_TAIL_RE)
  if (em?.index != null && em.index >= MIN_FLAT_CHUNK_BEFORE_EM_DASH && em.index < earliest) {
    earliest = em.index
  }
  if (earliest < s.length) s = s.slice(0, earliest).trim()
  return s.replace(/,\s*$/, "").trim()
}

/**
 * Count how many distinct layer labels (Top/Middle/Base and equivalents) are present in
 * the collapsed source text. Used to detect whitespace-collapsed pyramids where the flat
 * extractor would incorrectly short-circuit.
 */
/** Main Accords lines (powdery, woody, musky) — not ingredient lists. */
const MAIN_ACCORD_DESCRIPTOR_RE =
  /^(?:powdery|woody|musky|mossy|fresh|sweet|floral|amber|oriental|gourmand|citrus|spicy|aromatic|green|aquatic|fruity|leather|smoky|balsamic|earthy|warm|cool|soft|intense|light|dark)$/i

const looksLikeMainAccordsDescriptorList = (notes: string[]): boolean => {
  if (notes.length < 3 || notes.length > 10) return false
  let hits = 0
  for (const n of notes) {
    const t = n.trim().toLowerCase()
    if (!t) continue
    if (MAIN_ACCORD_DESCRIPTOR_RE.test(t)) hits += 1
    else if (MAIN_ACCORD_DESCRIPTOR_RE.test(t.split(/\s+/)[0] ?? "")) hits += 1
  }
  return hits >= Math.max(3, Math.ceil(notes.length * 0.6))
}

const countInlineLayerLabels = (source: string): number => {
  const re =
    /\b(?:top(?:\s+notes?)?|open(?:ing)?(?:\s+notes?)?|head(?:\s+notes?)?|heart(?:\s+notes?)?|middle(?:\s+notes?)?|mid(?:\s+notes?)?|core(?:\s+notes?)?|body(?:\s+notes?)?|cent(?:er|re)(?:\s+notes?)?|base(?:\s+notes?)?|bottom(?:\s+notes?)?|background(?:\s+notes?)?|foundation(?:\s+notes?)?|dry\s*down(?:\s+notes?)?|drydown(?:\s+notes?)?|notes?\s+de\s+(?:tête|tete|cœur|coeur|fond)|note\s+di\s+(?:testa|cuore|fondo|olfattive)|notas\s+de\s+(?:salida|coraz[oó]n|corazon|fondo)|kopfnoten?|herznoten?|basisnoten?|topnoten?|hartnoten?)\s*:/gi
  return [...source.matchAll(re)].length
}

/** True when the match is immediately preceded by a layered label (top/heart/base …). */
const shouldSkipFlatNotesMatch = (source: string, matchIndex: number, prefixChars = 48): boolean => {
  const rawPrefix = source.slice(Math.max(0, matchIndex - prefixChars), matchIndex)
  if (
    /(?:top|open|opening|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry\s*down)\s+$/i.test(
      rawPrefix,
    )
  ) {
    return true
  }
  /** Main/key accords are descriptors, not materials — skip when a Fragrance Notes block exists. */
  const matchContext = source.slice(Math.max(0, matchIndex - 10), matchIndex + 28)
  if (/\b(?:main|key)\s+accords?\s*:/i.test(matchContext) && /\bfragrance\s+notes?\b/i.test(source)) {
    return true
  }
  return false
}

/**
 * Flat list patterns (no top/heart/base). Each `/gi` regex must expose **capture group 1** as the
 * comma-/“and”-separated list (same contract as `splitNoteList`). Patterns run on whitespace-collapsed
 * text; `truncateFlatNotesChunk` + `shouldSkipFlatNotesMatch` limit bleed into marketing copy.
 *
 * **Adding a new house:** reproduce the product-page phrase in a unit test, then append a regex here
 * (or a prose boundary in `FLAT_NOTE_PROSE_BOUNDARY_RES` if the list runs into accordion text).
 */
const FLAT_NOTE_LIST_PATTERNS: RegExp[] = [
  // "Notes:", "Fragrance notes – …" (line to newline) — not "Please note:" / processing banners
  /(?:^|[\s.!?\n])(?<!(?:please|processing)\s)(?:fragrance\s+)?notes?\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  // "Scent/fragrance/… notes include …" (sentence)
  /(?:^|[\s.!?\n*])(?:perfume|fragrance|scent|aroma|olfactory)\s+notes?\s+include\s+([^.!?\n*]+)/gi,
  // "The / our / these notes include …"
  /(?:^|[\s.!?\n*])(?:the|these|this|our)\s+notes?\s+include\s+([^.!?\n*]+)/gi,
  // "Fragrance notes are …" / "Scent notes is …" (some PDPs use singular)
  /(?:^|[\s.!?\n*])(?:perfume|fragrance|scent|aroma|olfactory)\s+notes?\s+(?:are|is)\s+([^.!?\n*]+)/gi,
  // "… notes consist(s) of …"
  /(?:^|[\s.!?\n*])(?:perfume|fragrance|scent|aroma|olfactory)\s+notes?\s+consist(?:s|ed)?\s+of\s+([^.!?\n*]+)/gi,
  // "Key notes:", "Featured notes – …" (line; often at line start without leading space)
  /(?:^|[\s.!?\n*])(?:key|main|primary|featured|signature|dominant)\s+notes?\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  // "Olfactory/scent/fragrance profile (or composition, pyramid) – …" (single-line collapsed PDPs)
  /(?:^|[\s.!?\n*])(?:olfactory|scent|fragrance|aroma|perfume)\s+(?:profile|composition|pyramid)\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  // "Key accords:" / "Accords – …" (many niche brands label materials this way)
  /(?:^|[\s.!?\n*])(?:key\s+)?accords?\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  // "With notes of …" (marketing sentence; stop at sentence end)
  /(?:^|[\s.!?\n*])\bwith\s+notes?\s+of\s+([^.!?\n*]+)/gi,
  // "The fragrance composition includes …"
  /(?:^|[\s.!?\n*])(?:the\s+)?(?:fragrance|scent|perfume)\s+composition\s+(?:includes|features|contains)\s+([^.!?\n*]+)/gi,
  // "… blend of …" — exclude `$` so `[^.!?]+` does not swallow `$16.00` and merge the last note with price.
  /(?:^|[\s.!?\n*])\b(?:sweet\/spicy\s+)?blend\s+of\s+([^.!?\n*$]+)/gi,
  /(?:^|[\s.!?\n*])\b(?:scent|fragrance|aroma)\s+blend\s+of\s+([^.!?\n*$]+)/gi,
  // "Dew and Honeysuckle...just what we imagine" (ellipsis then marketing; Wix / Seventh Muse)
  /\b([A-Z][^.!?\n*$]{2,85}?)\s*(?:\.{2,}|\u2026)\s*(?:just\b|here'?s|here\s+is|this\s+is|we\s+|you\s+'?ll|read\s+more)/gi,
  // German / Dutch / Italian / Spanish labeled single-line lists (collapsed PDPs)
  /(?:^|[\s.!?\n*])\b(?:kopfnoten?|herznoten?|basisnoten?|duftnoten)\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  /(?:^|[\s.!?\n*])\b(?:topnoten?|hartnoten?|basisnoten?)\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  /(?:^|[\s.!?\n*])\bnote\s+di\s+(?:testa|cuore|fondo|olfattive)\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  /(?:^|[\s.!?\n*])\bnotas\s+de\s+(?:salida|coraz[oó]n|fondo)\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
]

/**
 * Detect flat "NOTES: X, Y, Z" and common PDP paraphrases (no top/heart/base breakdown).
 * Places all notes into openNotes so the LLM volatility-spreading step can redistribute them,
 * and so they're always visible even when layer structure is unknown.
 */
function extractFlatNotes(text: string): string[] {
  const source = text?.trim()
  if (!source) return []
  const found: string[] = []

  const pushChunk = (raw: string) => {
    const chunk = truncateFlatNotesChunk(raw ?? "")
    const parsed = filterStructuredNoteParts(splitNoteList(chunk))
    if (parsed.length >= 2) {
      found.push(...parsed)
      return
    }
    if (chunk.split(/\s+/).filter(Boolean).length >= 3) {
      const glued = splitGluedMerchantNoteRun(chunk)
      if (glued.length >= 2) {
        found.push(...filterStructuredNoteParts(glued))
        return
      }
      const exploded = explodeSpaceSeparatedNoteBlob(chunk)
      if (exploded.length >= 2) {
        found.push(...filterStructuredNoteParts(exploded))
      }
    }
  }

  const collapsed = source.replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  const mainNotesGlued = collapsed.match(
    /\b(?:fragrance\s+profile\s+)?main\s+notes?\s+(?![:\-\u2013\u2014–—])([A-Za-z][^.!?]{8,220}?)(?=\s+Overall\s+Vibe|\s+Main\s+Accords?|\s+When\s+to\s+Wear|\s+Available\s+Sizes?|\s+How\s+(?:It\s+)?Wears|$)/i,
  )
  if (mainNotesGlued?.[1]) {
    found.push(...splitGluedMerchantNoteRun(mainNotesGlued[1].trim()))
  }

  found.push(...extractAndromedaStackedNotesFromPlain(collapsed))

  const scentProfile = extractAndromedaScentProfileFromPlain(collapsed)
  if (scentProfile.length >= 2) found.push(...scentProfile)

  for (const note of inferAndromedaAmarettoNotesFromProse(collapsed)) {
    if (!found.some(f => f.trim().toLowerCase() === note.toLowerCase())) found.push(note)
  }

  for (const re of FLAT_NOTE_LIST_PATTERNS) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(source)) !== null) {
      if (shouldSkipFlatNotesMatch(source, match.index)) continue
      pushChunk(match[1] ?? "")
    }
  }

  return uniqueNotes(found)
}

function extractNotesFromStructuredText(
  text: string,
  minConfidentFlatNotes = 2,
): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} {
  const empty = { openNotes: [] as string[], heartNotes: [] as string[], baseNotes: [] as string[] }
  // Strip emoji/pictograph characters before collapsing (e.g. 🌙 used as layer decorators in
  // stored descriptions like "🌙Top notes: … 🌙Middle notes: …"). When the multiline text is
  // collapsed to a single line, each emoji sits between the last note of one layer and the label
  // of the next, contaminating the note chunk boundary — "Magnolia Petals 🌙" becomes a token
  // that the LLM validator cannot cleanly identify.
  const stripped = (text ?? "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, " ")
  const collapsed = stripped
    .replace(/\r/g, "\n")
    .replace(/(?<!\n)\n(?!\n)/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
  const source = splitGluedLayerLabels(normalizeImplicitLayerColons(collapsed))
  if (!source) return empty

  /**
   * Merchant labeled lists (Featured/Key/Scent notes include, etc.) beat inline “Top:/Heart:”
   * heuristics that can misfire on prose (“warm notes of…”). Prefer the flat list whenever
   * extraction finds enough items (matches merge skip threshold).
   */
  const authoritativeFlat = extractFlatNotes(source)
  const unlabeledMaterials = extractUnlabeledFragranceNotesBlock(text ?? "")
  const inlineLayerCount = countInlineLayerLabels(source)
  const hasFragranceNotesBlock = /\bfragrance\s+notes?\b/i.test(text ?? "")

  if (unlabeledMaterials.length >= Math.max(2, minConfidentFlatNotes) && inlineLayerCount < 2) {
    return { openNotes: uniqueNotes(unlabeledMaterials), heartNotes: [], baseNotes: [] }
  }

  if (
    hasFragranceNotesBlock &&
    unlabeledMaterials.length >= Math.max(2, minConfidentFlatNotes) &&
    looksLikeMainAccordsDescriptorList(authoritativeFlat) &&
    inlineLayerCount < 2
  ) {
    return { openNotes: uniqueNotes(unlabeledMaterials), heartNotes: [], baseNotes: [] }
  }

  if (authoritativeFlat.length >= minConfidentFlatNotes && inlineLayerCount < 2) {
    if (hasFragranceNotesBlock && looksLikeMainAccordsDescriptorList(authoritativeFlat) && unlabeledMaterials.length > 0) {
      return { openNotes: uniqueNotes(unlabeledMaterials), heartNotes: [], baseNotes: [] }
    }
    const open = uniqueNotes([...authoritativeFlat, ...unlabeledMaterials])
    return { openNotes: open, heartNotes: [], baseNotes: [] }
  }

  const inlineNotes = extractInlineLayeredNotes(source)
  const inlineSeemsIncomplete =
    /(?:herznoten?|note\s+di\s+cuore|notes?\s+de\s+(?:cœur|coeur)|hartnoten?)\s*:/i.test(source) &&
    inlineNotes.heartNotes.length === 0 &&
    (inlineNotes.openNotes.length > 0 || inlineNotes.baseNotes.length > 0)
  if (
    !inlineSeemsIncomplete &&
    (inlineNotes.openNotes.length || inlineNotes.heartNotes.length || inlineNotes.baseNotes.length)
  ) {
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
    const layerPrefix = `(?:(?:scent|fragrance)\\s+notes?\\s+)?`
    const openMatch = normalized.match(
      new RegExp(`^${layerPrefix}(?:top|open|opening|head)(?:\\s+notes?)?\\s*[:\\-]\\s*(.+)$`, "i"),
    )
    if (openMatch) {
      openNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(openMatch[1]))))
      continue
    }
    const heartMatch = normalized.match(
      new RegExp(`^${layerPrefix}(?:heart|middle|mid|core|body|center|centre)(?:\\s+notes?)?\\s*[:\\-]\\s*(.+)$`, "i"),
    )
    if (heartMatch) {
      heartNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(heartMatch[1]))))
      continue
    }
    const baseMatch = normalized.match(
      new RegExp(`^${layerPrefix}(?:base|bottom|background|foundation|dry\\s*down|drydown|end)(?:\\s+notes?)?\\s*[:\\-]\\s*(.+)$`, "i"),
    )
    if (baseMatch) {
      baseNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(baseMatch[1]))))
      continue
    }
    const openFr = normalized.match(/^notes?\s+de\s+(?:tête|tete)\s*[:\-]\s*(.+)$/iu)
    if (openFr) {
      openNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(openFr[1]))))
      continue
    }
    const heartFr = normalized.match(/^notes?\s+de\s+(?:cœur|coeur)\s*[:\-]\s*(.+)$/iu)
    if (heartFr) {
      heartNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(heartFr[1]))))
      continue
    }
    const baseFr = normalized.match(/^notes?\s+de\s+fond\s*[:\-]\s*(.+)$/iu)
    if (baseFr) {
      baseNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(baseFr[1]))))
      continue
    }
    const openDe = normalized.match(/^kopfnoten?\s*[:\-]\s*(.+)$/i)
    if (openDe) {
      openNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(openDe[1]))))
      continue
    }
    const heartDe = normalized.match(/^herznoten?\s*[:\-]\s*(.+)$/i)
    if (heartDe) {
      heartNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(heartDe[1]))))
      continue
    }
    const baseDe = normalized.match(/^basisnoten?\s*[:\-]\s*(.+)$/i)
    if (baseDe) {
      baseNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(baseDe[1]))))
      continue
    }
    const openIt = normalized.match(/^note\s+di\s+testa\s*[:\-]\s*(.+)$/iu)
    if (openIt) {
      openNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(openIt[1]))))
      continue
    }
    const heartIt = normalized.match(/^note\s+di\s+cuore\s*[:\-]\s*(.+)$/iu)
    if (heartIt) {
      heartNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(heartIt[1]))))
      continue
    }
    const baseIt = normalized.match(/^note\s+di\s+fondo\s*[:\-]\s*(.+)$/iu)
    if (baseIt) {
      baseNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(baseIt[1]))))
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
    const alreadyLayered = new Set(
      [...layeredResult.openNotes, ...layeredResult.heartNotes, ...layeredResult.baseNotes].map(n =>
        n.trim().toLowerCase(),
      ),
    )
    const toAdd = flatNotes.filter(n => !alreadyLayered.has(n.trim().toLowerCase()))
    if (toAdd.length > 0) {
      return {
        openNotes: uniqueNotes([...layeredResult.openNotes, ...toAdd]),
        heartNotes: layeredResult.heartNotes,
        baseNotes: layeredResult.baseNotes,
      }
    }
  }

  if (layeredResult.openNotes.length || layeredResult.heartNotes.length || layeredResult.baseNotes.length) {
    if (unlabeledMaterials.length > 0) {
      const already = new Set(
        [...layeredResult.openNotes, ...layeredResult.heartNotes, ...layeredResult.baseNotes].map(n =>
          n.trim().toLowerCase(),
        ),
      )
      const toAdd = unlabeledMaterials.filter(n => !already.has(n.trim().toLowerCase()))
      if (toAdd.length > 0) {
        return {
          openNotes: uniqueNotes([...layeredResult.openNotes, ...toAdd]),
          heartNotes: layeredResult.heartNotes,
          baseNotes: layeredResult.baseNotes,
        }
      }
    }
    return layeredResult
  }

  return empty
}

// ---------------------------------------------------------------------------
// LLM note-extraction helper
// ---------------------------------------------------------------------------

const NOTE_SYSTEM_PROMPT = `You are a master perfumer. Extract fragrance notes from the product text and assign them to three layers.

Return ONLY a JSON object with exactly these keys (use these exact names):
  "openNotes":  string[] — top/opening notes (first impression, evaporates first)
  "heartNotes": string[] — middle/heart notes (core of the scent)
  "baseNotes":  string[] — base/dry-down notes (last to fade, depth)

Authoritative lists (must follow first):
- If the text contains a comma- or "and"-separated note list introduced by any of: "Scent notes include", "Fragrance notes are", "Fragrance notes:", "Notes:", "Note:", "Key notes:", "Featured notes", "Main notes:", "with notes of", or similar labeled lines, that list is the ONLY source of notes. Include every item verbatim (lowercase, English). Put them all in openNotes and set heartNotes and baseNotes to [] unless the same text explicitly defines Top/Heart/Base (or equivalent) grouping for those exact materials.
- If there is NO such labeled list but the copy clearly states materials in structured phrases like "opens with … Apricot, Black Tea, and … Neroli", "portrayed … by … Rose and Oakwood", or "greeted by warm notes of Maple, … Amber, and … Leather", extract those comma-/and-separated materials as the note set (open/heart/base by order or volatility).

Layer detection (only when there is NO authoritative flat list as above):
- If the text uses section headers (e.g. "Top:", "Heart:", "Base:" or "Opening:", "Mid:", "Body:", "Center:", "Bottom:", "Background:", "Dry down:" or "Head/Heart/Base", or French "Notes de tête / de cœur / de fond"), put each note in the matching layer.
- If it says "top notes include X, Y" or "heart: X, Y" or "base notes: X", follow that structure.
- If there is no layering, spread notes by typical volatility: citrus, herbs, light florals → openNotes; florals, spices, fruits → heartNotes; woods, musk, vanilla, amber, resins → baseNotes.
- When in doubt, prefer putting a note in heartNotes rather than omitting it.

Prose extraction (when there is no labeled list — narrative copy and storytelling can still name real materials):
- Extract every named fragrance material that appears anywhere in the text, even when it is woven into metaphor or storytelling. Examples of materials to keep: rose, plum, honey, brown sugar, smoke, leather, amber, vanilla, sandalwood, oakwood, bergamot, jasmine, musk, oud, tobacco, incense, patchouli, cedar, vetiver, lavender, neroli, bourbon, whiskey, coffee, cocoa, hay, salt, sea, rain, ozone, peppercorn, cinnamon, clove, ginger.
- Do NOT skip a material just because it appears inside a metaphor sentence ("she wore plum and rose like a secret" still means plum and rose are notes).
- Ignore non-material storytelling words (e.g. "shadow", "midnight", "secret", "temptation", "velvet" as a texture, "moonlight", "whisper", "promise").

Rules (when not using a single authoritative list):
- Extract every fragrance note mentioned in the narrative — include every scent ingredient (e.g. vanilla, rose, black pepper, sandalwood, bergamot, jasmine, musk, amber, oud).
- Notes must be lowercase and in ENGLISH. Translate any non-English note names: "santal" → "sandalwood", "musc" / "musc blanc" → "white musk", "vanille" → "vanilla", "ambre" → "amber", "bois" → "wood", "rose" → "rose", "fleur" → "flower", "tabac" → "tobacco", "encens" → "incense".
- Remove duplicates within each array.
- Adjectives that describe a note → keep as phrase ONLY when the core ingredient is a real scent material. "warm vanilla" ✓  "warm sandalwood" ✓  "glowing amber warmth" ✗ (warmth is not a material).
- Omit pure marketing fluff that is not a note (e.g. "luscious", "irresistible", "seductive", "sensual", "confidence", "courage", "healing", "balance", "vitality" as standalone words).
- NEVER include crystals, gemstones, or minerals as notes (e.g. quartz, amethyst, herkimer diamond, topaz, tourmaline, moonstone, labradorite, gem magic, citrine, obsidian, selenite). These are not fragrance notes.
- NEVER include carrier oils or base ingredients as notes (e.g. sunflower oil, jojoba oil, shea butter, coconut oil, sweet almond oil, argan oil). These are not fragrance notes.
- NEVER treat storefront section headers or specs as notes (e.g. "Extra Info Below if You're Curious", "power source accord", battery/USB copy). These are not fragrance notes.
- NEVER treat solvent/carrier marketing as notes (e.g. "vegan augeo", "made from renewable resources", "colourless", "odourless", "is vegan", "room sprays", "what does X smell like" SEO lines). These are not fragrance pyramid materials.
- NEVER treat people, roles, or quote fluff as notes (e.g. founder, iconic, transmission, "continues the narrative", attributions like perfumer names).
- NEVER output scent-profile genre tokens as standalone notes (e.g. musky, woody, fruity, powdery, feminine, citrus, floral, gourmand, aquatic as single-word entries — "fresh bergamot" as a phrase is fine). EXCEPTION: qualified multi-word forms that name a specific ingredient class ARE valid: "white flowers" ✓, "white florals" ✓, "white musk" ✓, "green tea" ✓, "black tea" ✓, "red fruits" ✓, "citrus fruits" ✓. Only bare unqualified single-word genre labels are banned.
- NEVER output e-commerce or policy language as notes (e.g. cancellations, materials, labor, processing, changes, exclude weekends, all sales are final, order includes, refunds).
- NEVER output experience-fragment or marketing sentence tails as notes (e.g. "juicy opening", "a creamy candy-like heart", "giving it a smooth", "ginger that feels vibrant", "that feels cozy").
- NEVER start a note with an article: "a sweet" ✗  "an opening" ✗  "the base" ✗.
- NEVER include sensory experience words that are not materials: warmth, sweetness, feel, texture, character, presence, opening, scent, airy, glowing, softly, effortlessly, modern, adding — these describe experiences, not ingredients.
- If the product is clearly NOT a fragrance (e.g. jewelry, necklace, candle, body scrub, hair product, supplement), return all empty arrays: {"openNotes":[],"heartNotes":[],"baseNotes":[]}.

SELF-CHECK before returning: for each note in your arrays ask "Is this a named scent material — a botanical, natural extract, synthetic aroma molecule, or established accord name?" If no, remove it.
  ✗ Remove: "a sweet", "glowing amber warmth", "effortlessly pretty", "romantic feel", "the center turns resinous", "airy aquatic notes", "modern opening", "warm sweetness", "skin scents", "adding softness", "woody through the heart", "soft swirls of vanilla", "moonlit character"
  ✓ Keep: "vanilla", "warm sandalwood", "bergamot", "orris butter", "tonka bean", "smoked leather", "peru balsam", "tahitian vanilla", "black currant", "marshmallow fluff", "whipped cream", "orris butter", "praline", "granny smith apple", "pitahaya", "soft musk", "powdery woods", "vanilla cream"

Return only the JSON object — no explanation, no markdown fences.`

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

const NAME_ONLY_PROMPT_STRICT = `You extract fragrance notes from a product name ONLY when the name contains literal scent materials or recognizable fragrance names.

Return ONLY a JSON object: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}.

Rules:
- Include only materials or fragrance names explicitly present in the product name (e.g. "Lavender & Vanilla" → lavender in openNotes, vanilla in baseNotes by volatility is optional — use one layer or split sensibly).
- Do NOT invent thematic, mythological, mood-based, or "witchy/gourmand palette" notes from abstract titles.
- If the name has no identifiable scent ingredients, return {"openNotes":[],"heartNotes":[],"baseNotes":[]}.
- Lowercase only. No duplicates. No markdown or explanation.`

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
- NEVER return all empty arrays. Always provide AT LEAST 3 notes total, distributed across at least two of the three layers. Prefer 4-6 notes total for evocative/abstract names. Cap the total at 6 notes — do not pad with generic filler.
- For recognized fragrances (e.g. Lush Lord of Misrule, Karma, Rose Jam), use the fragrance's documented top/heart/base notes — do not return only a single generic note like "musk".
- Use lowercase. No duplicates. No explanation, no markdown.
- Assign by volatility: citrus, herbs, green, light florals → openNotes; florals, spices, fruits → heartNotes; woods, musk, vanilla, amber, oud, resins → baseNotes.
- NEVER output e-commerce or policy words, scent-profile single-word genre tokens, or experience fragments as notes (same exclusions as the main extractor: cancellations, materials, labor, musky/woody/feminine as standalone tokens, "juicy opening", etc.).`

/** Keys the LLM might use for each layer; we normalize to openNotes, heartNotes, baseNotes. */
const OPEN_KEYS = ["openNotes", "open", "opening", "openingNotes", "topNotes", "top", "headNotes", "head"]
const HEART_KEYS = [
  "heartNotes",
  "heart",
  "middleNotes",
  "middle",
  "midNotes",
  "mid",
  "coreNotes",
  "bodyNotes",
  "body",
  "centerNotes",
  "center",
  "centreNotes",
  "centre",
]
const BASE_KEYS = [
  "baseNotes",
  "base",
  "dryDownNotes",
  "dryDown",
  "dry-down",
  "endNotes",
  "end",
  "bottomNotes",
  "bottom",
  "backgroundNotes",
  "background",
  "foundationNotes",
  "foundation",
]

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

const MERGE_STRUCTURED_SUPPLEMENT_PROMPT = `You rebalance a perfume note list that was already parsed from the product page (labeled Top/Middle/Base and/or flat lists).

Return ONLY JSON: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}.

Rules:
- Every note in the provided structured arrays MUST still appear in your output (same spelling intent; lowercase).
- Do NOT add new notes from evocative marketing prose, noir-style storytelling, or mood copy. Only add a note if the full text contains another explicit labeled note list or clear Top/Heart/Base section naming that material.
- Do NOT output any material that is not already named in the structured arrays or in an explicit labeled note line in the full text (e.g. "Featured notes:", "Notes:"). Re-layer only; never invent plum/rose/musk from figurative sentences.
- If structured openNotes is non-empty and heartNotes and baseNotes are both empty (flat list), keep all notes in openNotes unless the full text explicitly defines a pyramid — do not invent heart/base layers from adjectives in prose.
- No duplicates across layers, no marketing sentences, lowercase only.
- Carrier oils, gemstones, and SKU/meta lines are not notes.
- Never add section boilerplate or product specs: "extra info", "if you're curious", "power source accord", etc.
- Never add solvent or listing filler: "vegan augeo", "renewable resources", "colourless/odourless", "is vegan", "room sprays", "what does … smell like", or clothing/fashion words from prose (e.g. "clothing", "trench coat") unless they are an explicit labeled scent accord.
- Never add quote or brand fluff: founder, iconic, transmission, narrative, perfumer names, or similar — only real scent materials.`

const noteLayerCount = (n: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] }): number =>
  n.openNotes.length + n.heartNotes.length + n.baseNotes.length

/**
 * Python HTML extraction is useful, but when Node has already rebuilt a stronger merchant pyramid
 * (e.g. via Andromeda PDP bootstrap), do not blindly re-add Python blobs like
 * "orange bergamot golden mist". Only merge Python-only notes that are still explicitly
 * substantiated in the current note source.
 */
const mergeExistingPythonNotes = (
  current: NotesLayers,
  existing: NotesLayers | null,
  notesSource: string,
): NotesLayers => {
  if (!existing || noteLayerCount(existing) === 0) return current

  const currentIsAuthoritative =
    hasLayeredMerchantPyramid(current) || noteLayerCount(current) >= noteLayerCount(existing)

  if (!currentIsAuthoritative) {
    return dedupeNotesAcrossLayers({
      openNotes: uniqueNotes([...existing.openNotes, ...current.openNotes]),
      heartNotes: uniqueNotes([...existing.heartNotes, ...current.heartNotes]),
      baseNotes: uniqueNotes([...existing.baseNotes, ...current.baseNotes]),
    })
  }

  const corpus = buildNoteConfirmationCorpus(notesSource)
  const keepIfSubstantiated = (arr: string[]): string[] =>
    arr.filter(note => isNoteSubstantiatedInSource(note, corpus, notesSource))

  return dedupeNotesAcrossLayers({
    openNotes: uniqueNotes([...keepIfSubstantiated(existing.openNotes), ...current.openNotes]),
    heartNotes: uniqueNotes([...keepIfSubstantiated(existing.heartNotes), ...current.heartNotes]),
    baseNotes: uniqueNotes([...keepIfSubstantiated(existing.baseNotes), ...current.baseNotes]),
  })
}

/** Regex + structured materials the merge step is allowed to keep; blocks LLM “invention” from marketing prose. */
const buildLowercaseNoteUniverse = (
  structured: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  fullText: string,
): Set<string> => {
  const u = new Set<string>()
  for (const n of [...structured.openNotes, ...structured.heartNotes, ...structured.baseNotes]) {
    const k = n.trim().toLowerCase()
    if (k) u.add(k)
  }
  for (const n of extractFlatNotes(fullText)) {
    const k = n.trim().toLowerCase()
    if (k) u.add(k)
  }
  return u
}

const filterLayersToUniverse = (
  layers: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  universe: Set<string>,
): { openNotes: string[]; heartNotes: string[]; baseNotes: string[] } => ({
  openNotes: layers.openNotes.filter(n => universe.has(n.trim().toLowerCase())),
  heartNotes: layers.heartNotes.filter(n => universe.has(n.trim().toLowerCase())),
  baseNotes: layers.baseNotes.filter(n => universe.has(n.trim().toLowerCase())),
})

const mergeStructuredNotesWithLlm = async (
  llm: ChatOpenAI,
  structured: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  fullText: string,
  productName: string,
): Promise<{ openNotes: string[]; heartNotes: string[]; baseNotes: string[] }> => {
  if (noteLayerCount(structured) === 0 || !fullText?.trim()) return structured
  const universe = buildLowercaseNoteUniverse(structured, fullText)
  const user = `Product: "${productName.slice(0, 200)}"

Structured notes already found (keep every one; re-layer across open/heart/base only — do NOT add new note names that are not already in the structured arrays or in an explicit labeled note line in the full text):
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
    const merged = parseNotesFromLlmResponse(getLlmInvocationText(response))
    const mergedSanitized = filterLayersToUniverse(merged, universe)
    const before = noteLayerCount(structured)
    const after = noteLayerCount(mergedSanitized)
    if (after === 0 || after < Math.ceil(before * 0.5)) return structured
    // Union only materials that already appeared in structured or regex flat extraction — never raw LLM hallucinations.
    return {
      openNotes: uniqueNotes([...structured.openNotes, ...mergedSanitized.openNotes]),
      heartNotes: uniqueNotes([...structured.heartNotes, ...mergedSanitized.heartNotes]),
      baseNotes: uniqueNotes([...structured.baseNotes, ...mergedSanitized.baseNotes]),
    }
  } catch {
    return structured
  }
}

async function extractNotesFromDescription(
  llm: ChatOpenAI,
  description: string,
  productNameFallback: string | undefined,
  inferenceMode: NoteInferenceMode = "standard",
): Promise<{
  layers: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] }
  extractionPath: "description" | "name_only" | "none"
}> {
  const empty = { openNotes: [] as string[], heartNotes: [] as string[], baseNotes: [] as string[] }
  const descTrimmed = description?.trim() ?? ""
  const nameTrimmed = productNameFallback?.trim() ?? ""

  if (!descTrimmed && !nameTrimmed) return { layers: empty, extractionPath: "none" }

  // ── Path A: We have a description ────────────────────────────────────────
  if (descTrimmed) {
    const userContent = nameTrimmed
      ? `Product name: "${nameTrimmed.slice(0, 200)}"\n\nProduct description:\n"${descTrimmed.slice(0, 3500)}"`
      : `Product description:\n"${descTrimmed.slice(0, 3500)}"`

    try {
      const response = await llm.invoke([
        { role: "system", content: NOTE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ])
      const notes = parseNotesFromLlmResponse(getLlmInvocationText(response))
      if (notes.openNotes.length + notes.heartNotes.length + notes.baseNotes.length > 0) {
        return { layers: notes, extractionPath: "description" }
      }
    } catch {
      // fall through to retry
    }

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
      const retryNotes = parseNotesFromLlmResponse(getLlmInvocationText(retryResponse))
      if (retryNotes.openNotes.length + retryNotes.heartNotes.length + retryNotes.baseNotes.length > 0) {
        return { layers: retryNotes, extractionPath: "description" }
      }
    } catch {
      // fall through to name-only
    }
  }

  // ── Path B: No description (or description extraction failed) — extract from name ──
  if (nameTrimmed) {
    const namePrompt = inferenceMode === "strict" ? NAME_ONLY_PROMPT_STRICT : NAME_ONLY_PROMPT
    try {
      const response = await llm.invoke([
        { role: "system", content: namePrompt },
        { role: "user", content: `Product name: "${nameTrimmed.slice(0, 200)}"` },
      ])
      return {
        layers: parseNotesFromLlmResponse(getLlmInvocationText(response)),
        extractionPath: "name_only",
      }
    } catch {
      return { layers: empty, extractionPath: "none" }
    }
  }

  return { layers: empty, extractionPath: "none" }
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
    return parseNotesFromLlmResponse(getLlmInvocationText(response))
  } catch {
    return empty
  }
}

// ---------------------------------------------------------------------------
// Film noir description generation
// ---------------------------------------------------------------------------

/**
 * Wix / theme scrapes sometimes capture cross-sell strips and inline editor CSS instead of PDP copy.
 * Those rows must not be treated as "merchant description" (which would skip noir for thin note lists).
 */
const isJunkScrapedDescription = (text: string | null | undefined): boolean => {
  const t = text?.trim() ?? ""
  if (!t) return false
  const lower = t.toLowerCase()
  if (/original,\s*artisan\s+perfumes/i.test(lower) && /art in air/i.test(lower)) return true
  if (/the scent story/i.test(lower) && /\b(?:top|middle|base)\s+notes?\s*:/i.test(lower)) {
    return true
  }
  if (/click\s+pic\s+to\s+see\s+all/i.test(lower)) return true
  if (/shea\s+butter\s*&\s*aloe\s+lotion/i.test(lower) && /\$\s*\d/.test(t)) return true
  if (/spray\s+mists\s*\$/i.test(lower)) return true
  if (/#comp-[a-z0-9]{4,}/i.test(t) && (/\{\s*fill\s*:/i.test(t) || /\[data-color\s*=/i.test(lower))) return true
  if (/^\s*\/\*/.test(t) && /\b(max-width|margin\s*:\s*0\s+auto|\.am-wrapper|linear-gradient)\b/i.test(lower)) {
    return true
  }
  if (
    /\b(?:rgba|linear-gradient|max-width|margin\s*:\s*0)\b/i.test(lower) &&
    /\b(?:h[1-6]|\.am-wrapper|#comp-)\b/i.test(lower)
  ) {
    return true
  }
  if (/\bfragrance\s+sampler\b/i.test(lower)) return true
  if (/\bfour\s+piece,\s*glass,\s*5\s*ml\b/i.test(lower)) return true
  if (/\bplease\s+pick\s+6-8\s+choices\b/i.test(lower)) return true
  if (/\border\s+special\s+instructions\s+box\b/i.test(lower)) return true
  if (/\bvegan\s+faux\s+suede\s+bag\b/i.test(lower)) return true
  if (/\b15\s+coupon\b/i.test(lower)) return true
  return false
}

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

// ---------------------------------------------------------------------------
// Bulk LLM note validator (runs once per scrape over the union of unique notes)
// ---------------------------------------------------------------------------

const NOTE_VALIDATOR_SYSTEM_PROMPT = `You are a perfumery expert. For each input string, decide whether it names a real fragrance material and, if needed, normalise it to just the material — stripping pure-prose adjectives that are NOT olfactory descriptors.

OLFACTORY descriptors that MUST be kept with the material (they describe how it smells / its texture or origin):
  creamy, milky, buttery, smoky, smoked, fresh, dry, warm, cool, sweet, dark, deep, bright, green, woody, resinous, powdery, ambered, salted, candied, toasted, roasted, burnt, raw, aged, vintage, wild, fermented, balsamic, golden (when origin/material like "golden amber"), tahitian, madagascar, bourbon, bulgarian, sicilian, indian, javanese, white, black, pink, red, blue, granny, soft (only with musk/leather/woods), whipped (only with cream/milk), powdery (only with woods/iris/musk).
  Examples: "creamy vanilla" → "creamy vanilla" ✓, "warm sandalwood" → "warm sandalwood" ✓, "smoked vanilla" → "smoked vanilla" ✓, "tahitian vanilla" → "tahitian vanilla" ✓, "black currant" → "black currant" ✓, "granny smith apple" → "granny smith apple" ✓, "whipped cream" → "whipped cream" ✓, "soft musk" → "soft musk" ✓, "powdery woods" → "powdery woods" ✓, "vanilla cream" → "vanilla cream" ✓.

VALID notes that are NOT single common materials — keep these exactly as-is (DO NOT drop them as "generic"):
  marshmallow fluff, vanilla cream, orris butter, whipped cream, soft musk, powdery woods, granny smith apple, pitahaya, praline, orris root, iris butter, cashmere wood, cashmere woods, benzoin resinoid, ambrette seed, ambroxan, hedione, iso e super, javanol, clearwood, galaxolide, habanolide, musks (accord), cashmeran, solar musk, skin musk, solar wood, tonka absolute, skin accord.

PROSE adjectives that MUST be stripped, leaving only the material:
  delicate, sunlit, moonlit, glowing, romantic, dreamy, silken, velvety, intoxicating, mysterious, dangerous, alluring, seductive, sultry, airy, juicy, tropical (as adjective), modern, effortless, refined, ethereal, fluffy, sugary, cloudlike, glossy, lush, vibrant, opulent, decadent, sensuous, sensual, magnetic, luminous, gleaming, shimmering, whispered, hidden, secret, ripe, fluffy, plush, expensive, comforting, addictive, sparkling (as adjective), bright (only alone), crisp (only alone).
  Examples: "delicate apple blossom" → "apple blossom"; "soft violet" → "violet"; "sugary marshmallow clouds" → "marshmallow"; "glossy strawberry glaze" → "strawberry"; "ripe blackcurrant" → "blackcurrant"; "lush jasmine" → "jasmine"; "fluffy marshmallow" → "marshmallow"; "crisp green apple" → "green apple"; "sparkling bergamot" → "bergamot".

DROP (do not include in output at all) when the string has no material at its core:
- Article-prefixed prose with no material: "a sweet", "the night", "the center turns resinous".
- Sensory experience words alone: "warmth", "sweetness", "feel", "texture", "character", "scents", "presence", "opening", "finish".
- Vague descriptors alone: "tropical", "fruity", "fresh", "modern", "airy", "glowing", "softly", "effortlessly", "delicate", "warmer", "smoother", "playful", "upscale".
- Generic substrate-only words: "wood", "florals", "flowers", "fruit", "spice", "musks" (alone, with no qualifier). But "sandalwood" ✓, "cashmere wood" ✓, "white musk" ✓, "white flowers" ✓, "white flower" ✓, "white florals" ✓, "red fruits" ✓, "citrus fruits" ✓, "wild flowers" ✓, "spring flowers" ✓, "tropical flowers" ✓, "fresh flowers" ✓. Any adjective + substrate combination that names a recognised perfumery accord is VALID.
- Multi-word prose with no nameable material: "sunlit burst of melon" → DROP (it has "melon" but the wrapper is prose; ✗ keep only if the core material is unambiguous AND extractable, e.g. "sunlit burst of melon" → "melon" is OK to extract; use judgment). When in doubt, extract just the material.
- Concatenated/mangled text: "moonlit characterwarm", "crme brle custard" (the latter is mangled "crème brûlée custard" — accept if you can canonicalise to "crème brûlée").
- Phrases describing how the scent acts: "musk make it smooth", "adding softness", "warmer finish with vanilla", "a heart of coffee" → DROP (or extract bare "vanilla"/"coffee" if it is the only material).
- E-commerce / policy / non-material content.

Return ONLY a JSON object in this exact shape (no markdown, no commentary):
{
  "valid": [
    { "in": "<original input string, lowercase>", "out": "<cleaned material name, lowercase>" }
  ]
}

Rules for the response:
- Only include entries whose \`out\` is a real material (or material with kept olfactory descriptor).
- \`in\` must EXACTLY match an input string (lowercased). Never invent inputs.
- \`out\` is the cleaned material name. Often \`out === in\` (no change needed). When stripping prose adjectives, \`out\` is shorter.
- Omit any input that has no extractable material at all.
- Lowercase only. No duplicates by \`in\`.`

/**
 * Classify and clean every candidate note with one bulk LLM call. Returns a substitution Map
 * from lowercased original note to lowercased cleaned material name. Notes not present in the
 * map should be DROPPED.
 *
 * Fail-open: any error or unparseable response returns an identity map (every input → itself)
 * so the scrape never loses notes due to a validator outage.
 *
 * Cost: a single chat-completion per scrape regardless of batch size.
 */
const validateNotesWithLlm = async (
  llm: ChatOpenAI,
  candidates: string[],
): Promise<Map<string, string>> => {
  const lowered = Array.from(
    new Set(candidates.map(n => n.trim().toLowerCase()).filter(Boolean)),
  )
  const identityMap = (): Map<string, string> => new Map(lowered.map(n => [n, n]))
  if (lowered.length === 0) return identityMap()

  try {
    const response = await llm.invoke([
      { role: "system", content: NOTE_VALIDATOR_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ candidates: lowered }) },
    ])
    const text = getLlmInvocationText(response)
    const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return identityMap()

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const rawValid = Array.isArray(parsed.valid) ? parsed.valid : []
    const substitutions = new Map<string, string>()
    const inputSet = new Set(lowered)
    for (const entry of rawValid) {
      if (!entry || typeof entry !== "object") continue
      const e = entry as Record<string, unknown>
      const inLc = typeof e.in === "string" ? e.in.trim().toLowerCase() : ""
      const outLc = typeof e.out === "string" ? e.out.trim().toLowerCase() : ""
      if (!inLc || !outLc) continue
      if (!inputSet.has(inLc)) continue
      substitutions.set(inLc, outLc)
    }
    /**
     * Sanity floor: if the model returned a substitution map covering less than 10% of inputs,
     * assume the call went off the rails (format slip, truncation) and fail open. Real fragrance
     * batches reliably have most notes pass; <10% coverage is a smell, not a real rejection rate.
     */
    if (substitutions.size === 0 || substitutions.size < Math.floor(lowered.length * 0.1)) {
      return identityMap()
    }
    return substitutions
  } catch {
    return identityMap()
  }
}

const resolveNoteValidationMode = (
  opts: ScraperPipelineOptions,
): NoteValidationMode => {
  if (opts.noteValidationMode === "off" || opts.noteValidationMode === "llm") {
    return opts.noteValidationMode
  }
  const envMode = (process.env.NOTES_PIPELINE_VALIDATION ?? "").trim().toLowerCase()
  if (envMode === "off") return "off"
  return "llm"
}

// ---------------------------------------------------------------------------
// Graph node
// ---------------------------------------------------------------------------

const throwIfAborted = (sig: AbortSignal | undefined): void => {
  if (sig?.aborted) {
    throw new DOMException("Scrape request cancelled", "AbortError")
  }
}

const isAbortError = (e: unknown): boolean =>
  (e instanceof DOMException && e.name === "AbortError") ||
  (e instanceof Error && e.name === "AbortError")

/** Per OpenAI HTTP request in the admin scraper notes pipeline (avoids hanging forever on one product). */
const resolveNotesPipelineLlmTimeoutMs = (): number => {
  const raw = process.env.OPENAI_NOTES_PIPELINE_TIMEOUT_MS
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const n = Number(raw)
    if (n >= 15_000 && n <= 900_000) return n
  }
  return 180_000
}

/**
 * Parallel note extraction (Phase 1) worker count. Default 3; set to 1 for fully sequential (debug / rate limits).
 * Env: NOTES_PIPELINE_CONCURRENCY (1–32). If OpenAI returns 429, lower this or use 1.
 */
const resolveNotesPipelineConcurrency = (): number => {
  const raw = process.env.NOTES_PIPELINE_CONCURRENCY
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const n = Number(raw)
    if (n >= 1 && n <= 32) return n
  }
  return 3
}

type NotesLayers = { openNotes: string[]; heartNotes: string[]; baseNotes: string[] }

const hasLayeredMerchantPyramid = (notes: NotesLayers): boolean =>
  notes.openNotes.length > 0 && (notes.heartNotes.length > 0 || notes.baseNotes.length > 0)

/** Drop trailing product-name tokens scraped into the last note (e.g. "jasmine absolute zarafa"). */
const stripProductNameBleedFromNotes = (notes: NotesLayers, productName: string): NotesLayers => {
  const lead = productName
    .trim()
    .split(/[\s,]+/)
    .find(t => /^[a-z]{4,}$/i.test(t))
    ?.toLowerCase()
  if (!lead) return notes
  const scrub = (arr: string[]): string[] =>
    arr
      .map(n => {
        const parts = n.trim().split(/\s+/)
        if (parts.length < 3) return n.trim()
        if (parts[parts.length - 1]?.toLowerCase() !== lead) return n.trim()
        return parts.slice(0, -1).join(" ").trim()
      })
      .filter(Boolean)
  return {
    openNotes: scrub(notes.openNotes),
    heartNotes: scrub(notes.heartNotes),
    baseNotes: scrub(notes.baseNotes),
  }
}

/**
 * When the PDP has a labeled flat list (e.g. "Scent notes include …") but the model dropped a
 * rare material (often labdanum) or echoed most of the list without the full set, prefer the
 * regex-parsed list so exports match the merchant line on pages like
 * https://www.littleandgrim.com/products/attic-bedroom-perfume-oil
 */
/** Add flat-list materials missing from an existing Top/Heart/Base pyramid (accord + materials). */
export const mergeFlatMaterialsIntoLayeredPyramid = (notes: NotesLayers, flatAuth: string[]): NotesLayers => {
  if (!hasLayeredMerchantPyramid(notes) || flatAuth.length < 2) return notes
  const nonOpen = new Set([...notes.heartNotes, ...notes.baseNotes].map(n => n.trim().toLowerCase()))
  const flatOverlapNonOpen = flatAuth.filter(f => nonOpen.has(f.trim().toLowerCase())).length
  // Flat lists that already largely overlap heart/base are usually an all-notes summary; don't pour them into open.
  if (flatOverlapNonOpen >= Math.max(2, Math.floor(flatAuth.length * 0.4))) return notes
  /** Full merchant pyramid already parsed — skip prose flat-list bleed into openNotes. */
  if (
    notes.openNotes.length >= 2 &&
    notes.heartNotes.length >= 2 &&
    notes.baseNotes.length >= 2
  ) {
    return notes
  }
  const currentLc = new Set(
    [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes].map(n => n.trim().toLowerCase()),
  )
  const missing = flatAuth.filter(f => !currentLc.has(f.trim().toLowerCase()))
  if (missing.length === 0) return notes
  return {
    openNotes: uniqueNotes([...notes.openNotes, ...missing]),
    heartNotes: notes.heartNotes,
    baseNotes: notes.baseNotes,
  }
}

const looksLikeProseFlatNoteList = (notes: string[]): boolean => {
  if (notes.length === 0) return true
  let proseHits = 0
  for (const n of notes) {
    const t = n.trim().toLowerCase()
    if (!t) continue
    if (looksLikeProseNotePhrase(n) || isObviousNonMaterialNote(n)) proseHits += 1
    else if (/^(?:two|one|being|that'?s|why|there|was|issue|blend|fragrances?|found|formula)$/i.test(t)) {
      proseHits += 1
    }
  }
  return proseHits >= Math.max(1, Math.ceil(notes.length * 0.34))
}

const preferAuthoritativeFlatNoteList = (notes: NotesLayers, flatAuth: string[]): NotesLayers => {
  if (flatAuth.length < 2) return notes
  if (looksLikeProseFlatNoteList(flatAuth)) return notes

  const current = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
  if (looksLikeMainAccordsDescriptorList(flatAuth) && current.length > flatAuth.length) {
    return notes
  }

  /**
   * Merchant Key/Featured lists (2–6 notes) beat sparse LLM/noir prose extractions
   * (e.g. Donna Born In Roma: Key Notes has 4 materials but noir prose only yields amber/musk).
   */
  if (flatAuth.length >= 2 && !hasLayeredMerchantPyramid(notes)) {
    const currentLc = new Set(current.map(n => n.trim().toLowerCase()))
    const flatCovered = flatAuth.filter(f => currentLc.has(f.trim().toLowerCase())).length
    if (
      current.length === 0 ||
      flatCovered < flatAuth.length ||
      (flatAuth.length >= 3 && flatCovered / flatAuth.length < 0.75)
    ) {
      return {
        openNotes: uniqueNotes(flatAuth),
        heartNotes: [],
        baseNotes: [],
      }
    }
  }

  if (flatAuth.length < 3) return notes

  /**
   * Long labeled lists ("Featured notes:", "Key notes:", etc.) are merchant-authored. When regex
   * extracts many materials, use that list as openNotes only — do not keep LLM/merge pollution
   * (e.g. plum/rose/honey echoed from marketing prose) mixed into base/heart.
   *
   * Never flatten an existing Top/Heart/Base pyramid — merge explicit materials instead.
   */
  if (flatAuth.length >= 7) {
    if (hasLayeredMerchantPyramid(notes)) return mergeFlatMaterialsIntoLayeredPyramid(notes, flatAuth)
    return {
      openNotes: uniqueNotes(flatAuth),
      heartNotes: [],
      baseNotes: [],
    }
  }

  if (current.length === 0) {
    return {
      openNotes: uniqueNotes(flatAuth),
      heartNotes: [],
      baseNotes: [],
    }
  }

  const currentLc = new Set(current.map(n => n.trim().toLowerCase()))
  const flatLc = flatAuth.map(n => n.trim().toLowerCase())
  const overlap = flatLc.filter(f => currentLc.has(f)).length
  const missingFromCurrent = flatLc.filter(f => !currentLc.has(f))

  if (missingFromCurrent.length <= 2 && overlap / flatAuth.length >= 0.85) {
    // Don't downgrade a richer layered result to a smaller flat list — the flat extractor
    // may only have captured a subset of a pyramid (e.g. the first layer before layer-label
    // colons caused junk filtering). Only override when the flat list is at least as large.
    if (flatAuth.length < current.length) return notes
    if (hasLayeredMerchantPyramid(notes)) return mergeFlatMaterialsIntoLayeredPyramid(notes, flatAuth)
    return {
      openNotes: uniqueNotes(flatAuth),
      heartNotes: [],
      baseNotes: [],
    }
  }

  if (hasLayeredMerchantPyramid(notes) && missingFromCurrent.length > 0) {
    return mergeFlatMaterialsIntoLayeredPyramid(notes, flatAuth)
  }

  return notes
}

/** Exported for tests — detects when many products share the same 3+ note set (possible LLM drift). */
export const computeBatchNoteUniformityWarnings = (
  layersList: Array<{ openNotes: string[]; heartNotes: string[]; baseNotes: string[] }>,
): string[] => {
  const n = layersList.length
  if (n < 3) return []
  const warnings: string[] = []
  const counts = new Map<string, number>()
  for (const notes of layersList) {
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
      .sort()
    if (all.length < 3) continue
    const key = all.join("|")
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const [key, cnt] of counts) {
    if (cnt / n >= 0.3) {
      const labels = key.split("|")
      warnings.push(
        `Warning: ${cnt}/${n} products share the same notes [${labels.join(", ")}] — possible LLM drift; consider strict mode or a stronger model.`,
      )
    }
  }
  return warnings
}

type Phase1Ok = {
  ok: true
  index: number
  item: ScrapedItem
  name: string
  notes: NotesLayers
  /** Notes parsed from merchant Top/Heart/Base or flat note labels — exempt from prose junk + validator drops. */
  merchantTrustedNotes: Set<string>
  /** stripNotesFromDescription output (untrimmed); noir uses `stripRaw || item.description` like the original pipeline. */
  stripRaw: string
  record: PerfumeCsvRecord
}

type Phase1Fail = { ok: false; index: number; record: PerfumeCsvRecord }

type Phase1Result = Phase1Ok | Phase1Fail

const processSingleProductPhase1 = async (
  llm: ChatOpenAI,
  opts: ScraperPipelineOptions,
  houseName: string,
  item: ScrapedItem,
  index: number,
  totalItems: number,
): Promise<Phase1Result> => {
  const sig = opts.abortSignal
  const resolvedName = resolveProductName(item)
  const name = cleanTitle(resolvedName, opts)
  const existingFromPython: NotesLayers | null =
    opts.enrichOnly === true
      ? {
          openNotes: (item.openNotes ?? []).map(n => n.trim().toLowerCase()).filter(Boolean),
          heartNotes: (item.heartNotes ?? []).map(n => n.trim().toLowerCase()).filter(Boolean),
          baseNotes: (item.baseNotes ?? []).map(n => n.trim().toLowerCase()).filter(Boolean),
        }
      : null
  opts.onProgress?.(
    `Notes pipeline ${index + 1}/${totalItems}: ${(name || resolvedName || "product").slice(0, 72)}`,
  )
  const scrapedDescription = isJunkScrapedDescription(item.description ?? "")
    ? ""
    : (item.description ?? "")
  const pipelineItem: ScrapedItem = scrapedDescription === (item.description ?? "")
    ? item
    : { ...item, description: scrapedDescription }

  let detailUrl = pipelineItem.detailURL?.trim() ?? ""
  if (isAndromedaMoonProductUrl(detailUrl) || /andromeda/i.test(houseName ?? "")) {
    throwIfAborted(sig)
    detailUrl = await resolveAndromedaDetailUrl(name || resolvedName, detailUrl, sig, opts.onProgress)
  }

  let mergedBase = resolveNotesSource(pipelineItem)
  /**
   * Strip merchant policy/shipping/disclaimer boilerplate from the notes source BEFORE extraction.
   * Otherwise LLM extraction sees "Processing: AT LEAST 7 business days... no changes, no cancellations..."
   * and either gets confused or extracts shipping fragments as notes.
   */
  mergedBase = prepareMerchantNotesSource(mergedBase)
  const autoPatternEtsyFetch =
    opts.enrichOnly === true ? false : shouldAutoFetchPatternEtsyNotes(detailUrl, mergedBase)
  const autoAndromedaFetch =
    opts.enrichOnly === true ? false : shouldAutoFetchAndromedaMoonNotes(detailUrl, mergedBase)
  const shouldFetchAndromedaBootstrap =
    isAndromedaMoonProductUrl(detailUrl) && opts.fetchPdpNoteBootstrap === true
  if (
    (shouldFetchAndromedaBootstrap ||
      opts.fetchPdpNoteBootstrap === true ||
      autoPatternEtsyFetch ||
      autoAndromedaFetch) &&
    (shouldFetchAndromedaBootstrap || !hasExplicitNoteListSignal(mergedBase)) &&
    detailUrl.startsWith("http")
  ) {
    throwIfAborted(sig)
    if (opts.fetchPdpNoteBootstrap === true) pdpNoteBootstrapCache.delete(detailUrl)
    const boot = await tryFetchPdpNoteBootstrap(detailUrl, sig, opts.onProgress)
    if (boot && isUsablePdpNoteBootstrap(boot)) {
      /**
       * Skip the merge if the bootstrap chunk is already substantially present in the description
       * (e.g. Wix PDP description IS "Dew and Honeysuckle…", and the regex would otherwise capture
       * the duplicated "Dew and Honeysuckle Dew and Honeysuckle" span and emit fake compound notes
       * like "honeysuckle dew").
       */
      const haystack = mergedBase.toLowerCase().replace(/\s+/g, " ")
      const needle = boot.toLowerCase().replace(/\s+/g, " ")
      if (!haystack.includes(needle)) {
        mergedBase = prepareMerchantNotesSource(`${boot}\n\n${mergedBase}`.trim())
        opts.onProgress?.(
          `Notes pipeline ${index + 1}/${totalItems}: injected note list from PDP HTML for ${(name || resolvedName || "product").slice(0, 48)}`,
        )
      }
    }
  }
  const inferenceMode: NoteInferenceMode = opts.noteInferenceMode === "strict" ? "strict" : "standard"
  const minFlat =
    typeof opts.minConfidentFlatNotes === "number" &&
    Number.isFinite(opts.minConfidentFlatNotes) &&
    opts.minConfidentFlatNotes >= 1 &&
    opts.minConfidentFlatNotes <= 50
      ? Math.floor(opts.minConfidentFlatNotes)
      : 2

  const notesSource = augmentNotesSourceWithLabeledLists(mergedBase)
  try {
    const flatAuthEarly = extractFlatNotes(notesSource)
    let notes = extractNotesFromStructuredText(notesSource, minFlat)
    let merchantTrustedNotes = collectMerchantTrustedNotes(notes, notesSource)

    const initialStructuredNoteCount = noteLayerCount(notes)
    let usedDescPathLlm = false
    let usedNameOnlyPath = false
    let usedFallbackLookup = false
    let pdpRescueApplied = false

    const totalParsedDirectly = notes.openNotes.length + notes.heartNotes.length + notes.baseNotes.length

    const layersWithParsedNotes = [
      notes.openNotes.length > 0,
      notes.heartNotes.length > 0,
      notes.baseNotes.length > 0,
    ].filter(Boolean).length
    const flatListingOnly =
      notes.openNotes.length >= Math.max(2, minFlat) &&
      notes.heartNotes.length === 0 &&
      notes.baseNotes.length === 0
    const hasStrongFlatAuthoritativeList = flatAuthEarly.length >= minFlat
    const skipStructuredLlmMerge =
      (layersWithParsedNotes === 3 && totalParsedDirectly >= 5) ||
      flatListingOnly ||
      hasStrongFlatAuthoritativeList

    if (totalParsedDirectly === 0 && notesSource?.trim()) {
      throwIfAborted(sig)
      const policyOnly = isPolicyOnlyMerchantDescription(notesSource)
      if (!(policyOnly && inferenceMode === "strict")) {
        const extracted = await extractNotesFromDescription(
          llm,
          policyOnly ? "" : prepareMerchantNotesSource(notesSource),
          name || resolvedName,
          inferenceMode,
        )
        notes = extracted.layers
        if (extracted.extractionPath === "description") usedDescPathLlm = true
        if (extracted.extractionPath === "name_only") usedNameOnlyPath = true
      }
    }

    if (
      (usedDescPathLlm || usedNameOnlyPath) &&
      isPatternByEtsyProductUrl(detailUrl) &&
      detailUrl.startsWith("http")
    ) {
      throwIfAborted(sig)
      pdpNoteBootstrapCache.delete(detailUrl)
      const boot = await tryFetchPdpNoteBootstrap(detailUrl, sig, opts.onProgress)
      if (boot) {
        const rescueSource = augmentNotesSourceWithLabeledLists(`${boot}\n\n${mergedBase}`)
        const rescued = extractNotesFromStructuredText(rescueSource, minFlat)
        const rescuedCount = noteLayerCount(rescued)
        if (rescuedCount > noteLayerCount(notes)) {
          notes = rescued
          mergeMerchantTrustedNotes(merchantTrustedNotes, rescued)
          usedDescPathLlm = false
          usedNameOnlyPath = false
          pdpRescueApplied = true
          opts.onProgress?.(
            `Notes pipeline ${index + 1}/${totalItems}: replaced LLM notes with Pattern/Etsy PDP structure for ${(name || resolvedName || "product").slice(0, 48)}`,
          )
        }
      }
    }

    if (
      totalParsedDirectly > 0 &&
      (notesSource?.length ?? 0) > 100 &&
      notesSource?.trim() &&
      !skipStructuredLlmMerge
    ) {
      throwIfAborted(sig)
      if (
        notes.openNotes.length >= 4 &&
        notes.heartNotes.length === 0 &&
        notes.baseNotes.length === 0 &&
        flatAuthEarly.length >= notes.openNotes.length
      ) {
        notes = assignVolatilityLayersFromFlatOpen(notes.openNotes)
      }
      notes = await mergeStructuredNotesWithLlm(llm, notes, notesSource, name || resolvedName)
    }

    if (!allNotesEnglish(notes)) {
      throwIfAborted(sig)
      notes = await translateNotesToEnglish(llm, notes)
    }

    notes = preferAuthoritativeFlatNoteList(notes, extractFlatNotes(notesSource))
    notes = expandParentheticalLayers(notes)
    notes = stripProductNameBleedFromNotes(notes, name || resolvedName)
    merchantTrustedNotes = collectMerchantTrustedNotes(notes, notesSource)

    /**
     * Apply the junk filter BEFORE the rescue check so narrative noise (e.g. "the night",
     * "shadows") that the LLM occasionally leaks doesn't push the cliché-detection union past
     * its `<= 6` threshold and silently skip the rescue.
     */
    notes = {
      openNotes: filterNotesByTrust(notes.openNotes, merchantTrustedNotes),
      heartNotes: filterNotesByTrust(notes.heartNotes, merchantTrustedNotes),
      baseNotes: filterNotesByTrust(notes.baseNotes, merchantTrustedNotes),
    }
    notes = dedupeNotesAcrossLayers(notes)

    notes = mergeExistingPythonNotes(notes, existingFromPython, notesSource)

    if (hasEmbeddedLayerMarkers(notes)) {
      notes = relayerNotesWithEmbeddedLayerMarkers(notes)
    }

    notes = confirmNoteLayersAgainstSource(notes, notesSource, {
      merchantTrusted: merchantTrustedNotes,
    })
    merchantTrustedNotes = collectMerchantTrustedNotes(notes, notesSource)
    notes = {
      openNotes: filterNotesByTrust(notes.openNotes, merchantTrustedNotes),
      heartNotes: filterNotesByTrust(notes.heartNotes, merchantTrustedNotes),
      baseNotes: filterNotesByTrust(notes.baseNotes, merchantTrustedNotes),
    }
    notes = dedupeNotesAcrossLayers(notes)

    const needsAndromedaMerchantRescue =
      isAndromedaMoonProductUrl(detailUrl) && !hasExplicitNoteListSignal(notesSource)
    if (
      opts.fetchPdpNoteBootstrap === true &&
      item.detailURL?.trim().startsWith("http") &&
      (shouldAttemptPdpRescue(notes, notesSource) || needsAndromedaMerchantRescue)
    ) {
      throwIfAborted(sig)
      pdpNoteBootstrapCache.delete(item.detailURL.trim())
      const boot = await tryFetchPdpNoteBootstrap(detailUrl, sig, opts.onProgress)
      if (boot) {
        const rescueSource = augmentNotesSourceWithLabeledLists(`${boot}\n\n${mergedBase}`)
        const rescuedFlat = extractFlatNotes(rescueSource)
        let rescued = extractNotesFromStructuredText(rescueSource, minFlat)
        rescued = preferAuthoritativeFlatNoteList(rescued, rescuedFlat)
        rescued = expandParentheticalLayers(rescued)
        mergeMerchantTrustedNotes(merchantTrustedNotes, rescued)
        rescued = {
          openNotes: filterNotesByTrust(rescued.openNotes, merchantTrustedNotes),
          heartNotes: filterNotesByTrust(rescued.heartNotes, merchantTrustedNotes),
          baseNotes: filterNotesByTrust(rescued.baseNotes, merchantTrustedNotes),
        }
        rescued = dedupeNotesAcrossLayers(rescued)
        rescued = confirmNoteLayersAgainstSource(rescued, rescueSource, {
          merchantTrusted: merchantTrustedNotes,
        })
        if (shouldPreferRescuedOverCurrent(notes, rescued, rescueSource, rescuedFlat.length, minFlat)) {
          notes = rescued
          merchantTrustedNotes = collectMerchantTrustedNotes(notes, notesSource)
          pdpRescueApplied = true
          opts.onProgress?.(
            `Notes pipeline ${index + 1}/${totalItems}: replaced thin/noir-cliché notes using PDP fetch for ${(name || resolvedName || "product").slice(0, 48)}`,
          )
        }
      }
    }

    /**
     * Guaranteed name + theme inference — runs AFTER the junk filter so a regex extraction whose
     * candidates all fail isScraperKeptNote (e.g. layered list of single-letter placeholders, or
     * noise that survived earlier stages) still ends up with real notes. Skipped in strict mode.
     */
    if (noteLayerCount(notes) === 0) {
      const fallbackName = name || resolvedName
      if (fallbackName?.trim() && inferenceMode !== "strict") {
        throwIfAborted(sig)
        usedFallbackLookup = true
        const inferred = await extractNotesFallbackLookup(llm, fallbackName, item.perfumeHouse ?? houseName)
        notes = {
          openNotes: inferred.openNotes.filter(isScraperKeptNote),
          heartNotes: inferred.heartNotes.filter(isScraperKeptNote),
          baseNotes: inferred.baseNotes.filter(isScraperKeptNote),
        }
        notes = dedupeNotesAcrossLayers(notes)
      }
    }

    notes = rejectComplianceDominatedLayers(notes)
    notes = finalizeNoteLayersForExport(notes, merchantTrustedNotes)

    const resolveNoteSource = (): ScraperNoteSource => {
      if (noteLayerCount(notes) === 0) return "empty"
      if (usedFallbackLookup) return "llm_name_inferred"
      if (pdpRescueApplied) return "pdp_bootstrap"
      if (usedDescPathLlm) return "llm_description"
      if (usedNameOnlyPath) return inferenceMode === "strict" ? "llm_name_literal" : "llm_name_inferred"
      if (initialStructuredNoteCount > 0) return "labeled_list"
      return "llm_description"
    }

    if (inferenceMode === "strict" && noteLayerCount(notes) === 0) {
      opts.onProgress?.(
        `Notes pipeline ${index + 1}/${totalItems}: strict mode — no merchant notes extracted for "${(name || resolvedName || "product").slice(0, 72)}"`,
      )
    }

    const noteSource = resolveNoteSource()

    const allNoteStrs = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    const sanitizedDescription = sanitizeCopyForNotePipeline(pipelineItem.description ?? "")
    const stripRaw = stripNotesFromDescription(sanitizedDescription, allNoteStrs)

    let descriptionForRecord: string
    if (stripRaw) descriptionForRecord = stripRaw.trim()
    else descriptionForRecord = sanitizedDescription
    if (isJunkScrapedDescription(descriptionForRecord)) descriptionForRecord = ""
    /**
     * Drop merchant policy/shipping/disclaimer trail from the stored description, and wipe entirely
     * when the remaining narrative is too short (boilerplate-only PDPs like Andromedas' "Love Don't
     * Be Shy" where the merchant copy is all ORIGINAL MANUFACTURERS PICTURES / ingredients lists /
     * no-changes-no-refunds). With notes present, noir generation later replaces the empty string.
     */
    if (descriptionForRecord) {
      if (isPolicyOnlyMerchantDescription(descriptionForRecord)) {
        descriptionForRecord = ""
      } else {
        descriptionForRecord = stripMerchantDescriptionForStorage(descriptionForRecord)
      }
    }

    const record: PerfumeCsvRecord = {
      name,
      description: descriptionForRecord,
      image: item.image,
      perfumeHouse: item.perfumeHouse ?? houseName,
      openNotes: JSON.stringify(notes.openNotes),
      heartNotes: JSON.stringify(notes.heartNotes),
      baseNotes: JSON.stringify(notes.baseNotes),
      detailURL: detailUrl || item.detailURL,
      _noteSource: noteSource,
    }

    return {
      ok: true,
      index,
      item,
      name,
      notes,
      merchantTrustedNotes,
      stripRaw,
      record,
    }
  } catch (itemErr: unknown) {
    if (isAbortError(itemErr) || sig?.aborted) {
      throw itemErr
    }
    const detail = itemErr instanceof Error ? itemErr.message : String(itemErr)
    opts.onProgress?.(
      `Notes pipeline ${index + 1}/${totalItems} (${(name || resolvedName || "product").slice(0, 48)}): skipped LLM for this product — ${detail.slice(0, 280)}`,
    )
    return {
      ok: false,
      index,
      record: {
        name,
        description: (item.description ?? "").trim(),
        image: item.image ?? "",
        perfumeHouse: item.perfumeHouse ?? houseName,
        openNotes: "[]",
        heartNotes: "[]",
        baseNotes: "[]",
        detailURL: item.detailURL,
      },
    }
  }
}

const runPhase1WithConcurrency = async (
  llm: ChatOpenAI,
  opts: ScraperPipelineOptions,
  houseName: string,
  items: ScrapedItem[],
  concurrency: number,
): Promise<Phase1Result[]> => {
  const n = items.length
  const results: Phase1Result[] = new Array(n)
  if (n === 0) return results

  const sig = opts.abortSignal
  let nextIndex = 0
  const workerCount = Math.max(1, Math.min(concurrency, n))

  const worker = async () => {
    for (;;) {
      throwIfAborted(sig)
      const idx = nextIndex++
      if (idx >= n) break
      results[idx] = await processSingleProductPhase1(llm, opts, houseName, items[idx], idx, n)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

function buildGraph(
  llm: ChatOpenAI,
  opts: ScraperPipelineOptions,
  noirLlm?: ChatOpenAI,
) {
  const extractNotes = async (state: ScraperStateType): Promise<Partial<ScraperStateType>> => {
    const totalItems = state.items.length
    const sig = opts.abortSignal
    const concurrency = resolveNotesPipelineConcurrency()

    const phase1 = await runPhase1WithConcurrency(
      llm,
      opts,
      state.houseName,
      state.items,
      concurrency,
    )

    /**
     * Bulk LLM validation across the union of every product's notes. One cheap call drops prose /
     * sensory fragments the regex filter misses (e.g. "a sweet", "glowing amber warmth", "sunlit
     * burst of melon"). Filtering happens BEFORE noir generation so noir descriptions reflect the
     * validated note set.
     */
    const validationMode = resolveNoteValidationMode(opts)
    if (validationMode === "llm") {
      const okPhase1 = phase1.filter((p): p is Phase1Ok => p.ok)
      const candidateUnion = new Set<string>()
      for (const p of okPhase1) {
        for (const n of p.notes.openNotes) candidateUnion.add(n.trim().toLowerCase())
        for (const n of p.notes.heartNotes) candidateUnion.add(n.trim().toLowerCase())
        for (const n of p.notes.baseNotes) candidateUnion.add(n.trim().toLowerCase())
      }
      candidateUnion.delete("")

      if (candidateUnion.size > 0) {
        throwIfAborted(sig)
        opts.onProgress?.(
          `Notes pipeline: validating ${candidateUnion.size} unique notes across ${okPhase1.length} products…`,
        )
        const substitutions = await validateNotesWithLlm(llm, Array.from(candidateUnion))

        /**
         * Apply substitutions per-layer with dedup. A note is kept iff it has a mapping in the
         * substitution map; the mapped value (cleaned material name) replaces it. Layers are then
         * dedup'd across each other via dedupeNotesAcrossLayers so substitutions that converge
         * two phrases to the same material (e.g. "delicate apple blossom" + "apple blossom") do
         * not produce duplicates.
         */
        const cleanLayer = (arr: string[], trusted: Set<string>): string[] => {
          const out: string[] = []
          const seen = new Set<string>()
          for (const n of arr) {
            const lc = n.trim().toLowerCase()
            if (trusted.has(lc)) {
              if (!isMerchantLabeledNote(n)) continue
              if (!lc || seen.has(lc)) continue
              seen.add(lc)
              out.push(lc)
              continue
            }
            const mapped = substitutions.get(lc)
            if (mapped == null) continue
            const final = mapped.trim().toLowerCase()
            if (!final || seen.has(final)) continue
            seen.add(final)
            out.push(final)
          }
          return out
        }

        let droppedCount = 0
        let rewrittenCount = 0
        for (const p of okPhase1) {
          const beforeCount = noteLayerCount(p.notes)
          const beforeUnionLc = new Set(
            [...p.notes.openNotes, ...p.notes.heartNotes, ...p.notes.baseNotes].map(s =>
              s.trim().toLowerCase(),
            ),
          )
          const intermediate = {
            openNotes: cleanLayer(p.notes.openNotes, p.merchantTrustedNotes),
            heartNotes: cleanLayer(p.notes.heartNotes, p.merchantTrustedNotes),
            baseNotes: cleanLayer(p.notes.baseNotes, p.merchantTrustedNotes),
          }
          const filtered = dedupeNotesAcrossLayers(intermediate)
          const afterCount = noteLayerCount(filtered)
          const afterUnionLc = new Set(
            [...filtered.openNotes, ...filtered.heartNotes, ...filtered.baseNotes].map(s =>
              s.trim().toLowerCase(),
            ),
          )
          const sameSet =
            afterUnionLc.size === beforeUnionLc.size &&
            Array.from(afterUnionLc).every(n => beforeUnionLc.has(n))
          if (sameSet) continue
          droppedCount += Math.max(0, beforeCount - afterCount)
          rewrittenCount += Array.from(afterUnionLc).filter(n => !beforeUnionLc.has(n)).length
          p.notes = filtered
          p.record = {
            ...p.record,
            openNotes: JSON.stringify(filtered.openNotes),
            heartNotes: JSON.stringify(filtered.heartNotes),
            baseNotes: JSON.stringify(filtered.baseNotes),
            _noteSource: afterCount === 0 ? "empty" : p.record._noteSource,
          }
        }
        if (droppedCount > 0 || rewrittenCount > 0) {
          opts.onProgress?.(
            `Notes pipeline: validator dropped ${droppedCount} non-material note(s) and rewrote ${rewrittenCount} prose-adjective phrase(s) across the batch.`,
          )
        }
      }
    }

    const results: PerfumeCsvRecord[] = []
    const previousOpenings: string[] = []

    for (let idx = 0; idx < totalItems; idx++) {
      throwIfAborted(sig)
      const p = phase1[idx]
      if (!p.ok) {
        results.push(p.record)
        continue
      }

      /**
       * Prefer noir when we have 2+ notes (overwrites merchant copy). With only 1 note, still run noir
       * when there is no usable merchant description (empty or Wix/CSS bleed) so CSV rows are not
       * left with cross-sell junk. When 1 note and real prose exists, keep it for refresh:house-notes.
       */
      const totalNotes = noteLayerCount(p.notes)
      const hasUsableMerchantDescription = (p.record.description || "").trim().length > 0
      const shouldRunNoir =
        opts.generateNoirDescriptions &&
        noirLlm &&
        (totalNotes >= 2 ||
          (totalNotes >= 1 && !hasUsableMerchantDescription) ||
          (totalNotes === 0 && !hasUsableMerchantDescription && p.name.trim().length > 0))

      if (shouldRunNoir) {
        throwIfAborted(sig)
        const noirDesc = await generateNoirDescription(
          noirLlm,
          p.name,
          p.notes,
          (p.record.description || "").trim(),
          previousOpenings,
          idx,
          totalItems,
        )
        previousOpenings.push(openingFingerprint(noirDesc))
        results.push({
          ...p.record,
          description: noirDesc,
        })
      } else {
        if (opts.generateNoirDescriptions && noirLlm) {
          if (totalNotes === 0) {
            opts.onProgress?.(
              `Notes pipeline: skipped noir for "${p.name.slice(0, 60)}" — no notes extracted.`,
            )
          } else if (totalNotes < 2 && hasUsableMerchantDescription) {
            opts.onProgress?.(
              `Notes pipeline: skipped noir for "${p.name.slice(0, 60)}" — only ${totalNotes} note(s) extracted; keeping merchant description for re-extraction.`,
            )
          }
        }
        results.push(p.record)
      }
    }

    const okLayers = phase1.filter((p): p is Phase1Ok => p.ok).map(p => p.notes)
    const batchWarnings = computeBatchNoteUniformityWarnings(okLayers)
    for (const w of batchWarnings) {
      opts.onProgress?.(w)
    }

    return { results, batchWarnings }
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
 * @param options - Optional title cleaning, film noir generation, inference mode, models (see types)
 * @param legacyExtractionModel - Deprecated; use `options.notesPipelineModel` or env `OPENAI_NOTES_PIPELINE_MODEL`
 * @returns Extracted CSV records plus optional batch-level warnings (e.g. uniform LLM drift)
 *
 * Phase 1 (extract/merge/translate) uses limited parallelism (NOTES_PIPELINE_CONCURRENCY, default 3).
 * Film noir (Phase 2) stays sequential so previousOpenings matches the original pipeline.
 */
export async function extractNotesForItems(
  items: ScrapedItem[],
  houseName: string,
  options: ScraperPipelineOptions = {},
  /** @deprecated Prefer `options.notesPipelineModel`. */
  legacyExtractionModel?: string,
): Promise<{ records: PerfumeCsvRecord[]; batchWarnings: string[] }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Note extraction requires an OpenAI key.")
  }

  const extractionModel =
    options.notesPipelineModel ??
    legacyExtractionModel ??
    process.env.OPENAI_NOTES_PIPELINE_MODEL ??
    "gpt-4o-mini"
  const noirModel =
    options.noirPipelineModel ?? process.env.OPENAI_NOTES_PIPELINE_NOIR_MODEL ?? extractionModel

  const llmTimeout = resolveNotesPipelineLlmTimeoutMs()
  const jsonModeKwargs = { response_format: { type: "json_object" as const } }
  const llm = new ChatOpenAI({
    model: extractionModel,
    temperature: 0.1,
    apiKey: process.env.OPENAI_API_KEY,
    timeout: llmTimeout,
    maxRetries: 0,
    modelKwargs: jsonModeKwargs,
  })

  const noirLlm = options.generateNoirDescriptions
    ? new ChatOpenAI({
        model: noirModel,
        temperature: 0.9,
        apiKey: process.env.OPENAI_API_KEY,
        timeout: llmTimeout,
        maxRetries: 0,
      })
    : undefined

  const graph = buildGraph(llm, options, noirLlm)
  const finalState = await graph.invoke({ items, houseName, results: [], batchWarnings: [] })
  return {
    records: finalState.results,
    batchWarnings: finalState.batchWarnings ?? [],
  }
}

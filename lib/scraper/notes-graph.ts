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

import { Annotation, StateGraph } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"

import type { PerfumeCsvRecord, ScrapedItem, TitleDashSegment } from "@/types/scraper"
import { isDisplayableScentNote } from "@/utils/validation/note-validation.server"

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

/**
 * Use both optional notes-region scrape and main description for parsing. Some runs put the labeled
 * "Scent notes include …" line in one field and noir/short copy in the other; `notesText ?? description`
 * alone drops the authoritative list and the LLM invents a pyramid from prose.
 */
const resolveNotesSource = (item: ScrapedItem): string => {
  const parts = [item.notesText, item.description]
    .map(s => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
  if (parts.length === 0) return ""
  return [...new Set(parts)].join("\n\n")
}

/** True when the page text includes a merchant-style note list or pyramid — not metaphor-only prose. */
const hasExplicitNoteListSignal = (text: string): boolean => {
  const t = text
  if (/\b(?:featured|key|main|primary|signature|dominant)\s+notes?\s*:/i.test(t)) return true
  if (/\bscent\s+notes?\s+include\b/i.test(t)) return true
  if (/\bfragrance\s+notes?\s+are\b/i.test(t)) return true
  if (/\bnote\s+structure\b/i.test(t)) return true
  if (/\b(?:top|heart|middle|mid|base|opening|dry[\s-]*down)\s*(?:notes?)?\s*:/i.test(t)) return true
  if (/\bnotes?\s*:\s*[a-z0-9]/i.test(t)) return true
  return false
}

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
const shouldAttemptPdpRescue = (notes: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): boolean => {
  const union = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  if (union.length === 0) return true
  if (isLikelyNoirClicheOnlyNotes(notes)) return true
  if (union.length <= 6) {
    const clicheHits = union.filter(n => NOIR_NOTE_CLICHE.has(n)).length
    // 2+ of a small list match the noir cliche set → likely contaminated; verify against PDP.
    if (clicheHits >= 2) return true
  }
  return false
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

const unescapeHtmlAttr = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\u00a0/g, " ")

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
  // Stop before `$12` / `Price` — a greedy `[^.!?]+` would swallow Wix price tails and merge the
  // last note with `$16.00` (junk filter drops it — e.g. missing "clove" on Seventh Muse).
  const blendPhrase = plain.match(
    /\b(?:[\w.]+\s+){0,6}(?:sweet\/spicy\s+)?blend\s+of\s+.+?(?=\s+\$\d|\s+Price\s|[.!?]|$)/i,
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
    /\b(?:scent|fragrance|aroma)\s+blend\s+of\s+.+?(?=\s+\$\d|\s+Price\s|[.!?]|$)/i,
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
    const raw = ellipsisHook[1].trim()
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

  return null
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

  const segments: string[] = []
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
  const head = boost.slice(0, Math.min(80, boost.length))
  if (collapsed.toLowerCase().includes(head.toLowerCase())) return raw
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
      .map(part => part.replace(/^[&\-\u2022*:\s]+/, "").replace(/[.:\-\s*]+$/, ""))
      .filter(part => !/^amp$/i.test(part))
      .filter(Boolean),
  )
}


function stripTrailingNonNoteSections(text: string): string {
  return text
    .replace(
      /\s+(?:additional information|ingredients|how to use|directions(?:\s+for\s+use)?|customer reviews?|reviews?|specifications|size [Gg]uide|care [Ii]nstructions|warnings?|disclaimer)\b[\s\S]*$/i,
      "",
    )
    .replace(/\s+extra info\b[\s\S]*$/i, "")
    .trim()
}

/** Pattern-by-Etsy and minified HTML glue layer headers: "AccordMiddle Notes:" → "Accord Middle Notes:" */
const splitGluedLayerLabels = (text: string): string =>
  text
    .replace(
      /(?<=[A-Za-z0-9)])(?=(?:top|open(?:ing)?|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry[\s-]*down|drydown|end)(?:\s+notes?)?\s*:)/gi,
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
const normalizeImplicitLayerColons = (text: string): string =>
  text.replace(
    /\b(top|open(?:ing)?|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry[\s-]*down|drydown|end)\s+notes?\s+(?!(?:of|and|with|from|to|in|the|a|an|is|are)\b)(?=[A-Za-z])/gi,
    "$1: ",
  )

/** Stop last layer chunk before Pattern/Etsy listing meta (avoids ':' in tokens → junk filter drops all base notes). */
const truncateAtShopMetaLabels = (s: string): string => {
  const m = s.match(
    /\s+(?:series|perfume\s+family|unisex|contains\s+true\s+animalics|scent\s+strength|extra info)\s*:?/i,
  )
  if (m?.index != null) return s.slice(0, m.index).trim()
  return s.trim()
}

// ---------------------------------------------------------------------------
// Junk / keep rules (needed before structured extraction — long accords fail isDisplayableScentNote)
// ---------------------------------------------------------------------------

const JUNK_NOTE_PATTERNS: RegExp[] = [
  /[.!?;:(){}\[\]"]/, // punctuation → sentence fragment or copy
  /\d{2,}/, // numbers like sizes, prices, percentages
  /\d+(?:rem|em|ch|vw|vh|px|pt)\b/i, // CSS / layout tokens (e.g. 1rem, 12px)
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
  /\bwhich is (colourless|colorless)\b/i,
  /\b(is vegan|colourless|colorless|odourless|odorless)\b/i,
  /\broom sprays\b/i,
  /\bwhat does\b.*\b(smell|smells)\b/i,
  /\bmanly accord\b/i,
  /\bopening with\b/i,
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

/** Strip leading prose wrappers before note tokens (e.g. "Notes of cinnamon" → "cinnamon"). */
const stripNoteListProsePrefix = (p: string): string =>
  p
    .replace(/^\s*notes\s+of\s+/i, "")
    .replace(/^\s*note\s+of\s+/i, "")
    .replace(/^\s*a\s+hint\s+of\s+/i, "")
    .replace(/^\s*hints?\s+of\s+/i, "")
    .replace(/^\s*enhanced\s+by\s+/i, "")
    .replace(/^\s*enriched\s+by\s+/i, "")
    .replace(/^\s*creating\s+a\s+rich\s+/i, "")
    .trim()

/** Candidates from labeled Top/Middle/Base list lines (parentheticals, long accords). */
const filterStructuredNoteParts = (parts: string[]): string[] =>
  parts.map(p => stripNoteListProsePrefix(p.trim())).filter(p => p && isScraperKeptNote(p))

function classifyNoteLayer(label: string): "open" | "heart" | "base" | null {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, " ")
  // French pyramid labels (sites often use these; "notes de X" is one header)
  if (/^notes?\s+de\s+(tête|tete)$/.test(normalized)) return "open"
  if (/^notes?\s+de\s+(cœur|coeur)$/.test(normalized)) return "heart"
  if (/^notes?\s+de\s+fond$/.test(normalized)) return "base"
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
    stripTrailingNonNoteSections(text.replace(/\r/g, "\n").replace(/\s+/g, " ").trim()),
  )
  if (!source) return empty

  const sectionRe =
    /\b(top(?:\s+notes?)?|open(?:ing)?(?:\s+notes?)?|head(?:\s+notes?)?|heart(?:\s+notes?)?|middle(?:\s+notes?)?|mid(?:\s+notes?)?|core(?:\s+notes?)?|body(?:\s+notes?)?|cent(?:er|re)(?:\s+notes?)?|base(?:\s+notes?)?|bottom(?:\s+notes?)?|background(?:\s+notes?)?|foundation(?:\s+notes?)?|dry\s*down(?:\s+notes?)?|drydown(?:\s+notes?)?|end(?:\s+notes?)?|notes?\s+de\s+(?:tête|tete)|notes?\s+de\s+(?:cœur|coeur)|notes?\s+de\s+fond)\s*:/gi
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
 * After whitespace collapse, "Notes: a, b, c Sweet as a slow…" becomes one line; capturing [^\n]+
 * pulls in the full PDP and splitNoteList's "and" → comma rule turns prose into fake notes.
 * Cut before marketing / accordion / cross-sell prose. Add new `RegExp` entries when a scrape
 * still bleeds PDP tail into note lists (each is tested with `.match()` — no `/g` flag).
 */
const FLAT_NOTE_PROSE_BOUNDARY_RES: RegExp[] = [
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

/** True when the match is immediately preceded by a layered label (top/heart/base …). */
const shouldSkipFlatNotesMatch = (source: string, matchIndex: number, prefixChars = 48): boolean => {
  const rawPrefix = source.slice(Math.max(0, matchIndex - prefixChars), matchIndex)
  return /(?:top|open|opening|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry\s*down)\s+$/i.test(
    rawPrefix,
  )
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
  // "Notes:", "Fragrance notes – …" (line to newline)
  /(?:^|[\s.!?\n])(?:fragrance\s+)?notes?\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
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
    found.push(...parsed)
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

function extractNotesFromStructuredText(text: string): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} {
  const empty = { openNotes: [] as string[], heartNotes: [] as string[], baseNotes: [] as string[] }
  const collapsed = (text ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  const source = splitGluedLayerLabels(normalizeImplicitLayerColons(collapsed))
  if (!source) return empty

  /**
   * Merchant labeled lists (Featured/Key/Scent notes include, etc.) beat inline “Top:/Heart:”
   * heuristics that can misfire on prose (“warm notes of…”). Prefer the flat list whenever
   * extraction finds enough items (matches merge skip threshold).
   */
  const authoritativeFlat = extractFlatNotes(source)
  if (authoritativeFlat.length >= 5) {
    return { openNotes: uniqueNotes(authoritativeFlat), heartNotes: [], baseNotes: [] }
  }

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
    const heartMatch = normalized.match(/^(?:heart|middle|mid|core|body|center|centre)(?:\s+notes?)?\s*[:\-]\s*(.+)$/i)
    if (heartMatch) {
      heartNotes.push(...filterStructuredNoteParts(splitNoteList(truncateAtShopMetaLabels(heartMatch[1]))))
      continue
    }
    const baseMatch = normalized.match(/^(?:base|bottom|background|foundation|dry\s*down|drydown|end)(?:\s+notes?)?\s*[:\-]\s*(.+)$/i)
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
- Adjectives that describe a note (e.g. "warm vanilla", "fresh bergamot") → keep the note as a phrase (warm vanilla, fresh bergamot).
- Omit pure marketing fluff that is not a note (e.g. "luscious", "irresistible", "seductive", "sensual", "confidence", "courage", "healing", "balance", "vitality" as standalone words).
- NEVER include crystals, gemstones, or minerals as notes (e.g. quartz, amethyst, herkimer diamond, topaz, tourmaline, moonstone, labradorite, gem magic, citrine, obsidian, selenite). These are not fragrance notes.
- NEVER include carrier oils or base ingredients as notes (e.g. sunflower oil, jojoba oil, shea butter, coconut oil, sweet almond oil, argan oil). These are not fragrance notes.
- NEVER treat storefront section headers or specs as notes (e.g. "Extra Info Below if You're Curious", "power source accord", battery/USB copy). These are not fragrance notes.
- NEVER treat solvent/carrier marketing as notes (e.g. "vegan augeo", "made from renewable resources", "colourless", "odourless", "is vegan", "room sprays", "what does X smell like" SEO lines). These are not fragrance pyramid materials.
- NEVER treat people, roles, or quote fluff as notes (e.g. founder, iconic, transmission, "continues the narrative", attributions like perfumer names).
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
- NEVER return all empty arrays. Always provide AT LEAST 3 notes total, distributed across at least two of the three layers. Prefer 4-6 notes total for evocative/abstract names. Cap the total at 6 notes — do not pad with generic filler.
- For recognized fragrances (e.g. Lush Lord of Misrule, Karma, Rose Jam), use the fragrance's documented top/heart/base notes — do not return only a single generic note like "musk".
- Use lowercase. No duplicates. No explanation, no markdown.
- Assign by volatility: citrus, herbs, green, light florals → openNotes; florals, spices, fruits → heartNotes; woods, musk, vanilla, amber, oud, resins → baseNotes.`

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

/**
 * Wix / theme scrapes sometimes capture cross-sell strips and inline editor CSS instead of PDP copy.
 * Those rows must not be treated as "merchant description" (which would skip noir for thin note lists).
 */
const isJunkScrapedDescription = (text: string | null | undefined): boolean => {
  const t = text?.trim() ?? ""
  if (!t) return false
  const lower = t.toLowerCase()
  if (/click\s+pic\s+to\s+see\s+all/i.test(lower)) return true
  if (/shea\s+butter\s*&\s*aloe\s+lotion/i.test(lower) && /\$\s*\d/.test(t)) return true
  if (/spray\s+mists\s*\$/i.test(lower)) return true
  if (/#comp-[a-z0-9]{4,}/i.test(t) && (/\{\s*fill\s*:/i.test(t) || /\[data-color\s*=/i.test(lower))) return true
  return false
}

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
  "santal", "feve", "fève", "oud", "fleur", "violette",
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

/**
 * When the PDP has a labeled flat list (e.g. "Scent notes include …") but the model dropped a
 * rare material (often labdanum) or echoed most of the list without the full set, prefer the
 * regex-parsed list so exports match the merchant line on pages like
 * https://www.littleandgrim.com/products/attic-bedroom-perfume-oil
 */
const preferAuthoritativeFlatNoteList = (notes: NotesLayers, flatAuth: string[]): NotesLayers => {
  if (flatAuth.length < 3) return notes

  /**
   * Long labeled lists ("Featured notes:", "Key notes:", etc.) are merchant-authored. When regex
   * extracts many materials, use that list as openNotes only — do not keep LLM/merge pollution
   * (e.g. plum/rose/honey echoed from marketing prose) mixed into base/heart.
   */
  if (flatAuth.length >= 7) {
    return {
      openNotes: uniqueNotes(flatAuth),
      heartNotes: [],
      baseNotes: [],
    }
  }

  const current = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
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
    return {
      openNotes: uniqueNotes(flatAuth),
      heartNotes: [],
      baseNotes: [],
    }
  }

  return notes
}

type Phase1Ok = {
  ok: true
  index: number
  item: ScrapedItem
  name: string
  notes: NotesLayers
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
  opts.onProgress?.(
    `Notes pipeline ${index + 1}/${totalItems}: ${(name || resolvedName || "product").slice(0, 72)}`,
  )
  let mergedBase = resolveNotesSource(item)
  if (
    opts.fetchPdpNoteBootstrap === true &&
    !hasExplicitNoteListSignal(mergedBase) &&
    item.detailURL?.trim().startsWith("http")
  ) {
    throwIfAborted(sig)
    const boot = await tryFetchPdpNoteBootstrap(item.detailURL.trim(), sig, opts.onProgress)
    if (boot) {
      mergedBase = `${boot}\n\n${mergedBase}`.trim()
      opts.onProgress?.(
        `Notes pipeline ${index + 1}/${totalItems}: injected note list from PDP HTML for ${(name || resolvedName || "product").slice(0, 48)}`,
      )
    }
  }
  const notesSource = augmentNotesSourceWithLabeledLists(mergedBase)
  try {
    const flatAuthEarly = extractFlatNotes(notesSource)
    let notes = extractNotesFromStructuredText(notesSource)
    const totalParsedDirectly = notes.openNotes.length + notes.heartNotes.length + notes.baseNotes.length

    const layersWithParsedNotes = [
      notes.openNotes.length > 0,
      notes.heartNotes.length > 0,
      notes.baseNotes.length > 0,
    ].filter(Boolean).length
    const parsedNoteCount = noteLayerCount(notes)
    const flatListingOnly =
      notes.openNotes.length >= 2 &&
      notes.heartNotes.length === 0 &&
      notes.baseNotes.length === 0
    /** Strong labeled list (Featured/Key notes, etc.) — skip LLM merge that reinvents pyramid from prose. */
    const hasStrongFlatAuthoritativeList = flatAuthEarly.length >= 5
    const skipStructuredLlmMerge =
      (layersWithParsedNotes === 3 && parsedNoteCount >= 5) ||
      flatListingOnly ||
      hasStrongFlatAuthoritativeList

    if (totalParsedDirectly === 0 && notesSource?.trim()) {
      throwIfAborted(sig)
      notes = await extractNotesFromDescription(llm, notesSource, name || resolvedName)
    } else if (
      totalParsedDirectly > 0 &&
      (notesSource?.length ?? 0) > 100 &&
      notesSource?.trim() &&
      !skipStructuredLlmMerge
    ) {
      throwIfAborted(sig)
      notes = await mergeStructuredNotesWithLlm(llm, notes, notesSource, name || resolvedName)
    }

    if (!allNotesEnglish(notes)) {
      throwIfAborted(sig)
      notes = await translateNotesToEnglish(llm, notes)
    }

    notes = preferAuthoritativeFlatNoteList(notes, extractFlatNotes(notesSource))

    /**
     * Apply the junk filter BEFORE the rescue check so narrative noise (e.g. "the night",
     * "shadows") that the LLM occasionally leaks doesn't push the cliché-detection union past
     * its `<= 6` threshold and silently skip the rescue.
     */
    const cleanNote = (n: string) => isScraperKeptNote(n)
    notes = {
      openNotes: notes.openNotes.filter(cleanNote),
      heartNotes: notes.heartNotes.filter(cleanNote),
      baseNotes: notes.baseNotes.filter(cleanNote),
    }
    notes = dedupeNotesAcrossLayers(notes)

    if (
      opts.fetchPdpNoteBootstrap === true &&
      item.detailURL?.trim().startsWith("http") &&
      shouldAttemptPdpRescue(notes)
    ) {
      throwIfAborted(sig)
      pdpNoteBootstrapCache.delete(item.detailURL.trim())
      const boot = await tryFetchPdpNoteBootstrap(item.detailURL.trim(), sig, opts.onProgress)
      if (boot) {
        const rescueSource = augmentNotesSourceWithLabeledLists(`${boot}\n\n${mergedBase}`)
        const rescuedFlat = extractFlatNotes(rescueSource)
        let rescued = extractNotesFromStructuredText(rescueSource)
        rescued = preferAuthoritativeFlatNoteList(rescued, rescuedFlat)
        rescued = {
          openNotes: rescued.openNotes.filter(cleanNote),
          heartNotes: rescued.heartNotes.filter(cleanNote),
          baseNotes: rescued.baseNotes.filter(cleanNote),
        }
        rescued = dedupeNotesAcrossLayers(rescued)
        if (
          rescuedFlat.length >= 6 ||
          noteLayerCount(rescued) > noteLayerCount(notes) ||
          (!isLikelyNoirClicheOnlyNotes(rescued) && noteLayerCount(rescued) > 0)
        ) {
          notes = rescued
          opts.onProgress?.(
            `Notes pipeline ${index + 1}/${totalItems}: replaced thin/noir-cliché notes using PDP fetch for ${(name || resolvedName || "product").slice(0, 48)}`,
          )
        }
      }
    }

    /**
     * Guaranteed name + theme inference — runs AFTER the junk filter so a regex extraction whose
     * candidates all fail isScraperKeptNote (e.g. layered list of single-letter placeholders, or
     * noise that survived earlier stages) still ends up with real notes. Always-on so prose-only
     * descriptions that yielded nothing get name/house/theme-inferred notes, and the scraper
     * never imports a perfume with empty notes.
     */
    if (noteLayerCount(notes) === 0) {
      const fallbackName = name || resolvedName
      if (fallbackName?.trim()) {
        throwIfAborted(sig)
        const inferred = await extractNotesFallbackLookup(llm, fallbackName, item.perfumeHouse ?? houseName)
        notes = {
          openNotes: inferred.openNotes.filter(cleanNote),
          heartNotes: inferred.heartNotes.filter(cleanNote),
          baseNotes: inferred.baseNotes.filter(cleanNote),
        }
        notes = dedupeNotesAcrossLayers(notes)
      }
    }

    const allNoteStrs = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    const stripRaw = stripNotesFromDescription(item.description, allNoteStrs)

    let descriptionForRecord: string
    if (stripRaw) descriptionForRecord = stripRaw.trim()
    else descriptionForRecord = item.description ?? ""
    if (isJunkScrapedDescription(descriptionForRecord)) descriptionForRecord = ""

    const record: PerfumeCsvRecord = {
      name,
      description: descriptionForRecord,
      image: item.image,
      perfumeHouse: item.perfumeHouse ?? houseName,
      openNotes: JSON.stringify(notes.openNotes),
      heartNotes: JSON.stringify(notes.heartNotes),
      baseNotes: JSON.stringify(notes.baseNotes),
      detailURL: item.detailURL,
    }

    return {
      ok: true,
      index,
      item,
      name,
      notes,
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
        (totalNotes >= 2 || (totalNotes >= 1 && !hasUsableMerchantDescription))

      if (shouldRunNoir) {
        throwIfAborted(sig)
        const noirDesc = await generateNoirDescription(
          noirLlm,
          p.name,
          p.notes,
          (p.record.description || "").trim(),
          previousOpenings,
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
 *
 * Phase 1 (extract/merge/translate) uses limited parallelism (NOTES_PIPELINE_CONCURRENCY, default 3).
 * Film noir (Phase 2) stays sequential so previousOpenings matches the original pipeline.
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

  const llmTimeout = resolveNotesPipelineLlmTimeoutMs()
  const llm = new ChatOpenAI({
    model,
    temperature: 0.1,
    apiKey: process.env.OPENAI_API_KEY,
    timeout: llmTimeout,
    maxRetries: 0,
  })

  const noirLlm = options.generateNoirDescriptions
    ? new ChatOpenAI({
        model,
        temperature: 0.7,
        apiKey: process.env.OPENAI_API_KEY,
        timeout: llmTimeout,
        maxRetries: 0,
      })
    : undefined

  const graph = buildGraph(llm, options, noirLlm)
  const finalState = await graph.invoke({ items, houseName, results: [] })
  return finalState.results
}

import type { TitleDashSegment } from "@/types/scraper"
import {
  assignVolatilityLayersFromFlatOpen,
  canonicalizeNote,
  expandLayerNoteBlobs,
  explodeSpaceSeparatedNoteBlob,
  HYPHEN_PROTECTED_NOTE_FRAGMENTS,
  splitGluedMerchantNoteRun,
} from "@/lib/scraper/canonical-notes"
import {
  buildNoteConfirmationCorpus,
  extractUnlabeledFragranceNotesBlock,
  isComplianceOrSourcingNote,
  isThemeCssTokenNote,
  isNoteSubstantiatedInSource,
  looksLikeProseNotePhrase,
  isObviousNonMaterialNote,
  peelMarketingDescriptorTail,
  sanitizeExtractedNoteCandidate,
  stripFragranceNoteProseLead,
} from "@/lib/scraper/note-source-confirmation"
import { isDisplayableScentNote } from "@/utils/validation/note-validation.server"
import {
  detailUrlAlignsWithProductName,
  extractMerchantNoteBootstrapFromHtml,
  hasExplicitNoteListSignal,
  pdpNoteBootstrapCache,
  searchAndromedaProductUrl,
  buildAndromedaCandidateProductUrls,
  stripEmbeddedHtmlMarkup,
  stripHtmlToPlainText,
  NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE,
  extractAndromedaStackedNotesFromPlain,
  extractAndromedaScentProfileFromPlain,
  inferAndromedaAmarettoNotesFromProse,
  extractMatierePremiereMaterialsFromPlain,
  extractMatierePremiereExtraitMaterialsFromPlain,
} from "@/lib/scraper/stages/pdp-bootstrap"

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

/** Strip catalog chrome "Perfume - Name" / "Name Perfume" so the scent name remains. */
const stripCatalogPerfumeWord = (name: string): string =>
  name
    .replace(/^\s*perfume\s*[-–—:|]\s+/i, "")
    .replace(/^\s*perfume\s+/i, "")
    .replace(/\s+perfume\s*$/i, "")
    .trim()

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
  let out = stripCatalogPerfumeWord(name)
  const seg = resolveTitleDashSegment(opts)
  if (seg === "before") out = takeBeforeDash(out)
  else if (seg === "after") out = takeAfterDash(out)
  if (opts.titleColonSegment === "before") out = takeBeforeColon(out)
  else if (opts.titleColonSegment === "after") out = takeAfterColon(out)
  if (opts.titleTakeBeforeFirstComma) out = takeBeforeFirstComma(out)
  else if (opts.titleTakeAfterFirstComma) out = takeAfterFirstComma(out)
  if (opts.titleStripNumbers) out = stripNumbersFromTitle(out)
  if (opts.titleOmitWords?.length) out = omitWordsFromTitle(out, opts.titleOmitWords)
  out = stripCatalogPerfumeWord(out)
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
    // Strip dangling note-layer labels (e.g. "Heart:", "Top:", "Base:", "Notes:") left at the end
    // after their note values have been removed by stripNotesFromDescription.
    .replace(/\s*\b(?:top|heart|middle|base|bottom|notes?|accord|opening)\s*:\s*$/i, "")
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
 * Skip CSS functions (`var(--x)`, `rgb(...)`, …) so theme bleed never becomes notes.
 */
const CSS_FUNCTION_PREFIX_RE =
  /^(?:var|rgba?|hsla?|url|calc|env|clamp|min|max|attr|linear-gradient|radial-gradient)$/i

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
      if (CSS_FUNCTION_PREFIX_RE.test(prefix)) {
        continue
      }
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
      if (CSS_FUNCTION_PREFIX_RE.test(prefix)) {
        continue
      }
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

const NOTE_PROSE_CONNECTOR_RE =
  /\s*(?:,\s*)?(?:mingling with|mixed with|blended with|layered with|infused with|laced with|paired with|combined with|together with|along with|with the essence of|with notes? of|with a (?:hint|whisper|touch|veil) of|on a bed of|resting on|over a base of|atop|overlaid with|finished with|and the essence of|plus)\s+/gi

const NOTE_PROSE_FILLER = new Set([
  "complex",
  "fruity",
  "rich",
  "warm",
  "soft",
  "sweet",
  "dark",
  "bright",
  "fresh",
  "the",
  "a",
  "an",
  "of",
  "and",
  "with",
  "on",
  "in",
  "to",
  "from",
  "essence",
  "notes",
  "note",
  "scent",
  "aroma",
  "perfume",
  "fragrance",
])

/** Damask-style narrative Notes: sentence → comma list before splitting. */
const proseNotesBodyToList = (body: string): string => {
  let t = (body ?? "").trim()
  if (!t) return ""
  const partsPreview = t.split(/,(?![^()]*\))/).map(p => p.trim()).filter(Boolean)
  const looksLikeList =
    partsPreview.length >= 3 && partsPreview.every(p => p.split(/\s+/).filter(Boolean).length <= 5)
  if (looksLikeList) return t
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length <= 6 && (t.includes(",") || /\band\b/i.test(t))) return t
  t = t.replace(NOTE_PROSE_CONNECTOR_RE, ", ")
  t = t.replace(/\s+and\s+/gi, ", ")
  t = t.replace(/\s+/g, " ").replace(/^[.,;\s]+|[.,;\s]+$/g, "")
  const parts: string[] = []
  for (const raw of t.split(/,(?![^()]*\))/)) {
    let toks = raw.trim().split(/\s+/).filter(Boolean)
    while (toks.length && NOTE_PROSE_FILLER.has(toks[0]!.toLowerCase().replace(/[.,;]+$/g, ""))) {
      toks = toks.slice(1)
    }
    while (
      toks.length &&
      NOTE_PROSE_FILLER.has(toks[toks.length - 1]!.toLowerCase().replace(/[.,;]+$/g, ""))
    ) {
      toks = toks.slice(0, -1)
    }
    const cleaned = toks.join(" ").replace(/^[.,;\s]+|[.,;\s]+$/g, "")
    if (cleaned.length >= 3) parts.push(cleaned)
  }
  return parts.length ? parts.join(", ") : body
}

function splitNoteList(text: string): string[] {
  if (!text?.trim()) return []
  let normalized = stripEmbeddedHtmlMarkup(text)
  if (normalized.split(/\s+/).filter(Boolean).length > 6) {
    normalized = proseNotesBodyToList(normalized)
  }
  normalized = normalized
    .replace(/\\\//g, "/")
    .replace(/\\u0026amp;/gi, "&")
    .replace(/\\u0026/gi, "&")
    .replace(/[™®©]/g, "")
    .replace(/\\n|\\t/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r/g, "\n")
    .replace(/[•·✧✦\u2726-\u2728\u2736\u2737\u2740]+/g, ",")

  // AOE Celeste-style ALL-CAPS lists use ". " as a material separator.
  const letters = [...normalized].filter(c => /[A-Za-z]/.test(c))
  if (letters.length >= 8) {
    const upperRatio = letters.filter(c => c === c.toUpperCase()).length / letters.length
    if (upperRatio >= 0.65 && /\.\s+[A-Za-z]/.test(normalized)) {
      normalized = normalized.replace(/\.\s+/g, ", ")
    }
  }

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
      .replace(/\s+description\b.*$/i, "")
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
  return stripEmbeddedHtmlMarkup(text)
    .replace(
      /\s+(?:additional information|ingredients|how to use|directions(?:\s+for\s+use)?|customer reviews?|reviews?|specifications|size [Gg]uide|care [Ii]nstructions|warnings?|disclaimer|how it wears|how (?:it\s+)?smells|wear(?:ability|ing)\s+notes?|wear\s+guide\b|good\s+to\s+know\b|whether\s+you(?:'|'|&#39;)re\b|original\s+manufacturers\b|important information|important\s+(?:shop|order)\s+info|available\s+sizes?|size\s+options?|available\s+in|shipping|processing|packing|please\s+note|please\s+read|about\s+this\s+fragrance|about\s+(?:our|the)\s+brand|(?:scent\s+)?profile\s+(?:guide|overview)|pairing\s+suggestions?|frequently\s+asked|product\s+reviews?(?:\s*&\s*videos?)?|related\s+products|master\s+perfumer|shopping\s+cart)\b[\s\S]*$/i,
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
  /\bmade\s+with\s+squarespace\b/i,
]

/** Story copy before Fragrance Notes — must not truncate note extraction source. */
const POLICY_STRIP_DEFER_BEFORE_FRAGRANCE_NOTES: RegExp[] = [
  /\bi\s+was\s+told\b/i,
  /\bmaking\s+a\s+dupe\b/i,
  /\bplease\s+text\s+if\s+you\b/i,
]

/** Note pyramid after an INCI block (Laboratorio Olfattivo: Ingredients … Note di testa). */
const NOTE_PYRAMID_AFTER_INGREDIENTS_RE =
  /\b(?:note\s+di\s+(?:testa|cuore|fondo)|note\s+olfattive|top\s+notes?|heart\s+notes?|base\s+notes?|head\s+notes?|opening\s+notes?|notes?\s+de\s+(?:tête|tete|cœur|coeur|fond)|notas\s+de\s+(?:salida|coraz[oó]n|corazon|fondo)|fragrance\s+notes?)\b/i

const INGREDIENTS_START_RE = /\bingredients?\s*:|\bingredienti\s*:/i

/** Drop INCI blocks; keep a note pyramid that appears *after* Ingredients. */
const exciseOrTruncateIngredients = (text: string): string => {
  const m = INGREDIENTS_START_RE.exec(text)
  if (!m) return text
  const rest = text.slice(m.index + m[0].length)
  const noteM = NOTE_PYRAMID_AFTER_INGREDIENTS_RE.exec(rest)
  if (noteM) {
    return `${text.slice(0, m.index)}\n${rest.slice(noteM.index)}`.trim()
  }
  return text.slice(0, m.index).replace(/\s+$/u, "").trim()
}

const stripAtEarliestPatterns = (text: string, patterns: RegExp[]): string => {
  if (!text?.trim()) return ""
  const fragranceNotesIdx = text.search(/\bfragrance\s+notes?\b/i)
  let cutoff = text.length
  for (const re of patterns) {
    // Ingredients handled by exciseOrTruncateIngredients (post-INCI pyramids survive).
    if (/ingredients\?/i.test(re.source)) continue
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
  stripAtEarliestPatterns(exciseOrTruncateIngredients(text), POLICY_BOILERPLATE_START_PATTERNS)

/** Notes-source text after policy / ingredients / compliance blocks are removed. */
const prepareMerchantNotesSource = (text: string): string =>
  sanitizeCopyForNotePipeline(stripPolicyBoilerplate(text ?? ""))

export const isJunkScrapedDescription = (text: string | null | undefined): boolean => {
  const t = text?.trim() ?? ""
  if (!t) return false
  const lower = t.toLowerCase()
  if (/original,\s*artisan\s+perfumes/i.test(lower) && /art in air/i.test(lower)) return true
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
  if (/^interested in trying a sample\?/i.test(t)) return true
  if (/\btry in a 4 piece sample kit\b/i.test(lower) && t.length < 520) return true
  if (/\bfull des(?:crip(?:tion)?)?\s*$/i.test(t)) return true
  return false
}


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
  const normalizedUrl = detailURL?.split("?")[0]?.split("#")[0]?.trim() ?? ""
  const currentBad =
    !normalizedUrl ||
    NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE.test(normalizedUrl) ||
    !detailUrlAlignsWithProductName(name, normalizedUrl)

  if (normalizedUrl && !currentBad) {
    return normalizedUrl
  }
  if (!name?.trim()) return normalizedUrl || detailURL

  const searched = await searchAndromedaProductUrl(name, sig)
  if (searched && detailUrlAlignsWithProductName(name, searched)) {
    onProgress?.(
      `Notes pipeline: resolved Andromeda PDP URL for "${name.slice(0, 48)}" → ${searched}`,
    )
    return searched
  }

  const candidates = buildAndromedaCandidateProductUrls(name)
  if (searched && !candidates.includes(searched)) {
    candidates.unshift(searched)
  }

  for (const candidate of candidates) {
    if (candidate === normalizedUrl) continue
    pdpNoteBootstrapCache.delete(candidate)
    if (await probeAndromedaProductUrlForNotes(candidate, sig)) {
      onProgress?.(
        `Notes pipeline: resolved Andromeda PDP URL for "${name.slice(0, 48)}" → ${candidate}`,
      )
      return candidate
    }
  }
  return normalizedUrl || detailURL
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

const isThemeJunkDominatedLayers = (notes: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): boolean => {
  const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
  if (all.length === 0) return false
  const junkCount = all.filter(n => isThemeCssTokenNote(n) || isObviousNonMaterialNote(n)).length
  return junkCount >= 2 && junkCount >= all.length * 0.5
}

/** Wipe layers when Shopify theme CSS tokens dominate (Etat Libre accordion HTML comment bleed). */
const rejectThemeJunkDominatedLayers = (notes: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): { openNotes: string[]; heartNotes: string[]; baseNotes: string[] } => {
  const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
  if (all.length === 0) return notes
  const drop = (arr: string[]) =>
    arr.filter(n => !isThemeCssTokenNote(n) && !isObviousNonMaterialNote(n))
  const cleaned = {
    openNotes: drop(notes.openNotes),
    heartNotes: drop(notes.heartNotes),
    baseNotes: drop(notes.baseNotes),
  }
  if (isThemeJunkDominatedLayers(notes)) {
    return cleaned
  }
  return cleaned
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
  let s = text.replace(/<!--[\s\S]*?-->/g, " ")
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
  s = s.replace(/[\u2500-\u257F\u2580-\u259F]/g, " ")
  // Strip inline CSS blocks that may be glued to valid text after whitespace collapsing
  // (e.g. "airy florals body, .cls { font-family: sans-serif; background: radial-gradient(...); }")
  s = s.replace(/\s*\{[^}]*(?:font-family|radial-gradient|linear-gradient|background-color)[^}]*\}/gi, "")
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
  s = s.replace(/\bMade\s+with\s+Squarespace\b/gi, " ")
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
  if (/\bFULL DESCRIPTION\b/i.test(t)) return false
  const stripped = stripPolicyBoilerplate(t)
  // Less than 80 chars of real narrative after policy cutoff = treat as boilerplate-only.
  return stripped.length < 80
}

const ETAT_LIBRE_BRAND_BOILERPLATE_START_RE =
  /^The Brand Etat Libre dOrange currently presents\b/i

/** Damask Haus / indie Shopify "About the house" accordion bleed. */
const HOUSE_ABOUT_BOILERPLATE_RE =
  /^(?:About\s+Damask\s+Haus\b|About\s+[A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,4}\s*:)/i

const HOUSE_FOUNDED_BOILERPLATE_RE =
  /\b(?:was\s+founded\s+in\s+\d{4}\b|handcrafted\s+and\s+made\s+in\s+small\s+batches\s+with\s+premium\b|The\s+Damask\s+Haus\s+process\b)/i

const HOUSE_ABOUT_SECTION_RE =
  /\bAbout\s+(?:Damask\s+Haus|[A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,4})\s*:[\s\S]*$/i

const isHouseAboutBoilerplate = (text: string): boolean => {
  const t = (text ?? "").replace(/<!--[\s\S]*?-->/g, " ").trim()
  if (!t) return false
  if (HOUSE_ABOUT_BOILERPLATE_RE.test(t)) return true
  if (HOUSE_FOUNDED_BOILERPLATE_RE.test(t) && (t.toLowerCase().startsWith("about ") || t.length > 500)) {
    return true
  }
  return false
}

const ETAT_LIBRE_SAMPLE_PREFIX_RE =
  /^interested in trying a sample\?\s*(?:Try In a 4 Piece Sample Kit\s*)?(?:Sample\s*\$[\d.]+\s*)?/i

const ETAT_LIBRE_SAMPLE_INLINE_RE =
  /interested in trying a sample\?\s*(?:Try In a 4 Piece Sample Kit\s*)?(?:Sample\s*\$[\d.]+\s*)?/gi

const ETAT_LIBRE_FAMILY_TAGS_RE =
  /^(?:(?:Fresh|Floral|Woody|Gourmand|Spicy|Leathery|Tobacco|Powdery|Aromatic|Earthy|Citrus)(?:\s*,?\s*)?)+/i

const ETAT_LIBRE_PDP_SECTION_END_RE =
  /\b(?:MAIN NOTES|Pronunciation|Customer Reviews|CHOOSE SIZE|Ingredients)\b/i

/** Section-end anchors safe to apply outside an explicit Etat Libre context (excludes MAIN NOTES which is used as a note-block header on other merchant sites). */
const GENERAL_PDP_SECTION_END_RE = /\b(?:Pronunciation|Customer Reviews|CHOOSE SIZE|Ingredients)\b/i

export const isEtatLibreProductUrl = (detailURL: string): boolean =>
  /etatlibredorange/i.test(detailURL ?? "")

/** Strip sample-kit promos and family-tag teasers prepended to Etat Libre PDP copy. */
export const stripEtatLibreUiNoise = (text: string): string => {
  let t = (text ?? "").trim()
  if (!t) return ""
  t = t.replace(ETAT_LIBRE_SAMPLE_PREFIX_RE, "").trim()
  t = t.replace(ETAT_LIBRE_SAMPLE_INLINE_RE, "").trim()
  for (let i = 0; i < 3; i += 1) {
    const nxt = t.replace(ETAT_LIBRE_FAMILY_TAGS_RE, "").trim()
    if (nxt === t) break
    t = nxt
  }
  return t
}

const hasDuplicatedProseBlock = (text: string, minLen = 72): boolean => {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length < minLen * 2) return false
  for (let size = minLen; size <= Math.min(180, Math.floor(t.length / 2) + 1); size += 1) {
    const chunk = t.slice(0, size).trim()
    if (chunk.length >= minLen && t.slice(size).includes(chunk)) return true
  }
  return false
}

/** True when scraped description should be wiped and replaced from PDP HTML or noir. */
export const isUnusableMerchantDescription = (raw: string | null | undefined): boolean => {
  const t = (raw ?? "").trim()
  if (!t) return true
  if (isJunkScrapedDescription(t)) return true
  if (ETAT_LIBRE_BRAND_BOILERPLATE_START_RE.test(t.replace(/<!--[\s\S]*?-->/g, " ").trim())) return true
  if (isHouseAboutBoilerplate(t)) return true
  const lower = t.toLowerCase()
  if (lower.startsWith("interested in trying a sample?")) return true
  if (/\btry in a 4 piece sample kit\b/i.test(lower) && t.length < 520) return true
  if (/\bfull des(?:crip(?:tion)?)?\s*$/i.test(t)) return true
  if (hasDuplicatedProseBlock(t)) return true
  if (t.length < 220 && !/[.!?"'\u2019\u201d]\s*$/.test(t)) return true
  return false
}

/** Strip HTML comments, Etat Libre accordion bleed, and FULL DESCRIPTION labels. */
export const normalizePdpDescription = (text: string): string => {
  let t = (text ?? "").replace(/<!--[\s\S]*?-->/g, " ").replace(/\s+/g, " ").trim()
  if (!t) return ""

  t = stripEtatLibreUiNoise(t)
  if (!t) return ""

  const fullIdx = t.search(/\bFULL DESCRIPTION\b/i)
  if (fullIdx >= 0) {
    t = t.slice(fullIdx).trim()
    const end = t.search(ETAT_LIBRE_PDP_SECTION_END_RE)
    if (end > 20) t = t.slice(0, end).trim()
    t = t.replace(/^\s*FULL DESCRIPTION\s+/i, "").trim()
    return t.replace(/\.{2,}\s*$/, "").replace(/[ \t]+$/, "").trim()
  }

  if (ETAT_LIBRE_BRAND_BOILERPLATE_START_RE.test(t) || isHouseAboutBoilerplate(t)) {
    const cut = t.search(
      /(?:interested in trying a sample\?|S as in blood|\bFULL DESCRIPTION\b)/i,
    )
    if (cut >= 0) {
      t = t.slice(cut).trim()
      t = t.replace(/^\s*FULL DESCRIPTION\s+/i, "").trim()
    } else if (isHouseAboutBoilerplate(t) && !HOUSE_ABOUT_SECTION_RE.test(t.slice(40))) {
      return ""
    }
  }

  const aboutIdx = t.search(HOUSE_ABOUT_SECTION_RE)
  if (aboutIdx > 40) t = t.slice(0, aboutIdx).trim()
  else if (aboutIdx >= 0 && aboutIdx <= 40) return ""

  const end = t.search(GENERAL_PDP_SECTION_END_RE)
  if (end > 80) t = t.slice(0, end).trim()
  t = t.replace(/^\s*FULL DESCRIPTION\s+/i, "").trim()
  return t.replace(/\.{2,}\s*$/, "").replace(/[ \t]+$/, "").trim()
}

const extractFullDescriptionFromHtml = (html: string): string | null => {
  if (!html?.trim()) return null

  const headingRe =
    /<h[1-6][^>]*>\s*FULL DESCRIPTION\s*<\/h[1-6]>([\s\S]*?)(?=<h[1-6][^>]*>|$)/gi
  let match: RegExpExecArray | null
  const blocks: string[] = []
  while ((match = headingRe.exec(html)) !== null) {
    const body = (match[1] ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (body.length >= 20) blocks.push(body)
  }
  if (blocks.length > 0) return blocks.join(" ").trim()

  const plain = stripHtmlToPlainText(html)
  const m = plain.match(
    /\bFULL DESCRIPTION\b\s*([\s\S]+?)(?=\bMAIN NOTES\b|\bPronunciation\b|\bCustomer Reviews\b|$)/i,
  )
  if (m?.[1]) return m[1].replace(/\s+/g, " ").trim().replace(/[ .]+$/, "").trim()
  return null
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
    /\b(top|open(?:ing)?|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry[\s-]*down|drydown|end)\s+notes?\s+(?!(?:of|and|with|from|to|in|the|a|an|is|are|burst|unveil|reflect|parallel|usher|spill|offering|formed|features|includes|evoke|capture|begin|starts|was|were|become|creates|leaves|marks|embody|equated|ingress|suggesting|embodying|paralleling|invoke|invites|selected|linger|wraps)\b)(?=[A-Za-z])/gi,
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
    /\s+(?:series|perfume\s+family|unisex|contains\s+true\s+animalics|scent\s+strength|extra info|cozy\s+and\s+soft|for\s+milk\s+lovers|pastel\s+girls|fans\s+of|extrait\s+de\s+parfum|hand-blended\s+with\s+care|gentle\s+projection|original\s+manufacturers|vibe\s*&\s*wear|vibe\b|wear\s*&\s*performance|wear\s+guide\b|good\s+to\s+know\b|season\s*:|projection\s*:|longevity\s*:|citrus\s+aromatic\b|amber-musky\b|seaside\s+breeze\b|description|product\s+reviews?(?:\s*&\s*videos?)?|related\s+products|shopping\s+cart|made\s+with\s+squarespace)\b/i,
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
    /(?:\b(?:perfect|ideal|great|wonderful|excellent)\s+(?:for|choice|option)\b|\ba\s+(?:great|perfect|beautiful|wonderful|stunning|luxurious|gorgeous|rich|dark|warm|sensual|cozy)\s+choice\b|\b(?:this\s+(?:fragrance|scent|perfume|inspired|is)|the\s+(?:opening|drydown|dry\s+down|base\s+(?:lingers|settles|brings))|inspired\s+by|perfect\s+for\s+anyone|opens?\s+with\s+(?:a|the)|think\s+(?:crisp|fresh|warm|cool|dark|soft)|vibe\b|scent\s+story\b|how\s+it\s+wears|wear\s*&\s*performance\b|wear\s+guide\b|good\s+to\s+know\b|whether\s+you(?:'|'|&#39;)re\b|surrounds\s+you\s+in\b|sweet,\s*glamorous\b|glamorous\s*&\s*addictive\b|season\s*:|projection\s*:|longevity\s*:|available\s+sizes?|important\s+(?:information|shop|order)|all\s+perfumes?\s+are\s+hand|this\s+is\s+(?:a|an|the)\s+kind|cozy\s+and\s+soft|for\s+milk\s+lovers|pastel\s+girls|fans\s+of|extrait\s+de\s+parfum|hand-blended\s+with\s+care|gentle\s+projection|citrus\s+aromatic\b|amber-musky\b|seaside\s+breeze\b|original\s+manufacturers\b|wrap\s+(?:yourself|your\s+senses)|float\s+into|if\s+you\s+love|with\s+a\s+love\b|the\s+girls\s+came\b|i\s+cannot\s+live\b|read\s+(?:more|the\s+history)\s+below\b|perfumer['']?s?\s+note\b|this\s+perfume\s+smells\b|let\s+them\s+eat\b|inspiration\s+for\s+when\b|dab\s+of\s+this\b|when\s+constructing\b|became\s+a\s+prominent\b)\b|description\s*:|(?:\s|^)description\b|like\s+(?:a|an)\b|each\s+(?:spray|spritz)\b)/i

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
  /\bvideos\b/i,
  /\brelated products\b/i,
  /\bcaptivate your senses\b/i,
  /^romance$/i,
  /^exotic sophistication$/i,
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
  if (/\bMAIN NOTES\b/i.test(source)) {
    for (const n of extractEtatLibreAuthoritativeMainNotes(source)) {
      const lc = n.trim().toLowerCase()
      if (lc) trusted.add(lc)
    }
  }
  if (/\b(?:main\s+ingredient|creative\s+approach)\s*:/i.test(source)) {
    for (const n of extractMatierePremiereMaterialsFromPlain(source)) {
      const lc = n.trim().toLowerCase()
      if (lc) trusted.add(lc)
    }
  }
  for (const n of extractMatierePremiereExtraitMaterialsFromPlain(source)) {
    const lc = n.trim().toLowerCase()
    if (lc) trusted.add(lc)
  }
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

/**
 * Keep merchant-trusted materials even when they fail prose/kept-note heuristics.
 * Still drop compliance boilerplate and theme/CSS bleed.
 */
const filterNotesByTrust = (arr: string[], trusted: Set<string>): string[] =>
  arr.filter(n => {
    const lc = n.trim().toLowerCase()
    if (!lc) return false
    if (isComplianceOrSourcingNote(n) || isThemeCssTokenNote(n)) return false
    // First-person / leftover <i> fragments are never materials, even when they appear in PDP copy.
    if (/^i\s+\S/i.test(lc)) return false
    if (trusted.has(lc)) return true
    return isScraperKeptNote(n) && !looksLikeProseNotePhrase(n)
  })

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
  if (MATERIAL_NOTES_PHRASE_RE.test(note.trim())) return false
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
  if (isThemeCssTokenNote(t) || isObviousNonMaterialNote(t)) return false
  if (isDisplayableScentNote(t) && !looksLikeJunkNote(t)) return true
  if (isScraperExtendedAccordNote(t)) return true
  return false
}

/** Strip leading prose wrappers before note tokens (e.g. "Notes of cinnamon" → "cinnamon"). */
const stripNoteListProsePrefix = (p: string): string =>
  stripFragranceNoteProseLead(
    p
      .replace(/^\s*(?:top|middle|base)\s+notes?\s+(?:are|is|of)\s+/i, "")
      .replace(/^\s*notes\s+of\s+/i, "")
      .replace(/^\s*note\s+of\s+/i, "")
      .replace(/^\s*a\s+hint\s+of\s+/i, "")
      .replace(/^\s*hints?\s+of\s+/i, "")
      .replace(/^\s*enhanced\s+by\s+/i, "")
      .replace(/^\s*enriched\s+by\s+/i, "")
      .replace(/^\s*creating\s+a\s+rich\s+/i, "")
      .trim(),
  )

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
  if (/^(base|bottom|background|foundation|dry down|drydown|dry|end)(?: notes?)?$/.test(normalized))
    return "base"
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
    /(?<![a-z0-9-])(top(?:\s+notes?)?|open(?:ing)?(?:\s+notes?)?|head(?:\s+notes?)?|heart(?:\s+notes?)?|middle(?:\s+notes?)?|mid(?:\s+notes?)?|core(?:\s+notes?)?|body(?:\s+notes?)?|cent(?:er|re)(?:\s+notes?)?|base(?:\s+notes?)?|bottom(?:\s+notes?)?|background(?:\s+notes?)?|foundation(?:\s+notes?)?|dry\s*down(?:\s+notes?)?|drydown(?:\s+notes?)?|dry(?:\s+notes?)?|end(?:\s+notes?)?|notes?\s+de\s+(?:tête|tete)|notes?\s+de\s+(?:cœur|coeur)|notes?\s+de\s+fond|note\s+di\s+(?:testa|cuore|fondo|olfattive)|notas\s+de\s+(?:salida|coraz[oó]n|corazon|fondo)|kopfnoten?|herznoten?|basisnoten?|duftnoten?|topnoten?|hartnoten?)\s*[:\-\u2013\u2014–—]\s*/gi
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
  /\s+(?:Available in |Originally (?:a |the )?|Our oil perfume|NOTE:|Packaging:|How to use|Shipping:|Return [Pp]olicy|Subscribe(?:\s+now|\s+today)?|You may also|Customers also|Related products|Complete the look|Pairs well|Also available|More from|Write a review|Questions\?|Leave a review|Product reviews?(?:\s*&\s*videos?)?|Ingredients captivate your senses)\b/i,
  /\s+#{1,6}\s*(?:Ingredients|How to use|Shipping|Returns?|FAQ|Details|Directions|Warnings?|Disclaimer|Specifications|Size [Gg]uide|Care [Ii]nstructions)\b/i,
  /\s+(?:Ingredients|Cruelty[- ]free|Vegan |Dermatologist|Clinically tested|Prop(?:osition|\.)?\s*65|FDA disclaimer)\b/i,
  // Common post-notes sections on indie Shopify PDP
  /\s+(?:When to Wear|Vibe|How It Wears|Wear\s*&\s*Performance|Wear\s+Guide\b|Good\s+to\s+Know\b|Whether\s+You(?:'|'|&#39;)re\b|Original\s+Manufacturers\b|Season\s*:|Projection\s*:|Longevity\s*:|How (?:It\s+)?Smells|Available Sizes?|Important Information|Important Shop Info|Final Sale|Sampling Size Policy|Fragrance Description(?!\s+:)|For\s+milk\s+lovers|pastel\s+girls|Hand-blended\s+with\s+care|Extrait\s+de\s+Parfum\s+strength|Citrus\s+Aromatic\b|Amber-Musky\b|Seaside\s+Breeze\b|Sweet,\s*Glamorous\b)\b/i,
  /\s+(?:Description\s*:|Like\s+(?:a|an)\b|Each\s+(?:spray|spritz)\b)/i,
  /\s+(?:Wrap\s+(?:yourself|your\s+senses)|Float\s+into|If\s+you\s+love|This\s+perfume\s+is)\b/i,
  /\s+(?:I was told|Making a dupe|Please text if you)\b/i,
  /\s+Made\s+with\s+Squarespace\b/i,
  // Encoded HTML pasted after note pyramids (Andromeda Shopify template bleed)
  /\s+(?:&lt;|<)\/?(?:head|meta|body|html|script|style)\b/i,
  // Note set followed immediately by marketing paragraph openers (whitespace-collapsed)
  /\s+(?:Think\s+(?:crisp|fresh|warm|cool|dark|soft|juicy|lush)|Opens?\s+(?:with|on)|A\s+(?:crisp|juicy|dark|warm|rich|soft|bright|clean|bold|lush|fresh|dreamy|radiant|sleek|daring)\b|\bSparkling\b|\bThis\s+inspired\b)/i,
  // Immortal Perfumes: literary blurb / PDP chrome glued after flat "Notes: a, b, and c"
  /\s+(?:With\s+a\s+love\b|The\s+girls\s+came\b|I\s+cannot\s+live\b|Read\s+(?:more|the\s+history)\s+below\b|Perfumer['']?s?\s+note\b|This\s+perfume\s+smells\b|Let\s+them\s+eat\b|Inspiration\s+for\s+when\b|Dab\s+of\s+this\b|When\s+constructing\b|Became\s+a\s+prominent\b|Each\s+is\s+one-of-a-kind\b|Generally\s+about\s+a\s+week\b|Use\s+the\s+drop-?down\b|Part\s+newspaper\b|History\s+mingles\b)/i,
]

const MIN_FLAT_CHUNK_BEFORE_TRUNCATE = 8
/** "lemon, cedar — read more about …" / en-dash tails after lists (lower min — short lists still valid). */
const FLAT_NOTE_EM_DASH_TAIL_RE = /\s+[\u2013\u2014–—]\s+/
const MIN_FLAT_CHUNK_BEFORE_EM_DASH = 3

const truncateFlatNotesChunk = (chunk: string): string => {
  let s = chunk.trim().replace(/\*+\s*$/, "").trim()
  if (!s) return s
  // Collection / literary PDPs: "Notes:" body is marketing copy, not materials.
  if (
    /^(?:each\s+is|the\s+girls\s+came|generally\s+about|use\s+the\s+drop|part\s+newspaper|history\s+mingles|with\s+a\s+love|i\s+cannot|one-of-a-kind|features\s+from\s+fragrance)/i.test(
      s,
    )
  ) {
    return ""
  }
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
    /\b(?:top(?:\s+notes?)?|open(?:ing)?(?:\s+notes?)?|head(?:\s+notes?)?|heart(?:\s+notes?)?|middle(?:\s+notes?)?|mid(?:\s+notes?)?|core(?:\s+notes?)?|body(?:\s+notes?)?|cent(?:er|re)(?:\s+notes?)?|base(?:\s+notes?)?|bottom(?:\s+notes?)?|background(?:\s+notes?)?|foundation(?:\s+notes?)?|dry\s*down(?:\s+notes?)?|drydown(?:\s+notes?)?|notes?\s+de\s+(?:tête|tete|cœur|coeur|fond)|note\s+di\s+(?:testa|cuore|fondo|olfattive)|notas\s+de\s+(?:salida|coraz[oó]n|corazon|fondo)|kopfnoten?|herznoten?|basisnoten?|topnoten?|hartnoten?)\s*[:\-\u2013\u2014–—]/gi
  return [...source.matchAll(re)].length
}

/**
 * WooCommerce accordions (Vivamor): Selenium often captures "Top Notes:" / "Heart Notes:" headers
 * without the hidden tab body. Treat that as "no usable pyramid" so HTTP bootstrap still runs.
 */
const isThinLayeredPyramidScrape = (text: string): boolean => {
  const collapsed = (text ?? "").replace(/\s+/g, " ").trim()
  if (!collapsed) return false
  const labelCount = countInlineLayerLabels(collapsed)
  if (labelCount < 2) return false

  const layerBodyRe =
    /\b(?:top|open|opening|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry\s*down|drydown|end)\s*(?:notes?)?\s*[:\-\u2013\u2014–—]\s*([\s\S]*?)(?=\s+\b(?:top|open|opening|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry\s*down|drydown|end)\s*(?:notes?)?\s*[:\-\u2013\u2014–—]|$)/gi
  let match: RegExpExecArray | null
  let layersWithMaterial = 0
  while ((match = layerBodyRe.exec(collapsed)) !== null) {
    const body = (match[1] ?? "")
      .trim()
      .replace(
        /\b(?:description|product\s+reviews?(?:\s*&\s*videos?)?|related\s+products|master\s+perfumer|olfactory\s+notes)\b.*$/i,
        "",
      )
      .trim()
    if (body.length >= 4 && /[a-z]{3,}/i.test(body) && (/,|&/.test(body) || body.split(/\s+/).filter(Boolean).length >= 2)) {
      layersWithMaterial += 1
    }
  }
  return layersWithMaterial < labelCount
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
  // "… notes of caramelized vanilla, …" (Andromeda gourmand PDPs, e.g. Cheirosa 71)
  /(?:^|[\s.!?\n*])(?:inviting\s+)?notes?\s+of\s+([^.!?\n*]+)/gi,
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

/** Valid merchant note phrases ending in "notes" (not pyramid headers). */
const MATERIAL_NOTES_PHRASE_RE =
  /^(?:animal|powdery|woody|floral|spicy|gourmand|oriental|musky|amber|smoky|green|white|soft)\s+notes$/i

/**
 * Etat Libre MAIN NOTES lists are short comma-separated lines. Selenium/bootstrap merges often glue
 * FULL DESCRIPTION prose after the last material when accordion trailers (Pronunciation) are missing.
 */
const trimEtatLibreMainNotesBody = (body: string): string => {
  let s = body.trim()
  if (!s) return s

  const headerCut = s.search(
    /\s+(?:Pronunciation|Customer Reviews|Ingredients|INGREDIENTS|CHOOSE SIZE|Share|FULL DESCRIPTION|ALCOHOL DENAT)\b/i,
  )
  if (headerCut >= 0) s = s.slice(0, headerCut).trim()

  const proseCut = s.search(
    /\.\s+(?:Sheer|For one|Under the|you can|There are|The powdered|It is|This is|Infused|Lifted|A clear)\b/i,
  )
  if (proseCut >= 0) s = s.slice(0, proseCut).trim()

  const inlineProseCut = s.search(
    /\s+(?:Sheer|For one|Under the|you can|There are|The powdered|It is|This is|Infused with|Lifted by|Dear god|Snatch|How)\b/i,
  )
  if (inlineProseCut >= 0) s = s.slice(0, inlineProseCut).trim()

  /**
   * Truncate at prose that bleeds onto the last note when accordion/newline separation is lost
   * (e.g. "amber, animal notes Closing time at a shadowy bar..." → stop after "animal notes").
   * Signal: after the last comma-separated item (no further comma), a sentence starts with an
   * uppercase word that is not itself a material (detected by common prose continuation words).
   */
  const nounProseCut = s.search(
    /\s+(?:Closing|Opening|Step|Walk|Imagine|Picture|Enter|Discover|Experience|Let|Wear|Feel|Breathe|Dive|Drift|Surrender|Embody|Inspired|Created|Born|Designed|Made|Crafted|Perfect|Ideal|Suitable|Available|Order|Shop|Buy|Get|Add|Use|Apply|Spray)\b/i,
  )
  if (nounProseCut >= 0) s = s.slice(0, nounProseCut).trim()

  return s.replace(/[.,\s]+$/, "").trim()
}

/** Pull the accordion MAIN NOTES body; null when the marker is absent. */
const extractEtatLibreMainNotesSectionBody = (text: string): string | null => {
  const collapsed = (text ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  if (!collapsed) return null
  const m = collapsed.match(
    /\bMAIN NOTES\s*:?\s*(.+?)(?=\s+(?:Pronunciation|Customer Reviews|Ingredients|CHOOSE SIZE|Share|FULL DESCRIPTION)\b|$)/i,
  )
  if (!m?.[1]) return null
  const body = trimEtatLibreMainNotesBody(m[1])
  return body || null
}

/** Parse layered or flat materials from an Etat Libre MAIN NOTES body only. */
const extractEtatLibreAuthoritativeLayersFromBody = (body: string): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} => {
  const hasLayerLabels = /\b(?:top|open|heart|middle|base|bottom)\s*(?:notes?)?\s*:/i.test(body)
  if (hasLayerLabels) {
    const layered = extractInlineLayeredNotes(body)
    if (
      layered.openNotes.length + layered.heartNotes.length + layered.baseNotes.length >=
      1
    ) {
      return {
        openNotes: uniqueNotes(layered.openNotes),
        heartNotes: uniqueNotes(layered.heartNotes),
        baseNotes: uniqueNotes(layered.baseNotes),
      }
    }
  }
  const flat = filterStructuredNoteParts(splitNoteList(body))
  return { openNotes: uniqueNotes(flat), heartNotes: [], baseNotes: [] }
}

const extractEtatLibreAuthoritativeLayers = (
  text: string,
): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} | null => {
  const body = extractEtatLibreMainNotesSectionBody(text)
  if (!body) return null
  return extractEtatLibreAuthoritativeLayersFromBody(body)
}

/**
 * Etat Libre d'Orange accordion `MAIN NOTES` line — authoritative over FULL DESCRIPTION prose.
 * When present with enough materials, downstream parsers must not merge flat-list regex hits from story copy.
 */
const extractEtatLibreAuthoritativeMainNotes = (text: string): string[] => {
  const layers = extractEtatLibreAuthoritativeLayers(text)
  if (!layers) return []
  return uniqueNotes([...layers.openNotes, ...layers.heartNotes, ...layers.baseNotes])
}

/**
 * Detect flat "NOTES: X, Y, Z" and common PDP paraphrases (no top/heart/base breakdown).
 * Places all notes into openNotes so the LLM volatility-spreading step can redistribute them,
 * and so they're always visible even when layer structure is unknown.
 */
function extractFlatNotes(text: string): string[] {
  const source = text?.trim()
  if (!source) return []

  const collapsed = source.replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  const etatBody = extractEtatLibreMainNotesSectionBody(collapsed)
  if (etatBody) {
    const layers = extractEtatLibreAuthoritativeLayersFromBody(etatBody)
    const etatFlat = uniqueNotes([...layers.openNotes, ...layers.heartNotes, ...layers.baseNotes])
    if (etatFlat.length > 0) return etatFlat
    // Fall through when Etat Libre extraction yields nothing (e.g. space-glued Andromeda "Main Notes" block)
  }

  const matiereMaterials = uniqueNotes([
    ...extractMatierePremiereMaterialsFromPlain(collapsed),
    ...extractMatierePremiereExtraitMaterialsFromPlain(collapsed),
  ])
  if (matiereMaterials.length >= 2) return matiereMaterials

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

  const etatBody = extractEtatLibreMainNotesSectionBody(source)
  if (etatBody) {
    const etatLayers = extractEtatLibreAuthoritativeLayersFromBody(etatBody)
    const etatCount =
      etatLayers.openNotes.length + etatLayers.heartNotes.length + etatLayers.baseNotes.length
    if (etatCount >= Math.max(2, minConfidentFlatNotes)) return etatLayers
    if (etatCount > 0) return etatLayers
    // Fall through when Etat Libre extraction yields nothing (e.g. space-glued Andromeda "Main Notes")
  }

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
    const populatedLayers = [
      layeredResult.openNotes.length > 0,
      layeredResult.heartNotes.length > 0,
      layeredResult.baseNotes.length > 0,
    ].filter(Boolean).length
    // A real 2+ layer pyramid already lists materials. Do not dump marketing-prose extras into open.
    if (unlabeledMaterials.length > 0 && populatedLayers < 2) {
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
export {
  cleanTitle,
  uniqueNotes,
  dedupeNotesAcrossLayers,
  extractNotesFromStructuredText,
  extractFlatNotes,
  splitNoteList,
  stripNotesFromDescription,
  prepareMerchantNotesSource,
  truncateAtShopMetaLabels,
  isThinLayeredPyramidScrape,
  extractFullDescriptionFromHtml,
  rejectThemeJunkDominatedLayers,
  isThemeJunkDominatedLayers,
  rejectComplianceDominatedLayers,
  isPolicyOnlyMerchantDescription,
  collectMerchantTrustedNotes,
  mergeMerchantTrustedNotes,
  filterNotesByTrust,
  expandParentheticalLayers,
  finalizeNoteLayersForExport,
  isScraperKeptNote,
  looksLikeMainAccordsDescriptorList,
  stripMerchantDescriptionForStorage,
  isUsablePdpNoteBootstrap,
  resolveAndromedaDetailUrl,
  assignVolatilityLayersFromFlatOpen,
}

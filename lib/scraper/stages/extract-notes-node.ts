import { StateGraph } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"
import type { PerfumeCsvRecord, ScrapedItem, NoteInferenceMode, ScraperNoteSource } from "@/types/scraper"
import {
  buildNoteConfirmationCorpus,
  confirmNoteLayersAgainstSource,
  isNoteSubstantiatedInSource,
  isObviousNonMaterialNote,
  looksLikeProseNotePhrase,
} from "@/lib/scraper/note-source-confirmation"
import {
  ScraperState,
  type ScraperPipelineOptions,
  type ScraperStateType,
} from "@/lib/scraper/stages/pipeline-options"
import type { NotesLayers } from "@/lib/scraper/stages/notes-layers"
import { hasLayeredMerchantPyramid, noteLayerCount } from "@/lib/scraper/stages/notes-layers-utils"
import {
  augmentNotesSourceWithLabeledLists,
  hasExplicitNoteListSignal,
  isAndromedaMoonProductUrl,
  isPatternByEtsyProductUrl,
  pdpNoteBootstrapCache,
  resolveNotesSource,
  shouldAutoFetchAndromedaMoonNotes,
  shouldAutoFetchEtatLibreNotes,
  shouldAutoFetchPatternEtsyNotes,
  shouldAutoFetchWooCommerceStoreNotes,
  shouldAutoFetchShopifyProductNotes,
  tryFetchEtatLibreProductDescription,
  tryFetchPdpNoteBootstrap,
  detailUrlAlignsWithProductName,
  resolveProductName,
  relayerNotesWithEmbeddedLayerMarkers,
  hasEmbeddedLayerMarkers,
  NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE,
} from "@/lib/scraper/stages/pdp-bootstrap"
import {
  cleanTitle,
  collectMerchantTrustedNotes,
  dedupeNotesAcrossLayers,
  expandParentheticalLayers,
  extractFlatNotes,
  extractNotesFromStructuredText,
  filterNotesByTrust,
  finalizeNoteLayersForExport,
  isEtatLibreProductUrl,
  isJunkScrapedDescription,
  isPolicyOnlyMerchantDescription,
  isScraperKeptNote,
  isUnusableMerchantDescription,
  isUsablePdpNoteBootstrap,
  looksLikeMainAccordsDescriptorList,
  mergeMerchantTrustedNotes,
  normalizePdpDescription,
  prepareMerchantNotesSource,
  rejectComplianceDominatedLayers,
  rejectThemeJunkDominatedLayers,
  resolveAndromedaDetailUrl,
  sanitizeCopyForNotePipeline,
  stripMerchantDescriptionForStorage,
  stripNotesFromDescription,
  uniqueNotes,
} from "@/lib/scraper/stages/title-cleaning"
import {
  extractNotesFallbackLookup,
  extractNotesFromDescription,
  mergeExistingPythonNotes,
  mergeStructuredNotesWithLlm,
} from "@/lib/scraper/stages/llm-extraction"
import { generateNoirDescription, openingFingerprint } from "@/lib/scraper/stages/noir-description"
import { allNotesEnglish, translateNotesToEnglish } from "@/lib/scraper/stages/note-translation"
import { resolveNoteValidationMode, validateNotesWithLlm } from "@/lib/scraper/stages/note-validator"

const isShopCollectionListingScrape = (item: ScrapedItem, name: string): boolean => {
  const desc = `${item.description ?? ""}\n${item.notesText ?? ""}`.trim()
  const lower = desc.toLowerCase()
  if (/showing\s+\d+\s+of\s+\d+\s+results/i.test(lower)) return true
  if (/default sorting/i.test(lower) && (lower.match(/\badd to cart\b/g) ?? []).length >= 3) return true
  if (/^store$/i.test(name.trim()) && /\badd to cart\b/i.test(lower)) return true
  if (/<img\s+width=/i.test(desc) && /\badd to cart\b/i.test(lower) && /\$\d/.test(desc)) return true
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
const JUNK_NOTE_RESCUE_RE =
  /\b(?:scent\s+description|pastel\s+girls|gentle\s+projection|hand-blended|for\s+milk\s+lovers|tihota\s+on\s+fire|a\s+soft\s+golden|the\s+caramelized\s+warmth|(?:f|of)\s+note|notes\s+swirl|like a faceted|she replies|when the hope|becomes reality|we whisper|she pirouettes|to the poet|there is a bridge|like something|thanks to you|dear god|snatch|marquis de sade|ignite the world|infused with|lifted by|accord of coffee|unexpected accord|to wreak havoc|according to lacan|olfactory coitus|tilda swinton|victor hugo|linear-gradient|radial-gradient|rgba\s*\(|font-family|blinkmacsystemfont|system-ui)\b/i

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
  const scrapedDescriptionRaw = (() => {
    const raw = item.description ?? ""
    if (!isJunkScrapedDescription(raw)) return raw
    /**
     * Even when the main description is junk (Wix cross-sell bleed, CSS, etc.) there may be
     * labeled note lines below a paragraph break or even a single newline.
     * Try double-newline paragraph split first; fall back to single-newline line scan.
     * The stored description is cleared separately at the record-building stage.
     */
    const blocks = raw.split(/\n{2,}/)
    for (let i = 1; i < blocks.length; i++) {
      if (hasExplicitNoteListSignal(blocks[i])) {
        return blocks.slice(i).join("\n\n")
      }
    }
    const lines = raw.split(/\n/)
    for (let i = 0; i < lines.length; i++) {
      if (hasExplicitNoteListSignal(lines[i])) {
        return lines.slice(i).join("\n")
      }
    }
    return ""
  })()
  const scrapedDescriptionNormalized = scrapedDescriptionRaw
    ? normalizePdpDescription(scrapedDescriptionRaw) || scrapedDescriptionRaw
    : ""
  let pipelineItem: ScrapedItem =
    scrapedDescriptionNormalized === (item.description ?? "")
      ? item
      : { ...item, description: scrapedDescriptionNormalized }

  let detailUrl = pipelineItem.detailURL?.trim() ?? ""
  if (isAndromedaMoonProductUrl(detailUrl) || /andromeda/i.test(houseName ?? "")) {
    throwIfAborted(sig)
    detailUrl = await resolveAndromedaDetailUrl(name || resolvedName, detailUrl, sig, opts.onProgress)
  }

  if (
    isEtatLibreProductUrl(detailUrl) &&
    detailUrl.startsWith("http") &&
    isUnusableMerchantDescription(pipelineItem.description ?? "")
  ) {
    throwIfAborted(sig)
    const htmlDesc = await tryFetchEtatLibreProductDescription(detailUrl, sig, opts.onProgress)
    const currentLen = (pipelineItem.description ?? "").trim().length
    if (htmlDesc && htmlDesc.length > currentLen + 20) {
      pipelineItem = { ...pipelineItem, description: htmlDesc }
      opts.onProgress?.(
        `Notes pipeline ${index + 1}/${totalItems}: backfilled FULL DESCRIPTION from PDP HTML for ${(name || resolvedName || "product").slice(0, 48)}`,
      )
    }
  }

  let mergedBase = resolveNotesSource(pipelineItem)
  /**
   * Strip merchant policy/shipping/disclaimer boilerplate from the notes source BEFORE extraction.
   * Otherwise LLM extraction sees "Processing: AT LEAST 7 business days... no changes, no cancellations..."
   * and either gets confused or extracts shipping fragments as notes.
   */
  mergedBase = prepareMerchantNotesSource(mergedBase)

  const enrichOnlyNeedsBootstrap =
    opts.enrichOnly === true &&
    (existingFromPython == null ||
      noteLayerCount(existingFromPython) < 6 ||
      (existingFromPython.openNotes?.length ?? 0) === 0 ||
      isLikelyNoirClicheOnlyNotes(existingFromPython) ||
      hasObviousJunkExtractedNotes(existingFromPython))

  const autoPatternEtsyFetch =
    opts.enrichOnly === true
      ? enrichOnlyNeedsBootstrap && shouldAutoFetchPatternEtsyNotes(detailUrl, mergedBase)
      : shouldAutoFetchPatternEtsyNotes(detailUrl, mergedBase)
  const autoAndromedaFetch =
    opts.enrichOnly === true
      ? enrichOnlyNeedsBootstrap && shouldAutoFetchAndromedaMoonNotes(detailUrl, mergedBase)
      : shouldAutoFetchAndromedaMoonNotes(detailUrl, mergedBase)
  const autoEtatLibreFetch =
    opts.enrichOnly === true ? false : shouldAutoFetchEtatLibreNotes(detailUrl, mergedBase)
  /** Etat Libre MAIN NOTES bootstrap — not gated on enrichOnly (Python prose notes still need PDP). */
  const needsEtatLibreMainNotesBootstrap =
    isEtatLibreProductUrl(detailUrl) && shouldAutoFetchEtatLibreNotes(detailUrl, mergedBase)
  const isArtisticFragrancesMilanoPdp = (url: string): boolean =>
    /artisticfragrances\.com/i.test(url) && /\/milano-fragranze\/[^/]+/i.test(url)

  const artisticFragrancesThinPython =
    opts.enrichOnly === true &&
    isArtisticFragrancesMilanoPdp(detailUrl) &&
    (existingFromPython == null ||
      noteLayerCount(existingFromPython) < 6 ||
      (existingFromPython.openNotes?.length ?? 0) === 0)

  const autoWooStoreFetch =
    artisticFragrancesThinPython ||
    (opts.enrichOnly === true
      ? enrichOnlyNeedsBootstrap && shouldAutoFetchWooCommerceStoreNotes(detailUrl, mergedBase)
      : shouldAutoFetchWooCommerceStoreNotes(detailUrl, mergedBase))
  const autoShopifyFetch =
    opts.enrichOnly === true
      ? enrichOnlyNeedsBootstrap && shouldAutoFetchShopifyProductNotes(detailUrl, mergedBase)
      : shouldAutoFetchShopifyProductNotes(detailUrl, mergedBase)
  const shouldFetchAndromedaBootstrap =
    isAndromedaMoonProductUrl(detailUrl) && opts.fetchPdpNoteBootstrap === true
  if (
    (shouldFetchAndromedaBootstrap ||
      opts.fetchPdpNoteBootstrap === true ||
      autoPatternEtsyFetch ||
      autoAndromedaFetch ||
      autoEtatLibreFetch ||
      needsEtatLibreMainNotesBootstrap ||
      autoWooStoreFetch ||
      autoShopifyFetch) &&
    (shouldFetchAndromedaBootstrap ||
      opts.fetchPdpNoteBootstrap === true ||
      !hasExplicitNoteListSignal(mergedBase) ||
      autoWooStoreFetch ||
      autoShopifyFetch ||
      needsEtatLibreMainNotesBootstrap) &&
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
  const pythonHasMerchantPyramid =
    opts.enrichOnly === true &&
    existingFromPython != null &&
    noteLayerCount(existingFromPython) >= 4 &&
    typeof item._noteSource === "string" &&
    (/text_regex_layered|html_(?:heading|strong)_layers/.test(item._noteSource)
      ? existingFromPython.openNotes.length > 0 &&
        existingFromPython.heartNotes.length > 0 &&
        existingFromPython.baseNotes.length > 0 &&
        noteLayerCount(existingFromPython) >= 6
      : // Damask / Wix flat "Notes: a, b, c" — keep Python materials; don't re-LLM into empty/junk.
        /(text_regex_flat|html_flat)/.test(item._noteSource) &&
        existingFromPython.openNotes.length >= 4)

  try {
    let notes: NotesLayers
    let merchantTrustedNotes: Set<string>
    let initialStructuredNoteCount: number
    let usedDescPathLlm = false
    let usedNameOnlyPath = false
    let usedFallbackLookup = false
    let pdpRescueApplied = false

    if (pythonHasMerchantPyramid && existingFromPython) {
      notes = dedupeNotesAcrossLayers({
        openNotes: uniqueNotes(existingFromPython.openNotes),
        heartNotes: uniqueNotes(existingFromPython.heartNotes),
        baseNotes: uniqueNotes(existingFromPython.baseNotes),
      })
      merchantTrustedNotes = new Set(
        [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes].map(n => n.trim().toLowerCase()),
      )
      initialStructuredNoteCount = noteLayerCount(notes)
    } else {
    const flatAuthEarly = extractFlatNotes(notesSource)
    notes = extractNotesFromStructuredText(notesSource, minFlat)
    merchantTrustedNotes = collectMerchantTrustedNotes(notes, notesSource)

    initialStructuredNoteCount = noteLayerCount(notes)

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

    const enrichOnlyEtatLibreJunkPython =
      opts.enrichOnly === true &&
      existingFromPython != null &&
      noteLayerCount(existingFromPython) > 0 &&
      (hasObviousJunkExtractedNotes(existingFromPython) ||
        hasWeakNoteSubstantiation(existingFromPython, notesSource))

    if (
      (usedDescPathLlm ||
        usedNameOnlyPath ||
        enrichOnlyEtatLibreJunkPython ||
        hasObviousJunkExtractedNotes(notes) ||
        (noteLayerCount(notes) > 0 && hasWeakNoteSubstantiation(notes, notesSource))) &&
      isEtatLibreProductUrl(detailUrl) &&
      detailUrl.startsWith("http") &&
      !pdpRescueApplied
    ) {
      throwIfAborted(sig)
      pdpNoteBootstrapCache.delete(detailUrl)
      const boot = await tryFetchPdpNoteBootstrap(detailUrl, sig, opts.onProgress)
      if (boot) {
        const rescueSource = augmentNotesSourceWithLabeledLists(`${boot}\n\n${mergedBase}`)
        const rescued = extractNotesFromStructuredText(rescueSource, minFlat)
        if (
          noteLayerCount(rescued) > 0 &&
          (noteLayerCount(rescued) > noteLayerCount(notes) ||
            enrichOnlyEtatLibreJunkPython ||
            hasObviousJunkExtractedNotes(notes) ||
            hasWeakNoteSubstantiation(notes, notesSource))
        ) {
          notes = rescued
          mergeMerchantTrustedNotes(merchantTrustedNotes, rescued)
          usedDescPathLlm = false
          usedNameOnlyPath = false
          pdpRescueApplied = true
          opts.onProgress?.(
            `Notes pipeline ${index + 1}/${totalItems}: replaced notes with Etat Libre MAIN NOTES from PDP for ${(name || resolvedName || "product").slice(0, 48)}`,
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
      // Keep flat merchant lists in openNotes — do not invent Heart/Base via volatility.
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

    notes = mergeExistingPythonNotes(notes, existingFromPython, notesSource, opts.enrichOnly === true)

    if (hasEmbeddedLayerMarkers(notes)) {
      notes = relayerNotesWithEmbeddedLayerMarkers(notes)
    }

    notes = confirmNoteLayersAgainstSource(notes, notesSource, {
      merchantTrusted: merchantTrustedNotes,
    })

    /**
     * LLM-derived notes must be substantiated in the merchant's own labeled note block when one
     * exists. Confirmation against notesSource alone is not enough: polluted DOM text ("Opens in
     * a new window.") and description prose ("laced with vanilla") both live in notesSource, so
     * junk like "window" / "laced" would be "confirmed" there. The labeled Head/Heart/Base (or
     * MAIN NOTES / Notes:) block is the authority for what counts as a note.
     */
    const merchantLabeledBlock = item.merchantNotesText?.trim() || ""
    if (
      (usedDescPathLlm || usedNameOnlyPath) &&
      merchantLabeledBlock &&
      (/\b(?:head|top|opening|heart|middle|mid|core|base)\s*(?:notes?)?\s*:/i.test(merchantLabeledBlock) ||
        /\b(?:main\s+)?notes?\s*:/i.test(merchantLabeledBlock))
    ) {
      const keepIfMerchantSubstantiated = (arr: string[]) =>
        arr.filter(n => {
          const lc = n.trim().toLowerCase()
          if (merchantTrustedNotes.has(lc)) return true
          return isNoteSubstantiatedInSource(n, "", merchantLabeledBlock)
        })
      const filtered = {
        openNotes: keepIfMerchantSubstantiated(notes.openNotes),
        heartNotes: keepIfMerchantSubstantiated(notes.heartNotes),
        baseNotes: keepIfMerchantSubstantiated(notes.baseNotes),
      }
      // Only apply when something survives — an empty result means the merchant block and the
      // LLM disagree entirely (e.g. translated notes) and dropping everything helps nobody.
      if (noteLayerCount(filtered) > 0) notes = filtered
    }

    merchantTrustedNotes = collectMerchantTrustedNotes(notes, notesSource)
    notes = {
      openNotes: filterNotesByTrust(notes.openNotes, merchantTrustedNotes),
      heartNotes: filterNotesByTrust(notes.heartNotes, merchantTrustedNotes),
      baseNotes: filterNotesByTrust(notes.baseNotes, merchantTrustedNotes),
    }
    notes = dedupeNotesAcrossLayers(notes)
    } // end standard extraction path (not pythonHasMerchantPyramid)

    if (!pythonHasMerchantPyramid) {
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
    } // end !pythonHasMerchantPyramid rescue path

    /**
     * Guaranteed name + theme inference — runs AFTER the junk filter so a regex extraction whose
     * candidates all fail isScraperKeptNote (e.g. layered list of single-letter placeholders, or
     * noise that survived earlier stages) still ends up with real notes. Skipped in strict mode.
     */
    if (!pythonHasMerchantPyramid && noteLayerCount(notes) === 0) {
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

    notes = rejectThemeJunkDominatedLayers(notes)
    notes = rejectComplianceDominatedLayers(notes)
    notes = finalizeNoteLayersForExport(notes, merchantTrustedNotes)

    const resolveNoteSource = (): ScraperNoteSource => {
      if (pythonHasMerchantPyramid && typeof item._noteSource === "string") {
        return item._noteSource as ScraperNoteSource
      }
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
    descriptionForRecord = normalizePdpDescription(descriptionForRecord) || descriptionForRecord
    if (isJunkScrapedDescription(descriptionForRecord)) descriptionForRecord = ""
    /**
     * Drop merchant policy/shipping/disclaimer trail from the stored description, and wipe entirely
     * when the remaining narrative is too short (boilerplate-only PDPs like Andromedas' "Love Don't
     * Be Shy" where the merchant copy is all ORIGINAL MANUFACTURERS PICTURES / ingredients lists /
     * no-changes-no-refunds). With notes present, noir generation later replaces the empty string.
     */
    if (descriptionForRecord) {
      if (
        isPolicyOnlyMerchantDescription(descriptionForRecord) ||
        isUnusableMerchantDescription(descriptionForRecord)
      ) {
        descriptionForRecord = ""
      } else {
        descriptionForRecord = stripMerchantDescriptionForStorage(descriptionForRecord)
      }
    }

    const merchantNotesText = (() => {
      const fromItem = item.merchantNotesText?.trim() || item.notesText?.trim() || ""
      if (
        fromItem &&
        (/\b(?:head|top|opening|heart|middle|base)\s+notes?\s*:/i.test(fromItem) ||
          /\bMAIN NOTES\b/i.test(fromItem))
      ) {
        return fromItem.slice(0, 8000)
      }
      if (
        /\b(?:head|top|opening)\s+notes?\s*:/i.test(notesSource) &&
        /\b(?:heart|middle|mid|core)\s+notes?\s*:/i.test(notesSource) &&
        /\bbase\s+notes?\s*:/i.test(notesSource)
      ) {
        return notesSource.slice(0, 8000)
      }
      if (/\bMAIN NOTES\b/i.test(notesSource)) {
        return notesSource.slice(0, 8000)
      }
      return fromItem.slice(0, 8000) || undefined
    })()

    const record: PerfumeCsvRecord = {
      name,
      description: descriptionForRecord,
      image: item.image,
      perfumeHouse: item.perfumeHouse ?? houseName,
      openNotes: JSON.stringify(notes.openNotes),
      heartNotes: JSON.stringify(notes.heartNotes),
      baseNotes: JSON.stringify(notes.baseNotes),
      detailURL: detailUrl || item.detailURL,
      merchantNotesText,
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
      if (isShopCollectionListingScrape(state.items[idx], p.record.name)) {
        opts.onProgress?.(
          `Notes pipeline: omitted shop/collection listing row "${p.record.name.slice(0, 48)}"`,
        )
        continue
      }
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
      const detailUrl = (p.record.detailURL || "").split("?")[0]?.split("#")[0]?.trim() ?? ""
      /** Empty URL is OK (e.g. refresh-house-notes from DB). Block only bad/mismatched scraper PDPs. */
      const hasBlockingProductUrl =
        detailUrl.length > 0 &&
        (NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE.test(detailUrl) ||
          !detailUrlAlignsWithProductName(p.name, detailUrl))
      const shouldRunNoir =
        opts.generateNoirDescriptions &&
        noirLlm &&
        !hasBlockingProductUrl &&
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
          if (hasBlockingProductUrl) {
            opts.onProgress?.(
              `Notes pipeline: skipped noir for "${p.name.slice(0, 60)}" — product URL is non-perfume or does not match the name.`,
            )
          } else if (totalNotes === 0) {
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
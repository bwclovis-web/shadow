import {
  isComplianceOrSourcingNote,
  isObviousNonMaterialNote,
  isThemeCssTokenNote,
  looksLikeProseNotePhrase,
} from "@/lib/scraper/note-source-confirmation"
import {
  detailUrlAlignsWithProductName,
  isEtatLibreProductUrl,
  isPatternByEtsyProductUrl,
  isUnusableMerchantDescription,
} from "@/lib/scraper/notes-graph"
import type { PerfumeCsvRecord, ScrapedItem, ScraperNoteSource } from "@/types/scraper"

const NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE =
  /\/products\/(?:fragrance-sampler|gift-card|sample-pack|coupon|wish-list|file-claim|join-our-newsletter)/i

const isJunkScrapedDescriptionForRepair = (text: string | undefined): boolean => {
  const t = text?.trim() ?? ""
  if (!t) return false
  return (
    /\bfragrance\s+sampler\b/i.test(t) ||
    /\bfour\s+piece,\s*glass,\s*5\s*ml\b/i.test(t) ||
    /\bplease\s+pick\s+6-8\s+choices\b/i.test(t) ||
    /\border\s+special\s+instructions\s+box\b/i.test(t) ||
    /^interested in trying a sample\?/i.test(t) ||
    (/\btry in a 4 piece sample kit\b/i.test(t) && t.length < 520) ||
    /\bfull des(?:crip(?:tion)?)?\s*$/i.test(t)
  )
}

/** Map Python scraper output to admin preview records (includes QA fields). */
export const mapScrapedItemsToRecords = (
  items: ScrapedItem[],
  houseName: string,
): PerfumeCsvRecord[] =>
  items.map(item => ({
    name: item.name,
    description: item.noirDescription || item.description,
    image: item.image,
    perfumeHouse: item.perfumeHouse ?? houseName,
    openNotes: JSON.stringify(item.openNotes ?? []),
    heartNotes: JSON.stringify(item.heartNotes ?? []),
    baseNotes: JSON.stringify(item.baseNotes ?? []),
    detailURL: item.detailURL,
    merchantNotesText: item.merchantNotesText?.trim() || item.notesText?.trim() || undefined,
    _noteSource: item._noteSource as ScraperNoteSource | undefined,
    noteConfidence: item.noteConfidence,
    noteWarnings: item.noteWarnings,
    qualityScore: item.qualityScore,
    qualityIssues: item.qualityIssues,
    importBucket: item.importBucket,
    externalNoteCandidates: item.externalNoteCandidates,
    duplicateRisk: item.duplicateRisk,
    imageMigrationFailed: item.imageMigrationFailed,
  }))

/** True when Python post-process ran (notes pipeline + quality gate). */
export const pythonPipelineComplete = (items: ScrapedItem[]): boolean =>
  items.length > 0 &&
  (Array.isArray(items[0].openNotes) ||
    items[0].noteConfidence !== undefined ||
    items[0].qualityScore !== undefined)

/** Total note count across all layers on a scraped item. */
export const scrapedItemNoteCount = (item: ScrapedItem): number =>
  (item.openNotes?.length ?? 0) + (item.heartNotes?.length ?? 0) + (item.baseNotes?.length ?? 0)

/** True when `_noteSource` indicates a labeled merchant pyramid / HTML layers. */
export const merchantNoteSource = (source: string | undefined): boolean => {
  const s = (source ?? "").toLowerCase()
  return (
    s.includes("text_regex_layered") ||
    s.startsWith("html_") ||
    s.includes("html_") ||
    s === "labeled_list"
  )
}

const itemHasProseJunkNotes = (item: ScrapedItem): boolean => {
  const allNotes = [
    ...(item.openNotes ?? []),
    ...(item.heartNotes ?? []),
    ...(item.baseNotes ?? []),
  ]
  if (allNotes.length === 0) return false
  const junkCount = allNotes.filter(
    n => looksLikeProseNotePhrase(n) || isObviousNonMaterialNote(n) || isThemeCssTokenNote(n),
  ).length
  return junkCount >= Math.max(1, Math.ceil(allNotes.length * 0.25))
}

/**
 * Python extracted a full merchant pyramid that is safe to skip Node for.
 * Completeness alone is not enough — reject junk notes, empty open, URL mismatch, etc.
 */
export const pythonMerchantNotesComplete = (items: ScrapedItem[]): boolean =>
  items.length > 0 &&
  items.every(item => {
    const count = scrapedItemNoteCount(item)
    if (count < 6) return false
    if (!merchantNoteSource(item._noteSource)) return false
    const open = (item.openNotes?.length ?? 0) > 0
    const heart = (item.heartNotes?.length ?? 0) > 0
    const base = (item.baseNotes?.length ?? 0) > 0
    if (!open || !heart || !base) return false

    if (itemHasProseJunkNotes(item)) return false

    const url = item.detailURL ?? ""
    const name = item.name ?? ""
    if (url && name && !detailUrlAlignsWithProductName(name, url)) return false
    if (NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE.test(url)) return false

    if (isArtisticFragrancesProductUrl(url) && (item.openNotes?.length ?? 0) === 0) return false

    const desc = item.description?.trim() ?? ""
    const notesText = item.notesText?.trim() ?? ""
    if (
      (isJunkScrapedDescriptionForRepair(desc) || isUnusableMerchantDescription(desc)) &&
      !notesText
    ) {
      return false
    }

    return true
  })

/** True when Python already parsed the on-page Head/Heart/Base pyramid — Node must not relayer. */
export const pythonMerchantPyramidTrusted = (items: ScrapedItem[]): boolean =>
  items.some(
    item =>
      merchantNoteSource(item._noteSource) &&
      (item.openNotes?.length ?? 0) > 0 &&
      (item.heartNotes?.length ?? 0) > 0 &&
      (item.baseNotes?.length ?? 0) > 0 &&
      scrapedItemNoteCount(item) >= 6,
  )

const isArtisticFragrancesProductUrl = (detailURL: string): boolean => {
  try {
    return /artisticfragrances\.com/i.test(detailURL) && /\/milano-fragranze\/[^/]+/i.test(detailURL)
  } catch {
    return false
  }
}

/** Entire scrape batch is Milano Fragranze on Artistic Fragrances (browser PDP pyramid only). */
export const scrapedItemsAreArtisticMilanoFragranzeHouse = (items: ScrapedItem[]): boolean =>
  items.length > 0 && items.every(item => isArtisticFragrancesProductUrl(item.detailURL ?? ""))

const GENERIC_NOIR_SCRAPED_NOTES = new Set([
  "bergamot",
  "jasmine",
  "rose",
  "musk",
  "amber",
  "cedar",
  "lemon",
  "oud",
])

const looksLikeGenericNoirScrapedNotes = (item: ScrapedItem): boolean => {
  const all = [...(item.openNotes ?? []), ...(item.heartNotes ?? []), ...(item.baseNotes ?? [])]
    .map(n => n.trim().toLowerCase())
    .filter(Boolean)
  if (all.length === 0 || all.length > 8) return false
  const genericHits = all.filter(n => GENERIC_NOIR_SCRAPED_NOTES.has(n)).length
  return genericHits >= Math.max(2, Math.ceil(all.length * 0.6))
}

/** Milano Fragranze: WebDriver redirect + thin noir cliché notes need PDP HTML bootstrap. */
export const scrapedItemsNeedArtisticFragrancesRepair = (items: ScrapedItem[]): boolean =>
  items.some(item => {
    if (!isArtisticFragrancesProductUrl(item.detailURL ?? "")) return false
    if (
      merchantNoteSource(item._noteSource) &&
      (item.openNotes?.length ?? 0) > 0 &&
      (item.heartNotes?.length ?? 0) > 0 &&
      (item.baseNotes?.length ?? 0) > 0 &&
      scrapedItemNoteCount(item) >= 6
    ) {
      return false
    }
    if ((item.openNotes?.length ?? 0) === 0) return true
    if (scrapedItemNoteCount(item) < 6) return true
    if (looksLikeGenericNoirScrapedNotes(item)) return true
    if (!merchantNoteSource(item._noteSource)) return true
    return false
  })

/**
 * Pattern/Etsy listings with thin accord-only pyramids benefit from the Node enrichment pass
 * even when Python already populated notes.
 */
export const scrapedItemsNeedPatternEtsyEnrichment = (items: ScrapedItem[]): boolean =>
  items.some(
    item => isPatternByEtsyProductUrl(item.detailURL ?? "") && scrapedItemNoteCount(item) <= 6,
  )

const hasProseJunkScrapedNote = (note: string): boolean => {
  const t = note.trim()
  if (!t) return true
  return looksLikeProseNotePhrase(t) || isObviousNonMaterialNote(t)
}

/**
 * Etat Libre Python scrapes often keep FULL DESCRIPTION prose as notes ("she", "notes swirl")
 * while omitting accordion MAIN NOTES — Node must re-run even when Python populated layers.
 */
export const scrapedItemsNeedEtatLibreEnrichment = (items: ScrapedItem[]): boolean =>
  items.some(item => {
    if (!isEtatLibreProductUrl(item.detailURL ?? "")) return false
    const allNotes = [
      ...(item.openNotes ?? []),
      ...(item.heartNotes ?? []),
      ...(item.baseNotes ?? []),
    ]
    if (allNotes.length === 0) return true
    return allNotes.some(hasProseJunkScrapedNote)
  })

/** Re-run Node enrichment when Python output still has compliance notes, junk URLs, or sampler bleed. */
export const scrapedItemsNeedNodeRepair = (items: ScrapedItem[]): boolean =>
  items.some(item => {
    const url = item.detailURL ?? ""
    const name = item.name ?? ""
    if (NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE.test(url)) return true
    if (url && name && !detailUrlAlignsWithProductName(name, url)) return true
    if (isJunkScrapedDescriptionForRepair(item.description)) return true
    if (isUnusableMerchantDescription(item.description)) return true

    const allNotes = [
      ...(item.openNotes ?? []),
      ...(item.heartNotes ?? []),
      ...(item.baseNotes ?? []),
    ]
    if (allNotes.some(n => isThemeCssTokenNote(n))) return true
    if (allNotes.length === 0) return false
    const complianceCount = allNotes.filter(n => isComplianceOrSourcingNote(n)).length
    if (complianceCount >= 2 && complianceCount >= allNotes.length * 0.5) return true
    return allNotes.some(n => isComplianceOrSourcingNote(n))
  })

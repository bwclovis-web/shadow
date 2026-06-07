import { isComplianceOrSourcingNote, isThemeCssTokenNote } from "@/lib/scraper/note-source-confirmation"
import { detailUrlAlignsWithProductName, isPatternByEtsyProductUrl, isUnusableMerchantDescription } from "@/lib/scraper/notes-graph"
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

/**
 * Pattern/Etsy listings with thin accord-only pyramids benefit from the Node enrichment pass
 * even when Python already populated notes.
 */
export const scrapedItemsNeedPatternEtsyEnrichment = (items: ScrapedItem[]): boolean =>
  items.some(
    item => isPatternByEtsyProductUrl(item.detailURL ?? "") && scrapedItemNoteCount(item) <= 6,
  )

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

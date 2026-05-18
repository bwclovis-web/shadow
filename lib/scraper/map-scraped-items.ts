import { isPatternByEtsyProductUrl } from "@/lib/scraper/notes-graph"
import type { PerfumeCsvRecord, ScrapedItem, ScraperNoteSource } from "@/types/scraper"

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

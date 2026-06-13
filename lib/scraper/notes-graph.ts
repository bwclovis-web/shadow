/**
 * LangGraph note-extraction pipeline — public facade.
 * Stage implementations live in `stages/*`.
 */

export type { ScraperPipelineOptions } from "@/lib/scraper/stages/pipeline-options"

export {
  isPatternByEtsyProductUrl,
  isAndromedaMoonProductUrl,
  detailUrlAlignsWithProductName,
} from "@/lib/scraper/stages/pdp-bootstrap"

export {
  sanitizeCopyForNotePipeline,
  isEtatLibreProductUrl,
  stripEtatLibreUiNoise,
  isUnusableMerchantDescription,
  normalizePdpDescription,
  extractNotesFromStructuredText,
} from "@/lib/scraper/stages/title-cleaning"

export {
  mergeFlatMaterialsIntoLayeredPyramid,
  computeBatchNoteUniformityWarnings,
  extractNotesForItems,
} from "@/lib/scraper/stages/extract-notes-node"

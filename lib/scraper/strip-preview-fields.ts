import type { PerfumeCsvRecord } from "@/types/scraper"

/** Fields used only in admin preview — omitted before DB import. */
const PREVIEW_ONLY_KEYS = [
  "_noteSource",
  "noteConfidence",
  "noteWarnings",
  "qualityScore",
  "qualityIssues",
  "importBucket",
  "externalNoteCandidates",
  "duplicateRisk",
  "duplicateMatches",
  "imageMigrationFailed",
] as const

/** Strip QA/preview metadata before persisting to Postgres. */
export const stripPreviewFields = (record: PerfumeCsvRecord): PerfumeCsvRecord => {
  const out = { ...record }
  for (const key of PREVIEW_ONLY_KEYS) {
    delete (out as Record<string, unknown>)[key]
  }
  return out
}

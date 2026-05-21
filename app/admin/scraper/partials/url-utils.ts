import type { PerfumeCsvRecord } from "@/types/scraper"

export const summarizeCollectionUrlsInput = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = trimmed.split(/\n|,/).map(u => u.trim()).filter(Boolean)
  const valid = parsed.filter(u => /^https?:\/\//i.test(u))
  if (valid.length === 0) {
    return "No valid URLs — each line or segment must start with http:// or https://"
  }
  if (valid.length < parsed.length) {
    return `${valid.length} collection URL(s) (${parsed.length - valid.length} line(s) skipped — not valid URLs)`
  }
  return `${valid.length} collection URL(s) — all will be visited`
}

export const countRecordsWithExtractedNotes = (records: PerfumeCsvRecord[]): number =>
  records.filter(r => {
    try {
      return (JSON.parse(r.openNotes ?? "[]") as string[]).length > 0
    } catch {
      return false
    }
  }).length

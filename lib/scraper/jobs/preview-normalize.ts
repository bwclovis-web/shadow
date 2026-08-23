import type { PerfumeCsvRecord } from "@/types/scraper"

/** Serialize extracted records to CSV text for download/preview. */
export const recordsToCsv = (records: PerfumeCsvRecord[]): string => {
  const headers = [
    "name",
    "description",
    "image",
    "perfumeHouse",
    "openNotes",
    "heartNotes",
    "baseNotes",
    "detailURL",
  ]
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = records.map(r =>
    [
      escape(r.name),
      escape(r.description),
      escape(r.image),
      escape(r.perfumeHouse),
      escape(r.openNotes),
      escape(r.heartNotes),
      escape(r.baseNotes),
      escape(r.detailURL),
    ].join(",")
  )
  return [headers.join(","), ...rows].join("\n")
}

const normalizePreviewName = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, " ").trim()

const normalizePreviewDetailUrl = (value: string): string =>
  value.trim().toLowerCase().replace(/\/+$/, "")

const NON_PERFUME_PRODUCT_URL_RE =
  /\/products\/(?:fragrance-sampler|sample-pack|coupon|wish-list|file-claim)|\/products\/[^/]*(?:gift-?card|wax-warmers?|wax-melts?|oopsie)/i

const safeJsonArrayCount = (value: string): number => {
  if (!value?.trim()) return 0
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

const scorePreviewRecordCompleteness = (record: PerfumeCsvRecord): number => {
  const openCount = safeJsonArrayCount(record.openNotes)
  const heartCount = safeJsonArrayCount(record.heartNotes)
  const baseCount = safeJsonArrayCount(record.baseNotes)
  const descScore = record.description?.trim() ? 10 : 0
  const imageScore = record.image?.trim() ? 10 : 0
  const detailUrl = record.detailURL ?? ""
  const urlPenalty = NON_PERFUME_PRODUCT_URL_RE.test(detailUrl) ? -50 : 0
  const contentPagePenalty = /\/pages\//i.test(detailUrl) ? -40 : 0
  return openCount + heartCount + baseCount + descScore + imageScore + urlPenalty + contentPagePenalty
}

export const dedupePreviewRecords = (
  records: PerfumeCsvRecord[]
): { records: PerfumeCsvRecord[]; warnings: string[] } => {
  const byKey = new Map<string, PerfumeCsvRecord>()
  const dropped: Array<{ key: string; kept: string; removed: string }> = []

  for (const record of records) {
    const house = (record.perfumeHouse ?? "").trim().toLowerCase()
    const name = normalizePreviewName(record.name ?? "")
    const detailUrl = normalizePreviewDetailUrl(record.detailURL ?? "")
    const image = (record.image ?? "").trim().toLowerCase()
    const keys = [
      detailUrl ? `url:${detailUrl}` : "",
      house && name ? `name:${house}|${name}` : "",
      house && name && image ? `name-image:${house}|${name}|${image}` : "",
    ].filter(Boolean)

    if (keys.length === 0) {
      byKey.set(`idx:${byKey.size}`, record)
      continue
    }

    let existingKey: string | null = null
    let existingRecord: PerfumeCsvRecord | undefined
    for (const key of keys) {
      const found = byKey.get(key)
      if (found) {
        existingKey = key
        existingRecord = found
        break
      }
    }

    if (!existingRecord || !existingKey) {
      for (const key of keys) byKey.set(key, record)
      continue
    }

    const existingScore = scorePreviewRecordCompleteness(existingRecord)
    const nextScore = scorePreviewRecordCompleteness(record)
    const keepNew = nextScore > existingScore
    const kept = keepNew ? record : existingRecord
    const removed = keepNew ? existingRecord : record
    for (const key of keys) byKey.set(key, kept)
    dropped.push({
      key: existingKey,
      kept: kept.name,
      removed: removed.name,
    })
  }

  const uniqueRecords = Array.from(new Set(byKey.values()))
  const warnings = dropped.length
    ? [
        `Removed ${dropped.length} duplicate preview row(s) by URL/name match before CSV export.`,
        ...dropped.slice(0, 3).map(d => `Deduped "${d.removed}" into "${d.kept}" (${d.key}).`),
      ]
    : []

  return { records: uniqueRecords, warnings }
}

const parseNoteJsonArray = (value: string): string[] => {
  if (!value?.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(v => String(v).trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export const normalizeRecordNotes = (
  record: PerfumeCsvRecord
): { record: PerfumeCsvRecord; removedCount: number } => {
  const open = parseNoteJsonArray(record.openNotes)
  const heart = parseNoteJsonArray(record.heartNotes)
  const base = parseNoteJsonArray(record.baseNotes)

  const dedupeLayer = (arr: string[]): string[] => {
    const seen = new Set<string>()
    return arr.filter(note => {
      const key = note.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const openDeduped = dedupeLayer(open)
  const heartDeduped = dedupeLayer(heart)
  const baseDeduped = dedupeLayer(base)
  const before = open.length + heart.length + base.length
  const after = openDeduped.length + heartDeduped.length + baseDeduped.length

  return {
    record: {
      ...record,
      openNotes: JSON.stringify(openDeduped),
      heartNotes: JSON.stringify(heartDeduped),
      baseNotes: JSON.stringify(baseDeduped),
    },
    removedCount: Math.max(0, before - after),
  }
}

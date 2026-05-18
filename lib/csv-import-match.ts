/**
 * CSV import catalog matching — types, thresholds, and pure scoring helpers.
 * Used by POST /api/csv-import/match and client preview UI.
 */

import { CSV_IMPORT_MAX_ROWS } from "@/lib/csv-import-user"

export const CONFIDENT_THRESHOLD = 0.92
export const UNCERTAIN_THRESHOLD = 0.65

export const CSV_MATCH_MAX_ALTERNATIVES = 3

export type MatchBucket = "confident" | "uncertain" | "noMatch"

export type PerfumeCandidate = {
  perfumeId: string
  name: string
  houseName: string
  similarity: number
}

export type CsvMatchedRow = {
  rowIndex: number
  bucket: MatchBucket
  /** Best candidate for confident / uncertain rows */
  match: PerfumeCandidate | null
  alternatives: PerfumeCandidate[]
}

export type CsvMatchInputRow = {
  rowIndex: number
  perfumeName: string
  house: string
}

export type CatalogPerfume = {
  id: string
  name: string
  houseName: string
}

export type CsvMatchRequestBody = {
  rows: CsvMatchInputRow[]
  _csrf?: string
}

export type CsvMatchResponseBody = {
  success: true
  matches: CsvMatchedRow[]
}

export const normalizeForMatch = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s*-\s*[^-]+$/i, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\d+\.?\d*\s*(ml|fl\s*oz|oz|g)\b/gi, "")
    .replace(/\b(eau de toilette|eau de parfum|edt|edp|parfum|extrait)\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/** Token overlap ratio (same algorithm as lib/scraper/duplicate-review.ts). */
export const tokenSimilarity = (a: string, b: string): number => {
  if (!a || !b) return 0
  if (a === b) return 1
  const ta = new Set(a.split(/\s+/).filter(Boolean))
  const tb = new Set(b.split(/\s+/).filter(Boolean))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) {
    if (tb.has(t)) inter++
  }
  return inter / Math.max(ta.size, tb.size)
}

const normalizeHouseKey = (house: string): string => house.trim().toLowerCase()

export const isExactCatalogMatch = (
  perfumeName: string,
  house: string,
  catalog: CatalogPerfume
): boolean => {
  const nameMatch =
    perfumeName.trim().toLowerCase() === catalog.name.trim().toLowerCase()
  if (!house.trim()) return nameMatch
  return (
    nameMatch && normalizeHouseKey(house) === normalizeHouseKey(catalog.houseName)
  )
}

const filterCatalogForRow = (
  row: CsvMatchInputRow,
  catalog: CatalogPerfume[]
): CatalogPerfume[] => {
  const house = row.house.trim()
  if (!house) return catalog
  const key = normalizeHouseKey(house)
  return catalog.filter(p => normalizeHouseKey(p.houseName) === key)
}

export const scoreRowAgainstCatalog = (
  row: CsvMatchInputRow,
  catalog: CatalogPerfume[]
): CsvMatchedRow => {
  const perfumeName = row.perfumeName.trim()
  if (!perfumeName) {
    return {
      rowIndex: row.rowIndex,
      bucket: "noMatch",
      match: null,
      alternatives: [],
    }
  }

  const candidates = filterCatalogForRow(row, catalog)
  const normName = normalizeForMatch(perfumeName)
  const house = row.house.trim()

  for (const p of candidates) {
    if (isExactCatalogMatch(perfumeName, house, p)) {
      const exact: PerfumeCandidate = {
        perfumeId: p.id,
        name: p.name,
        houseName: p.houseName,
        similarity: 1,
      }
      return {
        rowIndex: row.rowIndex,
        bucket: "confident",
        match: exact,
        alternatives: [],
      }
    }
  }

  const scored: PerfumeCandidate[] = []
  for (const p of candidates) {
    const sim = tokenSimilarity(normName, normalizeForMatch(p.name))
    if (sim >= UNCERTAIN_THRESHOLD) {
      scored.push({
        perfumeId: p.id,
        name: p.name,
        houseName: p.houseName,
        similarity: sim,
      })
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity)

  if (scored.length === 0) {
    return {
      rowIndex: row.rowIndex,
      bucket: "noMatch",
      match: null,
      alternatives: [],
    }
  }

  const best = scored[0]!
  const alternatives = scored.slice(1, 1 + CSV_MATCH_MAX_ALTERNATIVES)
  const bucket: MatchBucket =
    best.similarity >= CONFIDENT_THRESHOLD ? "confident" : "uncertain"

  return {
    rowIndex: row.rowIndex,
    bucket,
    match: best,
    alternatives,
  }
}

export const matchCsvRowsAgainstCatalog = (
  rows: CsvMatchInputRow[],
  houseScopedCatalog: CatalogPerfume[],
  nameScopedCatalog: CatalogPerfume[]
): CsvMatchedRow[] =>
  rows.map(row => {
    const catalog = row.house.trim() ? houseScopedCatalog : nameScopedCatalog
    return scoreRowAgainstCatalog(row, catalog)
  })

export const parseCsvMatchRequestRows = (
  raw: unknown
): { rows: CsvMatchInputRow[] } | { error: string } => {
  if (!raw || typeof raw !== "object" || !("rows" in raw)) {
    return { error: "Invalid request body" }
  }
  const { rows } = raw as { rows: unknown }
  if (!Array.isArray(rows)) {
    return { error: "rows must be an array" }
  }
  if (rows.length === 0) {
    return { error: "rows must not be empty" }
  }
  if (rows.length > CSV_IMPORT_MAX_ROWS) {
    return { error: `At most ${CSV_IMPORT_MAX_ROWS} rows allowed` }
  }

  const parsed: CsvMatchInputRow[] = []
  for (const item of rows) {
    if (!item || typeof item !== "object") {
      return { error: "Each row must be an object" }
    }
    const row = item as Record<string, unknown>
    const rowIndex = row.rowIndex
    const perfumeName = row.perfumeName
    const house = row.house
    if (typeof rowIndex !== "number" || !Number.isFinite(rowIndex)) {
      return { error: "rowIndex must be a number" }
    }
    if (typeof perfumeName !== "string") {
      return { error: "perfumeName must be a string" }
    }
    if (house !== undefined && house !== null && typeof house !== "string") {
      return { error: "house must be a string" }
    }
    parsed.push({
      rowIndex: Math.floor(rowIndex),
      perfumeName,
      house: typeof house === "string" ? house : "",
    })
  }

  return { rows: parsed }
}

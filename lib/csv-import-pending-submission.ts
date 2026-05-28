/**
 * CSV import → catalog pending submission helpers (IMP-254).
 */

import type { ListingCondition, TradePreference } from "@prisma/client"

import { CSV_IMPORT_MAX_ROWS } from "@/lib/csv-import-user"
import { LISTING_CONDITIONS } from "@/utils/listing-display"

export const CSV_IMPORT_SOURCE = "csv_import" as const
export const MANUAL_COLLECTION_SOURCE = "manual_collection" as const

export const CSV_PERFUME_DEFAULT_DESCRIPTION =
  "Submitted via CSV import. Please review and update this description."

export const CSV_HOUSE_DEFAULT_DESCRIPTION =
  "Submitted via CSV import. Please review and update this description."

/** Placeholder website — satisfies CreatePerfumeHouseSchema required URL */
export const CSV_HOUSE_PLACEHOLDER_WEBSITE = "https://example.com"
export const PERFUME_PLACEHOLDER_IMAGE = "/images/single-bottle.webp"
export const HOUSE_PLACEHOLDER_IMAGE = "/images/house-soon.webp"

export type CsvInventoryIntent = {
  amount: string
  condition: ListingCondition | null
  tradePreference: TradePreference
}

export type CsvPerfumeSubmissionData = {
  source: typeof CSV_IMPORT_SOURCE
  name: string
  description: string
  house?: string
  houseName: string
  pendingHouseSubmissionId?: string
  inventoryIntent: CsvInventoryIntent
  csvRowIndex: number
}

export type CsvHouseSubmissionData = {
  source: typeof CSV_IMPORT_SOURCE
  name: string
  description: string
  website: string
  type: "indie"
}

export type CsvSubmitCatalogRow = {
  rowIndex: number
  perfumeName: string
  house: string
  amount: string
  condition: ListingCondition | null
  tradePreference: TradePreference
}

export type CsvSubmitCatalogRequestBody = {
  rows: CsvSubmitCatalogRow[]
  _csrf?: string
}

export type CsvSubmitCatalogResponseBody = {
  success: true
  submitted: number
  houseSubmissionsCreated: number
  errors: { rowIndex: number; error: string }[]
}

/** Keys safe to pass to createPerfume FormData */
export const PERFUME_CATALOG_FIELD_KEYS = new Set([
  "name",
  "description",
  "house",
  "image",
  "notesTop",
  "notesHeart",
  "notesBase",
])

/** Keys safe to pass to createPerfumeHouse FormData */
export const HOUSE_CATALOG_FIELD_KEYS = new Set([
  "name",
  "description",
  "image",
  "website",
  "country",
  "founded",
  "type",
  "email",
  "phone",
  "address",
])

const PERFUME_METADATA_KEYS = new Set([
  "source",
  "pendingHouseSubmissionId",
  "inventoryIntent",
  "csvRowIndex",
])

const VALID_TRADE_PREFERENCES = new Set<TradePreference>(["cash", "trade", "both"])

export const normalizeHouseKey = (house: string): string => house.trim().toLowerCase()

export const buildCsvInventoryIntent = (row: {
  amount: string
  condition: ListingCondition | null
  tradePreference: TradePreference
}): CsvInventoryIntent => ({
  amount: row.amount.trim() || "full",
  condition: row.condition,
  tradePreference: row.tradePreference,
})

export const buildCsvHouseSubmissionData = (houseName: string): CsvHouseSubmissionData => ({
  source: CSV_IMPORT_SOURCE,
  name: houseName.trim(),
  description: CSV_HOUSE_DEFAULT_DESCRIPTION,
  website: CSV_HOUSE_PLACEHOLDER_WEBSITE,
  type: "indie",
})

export const buildCsvPerfumeSubmissionData = (
  row: CsvSubmitCatalogRow,
  options: {
    houseId?: string
    pendingHouseSubmissionId?: string
  } = {}
): CsvPerfumeSubmissionData => {
  const data: CsvPerfumeSubmissionData = {
    source: CSV_IMPORT_SOURCE,
    name: row.perfumeName.trim(),
    description: CSV_PERFUME_DEFAULT_DESCRIPTION,
    houseName: row.house.trim(),
    inventoryIntent: buildCsvInventoryIntent(row),
    csvRowIndex: row.rowIndex,
  }
  if (options.houseId) {
    data.house = options.houseId
  }
  if (options.pendingHouseSubmissionId) {
    data.pendingHouseSubmissionId = options.pendingHouseSubmissionId
  }
  return data
}

export const isCsvImportSubmission = (
  data: Record<string, unknown> | null | undefined
): boolean => data?.source === CSV_IMPORT_SOURCE

export const extractInventoryIntent = (
  data: Record<string, unknown>
): CsvInventoryIntent | null => {
  const intent = data.inventoryIntent
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
    return null
  }
  const row = intent as Record<string, unknown>
  const amount = typeof row.amount === "string" ? row.amount : "full"
  const condition =
    row.condition === null || row.condition === undefined
      ? null
      : typeof row.condition === "string" &&
          LISTING_CONDITIONS.includes(row.condition as ListingCondition)
        ? (row.condition as ListingCondition)
        : null
  const tradePreference =
    typeof row.tradePreference === "string" &&
    VALID_TRADE_PREFERENCES.has(row.tradePreference as TradePreference)
      ? (row.tradePreference as TradePreference)
      : "cash"
  return { amount, condition, tradePreference }
}

export const buildPerfumeFormDataFromSubmission = (
  data: Record<string, unknown>,
  resolvedHouseId: string
): FormData => {
  const formData = new FormData()
  for (const key of PERFUME_CATALOG_FIELD_KEYS) {
    if (key === "house") {
      formData.append("house", resolvedHouseId)
      continue
    }
    const value = data[key]
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      value.forEach(v => formData.append(key, String(v)))
    } else {
      formData.append(key, String(value))
    }
  }
  if (!formData.has("house")) {
    formData.append("house", resolvedHouseId)
  }
  return formData
}

export const buildHouseFormDataFromSubmission = (
  data: Record<string, unknown>
): FormData => {
  const formData = new FormData()
  for (const key of HOUSE_CATALOG_FIELD_KEYS) {
    const value = data[key]
    if (value === undefined || value === null) continue
    formData.append(key, String(value))
  }
  return formData
}

export const stripPerfumeMetadataForDisplay = (
  data: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (PERFUME_METADATA_KEYS.has(key)) continue
    if (key === "house") continue
    out[key] = value
  }
  if (typeof data.houseName === "string" && data.houseName.trim()) {
    out.houseName = data.houseName
  }
  return out
}

export const parseCsvSubmitCatalogRows = (
  raw: unknown
): { rows: CsvSubmitCatalogRow[] } | { error: string } => {
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

  const parsed: CsvSubmitCatalogRow[] = []
  for (const item of rows) {
    if (!item || typeof item !== "object") {
      return { error: "Each row must be an object" }
    }
    const row = item as Record<string, unknown>
    const rowIndex = row.rowIndex
    const perfumeName = row.perfumeName
    const house = row.house
    const amount = row.amount

    if (typeof rowIndex !== "number" || !Number.isFinite(rowIndex)) {
      return { error: "rowIndex must be a number" }
    }
    if (typeof perfumeName !== "string" || !perfumeName.trim()) {
      return { error: "perfumeName must be a non-empty string" }
    }
    if (typeof house !== "string" || !house.trim()) {
      return { error: "house must be a non-empty string" }
    }
    if (typeof amount !== "string") {
      return { error: "amount must be a string" }
    }

    let condition: ListingCondition | null = null
    if (row.condition !== undefined && row.condition !== null) {
      if (typeof row.condition !== "string") {
        return { error: "condition must be a string or null" }
      }
      if (!LISTING_CONDITIONS.includes(row.condition as ListingCondition)) {
        return { error: `Invalid condition: ${row.condition}` }
      }
      condition = row.condition as ListingCondition
    }

    let tradePreference: TradePreference = "cash"
    if (row.tradePreference !== undefined && row.tradePreference !== null) {
      if (typeof row.tradePreference !== "string") {
        return { error: "tradePreference must be a string" }
      }
      if (!VALID_TRADE_PREFERENCES.has(row.tradePreference as TradePreference)) {
        return { error: `Invalid tradePreference: ${row.tradePreference}` }
      }
      tradePreference = row.tradePreference as TradePreference
    }

    parsed.push({
      rowIndex: Math.floor(rowIndex),
      perfumeName: perfumeName.trim(),
      house: house.trim(),
      amount: amount.trim() || "full",
      condition,
      tradePreference,
    })
  }

  return { rows: parsed }
}

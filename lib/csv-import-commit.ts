/**
 * CSV import commit — request validation for POST /api/csv-import/commit.
 */

import type { ListingCondition, TradePreference } from "@prisma/client"

import { CSV_IMPORT_MAX_ROWS } from "@/lib/csv-import-user"
import { LISTING_CONDITIONS } from "@/utils/listing-display"

export type CsvImportCommitRow = {
  rowIndex: number
  perfumeId: string
  amount: string
  condition: ListingCondition | null
  tradePreference: TradePreference
}

export type CsvImportCommitRequestBody = {
  rows: CsvImportCommitRow[]
  _csrf?: string
}

export type CsvImportCommitResponseBody = {
  success: true
  committed: number
  skipped: number
  errors: { rowIndex: number; error: string }[]
}

const VALID_TRADE_PREFERENCES = new Set<TradePreference>(["cash", "trade", "both"])

export const parseCsvCommitRequestRows = (
  raw: unknown
): { rows: CsvImportCommitRow[] } | { error: string } => {
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

  const parsed: CsvImportCommitRow[] = []
  for (const item of rows) {
    if (!item || typeof item !== "object") {
      return { error: "Each row must be an object" }
    }
    const row = item as Record<string, unknown>
    const rowIndex = row.rowIndex
    const perfumeId = row.perfumeId
    const amount = row.amount

    if (typeof rowIndex !== "number" || !Number.isFinite(rowIndex)) {
      return { error: "rowIndex must be a number" }
    }
    if (typeof perfumeId !== "string" || !perfumeId.trim()) {
      return { error: "perfumeId must be a non-empty string" }
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
      perfumeId: perfumeId.trim(),
      amount: amount.trim() || "full",
      condition,
      tradePreference,
    })
  }

  return { rows: parsed }
}

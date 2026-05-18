/**
 * User inventory CSV import — parse + validate only.
 * NO DB WRITES. Rows are handed to IMP-252 matching / IMP-253 commit.
 */

import type { ListingCondition, TradePreference } from "@prisma/client"

import { LISTING_CONDITIONS } from "@/utils/listing-display"

export const CSV_IMPORT_MAX_FILE_BYTES = 500 * 1024
export const CSV_IMPORT_MAX_ROWS = 200

export const CSV_IMPORT_HEADERS = [
  "perfumeName",
  "house",
  "amount",
  "condition",
  "tradePreference",
] as const

export type CsvImportHeader = (typeof CSV_IMPORT_HEADERS)[number]

export type CsvParseErrorKey =
  | "invalid_amount"
  | "invalid_condition"
  | "invalid_trade_preference"
  | "duplicate_row"

export type CsvParseError = {
  key: CsvParseErrorKey
  params?: Record<string, string | number>
}

export type CsvImportRow = {
  rowIndex: number
  raw: Record<string, string>
  parsed: {
    perfumeName: string
    house: string
    amount: string
    condition: ListingCondition | null
    tradePreference: TradePreference
  }
  parseErrors: CsvParseError[]
}

export type CsvParseResult = {
  rows: CsvImportRow[]
  /** Blocking — missing required headers */
  headerErrors: string[]
  /** Non-blocking notices (mlRemaining column, semicolon delimiter, etc.) */
  headerNotices: string[]
  /** Set when input had more than CSV_IMPORT_MAX_ROWS data rows */
  truncatedFrom: number | null
  /** Set when file exceeds size limit or read fails */
  fileError: string | null
}

const HEADER_ALIASES: Record<CsvImportHeader, string[]> = {
  perfumeName: ["perfumename", "name", "perfume", "fragrance", "title"],
  house: ["house", "brand", "perfumehouse", "perfume_house", "house_name"],
  amount: ["amount", "ml", "volume", "size", "qty"],
  condition: ["condition", "cond", "state"],
  tradePreference: [
    "tradepreference",
    "trade_preference",
    "trade preference",
    "preference",
    "pref",
  ],
}

const CONDITION_ALIASES: Record<string, ListingCondition> = {
  sealed: "sealed",
  mint: "mint",
  lightlyused: "lightlyUsed",
  "lightly used": "lightlyUsed",
  lightly_used: "lightlyUsed",
  heavilyused: "heavilyUsed",
  "heavily used": "heavilyUsed",
  heavily_used: "heavilyUsed",
  damaged: "damaged",
}

const TRADE_PREF_ALIASES: Record<string, TradePreference> = {
  cash: "cash",
  sell: "cash",
  sale: "cash",
  trade: "trade",
  swap: "trade",
  exchange: "trade",
  both: "both",
  "cash or trade": "both",
  "trade or cash": "both",
}

/** Extract numeric amount string; mirrors models/user.server.ts parseAmountToNumber. */
export const extractAmountNumeric = (amount: string | null | undefined): number | null => {
  if (!amount?.trim()) return null
  if (amount.trim().toLowerCase() === "full") return null
  const numericValue = parseFloat(amount.replace(/[^0-9.]/g, ""))
  return Number.isNaN(numericValue) ? null : numericValue
}

export const normalizeCsvAmount = (
  raw: string
): { amount: string; invalid: boolean } => {
  const trimmed = raw.trim()
  if (!trimmed) return { amount: "full", invalid: false }
  if (trimmed.toLowerCase() === "full") return { amount: "full", invalid: false }
  const numeric = extractAmountNumeric(trimmed)
  if (numeric === null) return { amount: "full", invalid: true }
  return { amount: String(numeric), invalid: false }
}

const normalizeConditionKey = (raw: string): string =>
  raw.trim().toLowerCase().replace(/\s+/g, " ")

export const normalizeCsvCondition = (
  raw: string
): { condition: ListingCondition | null; invalid: boolean } => {
  const trimmed = raw.trim()
  if (!trimmed) return { condition: null, invalid: false }
  const key = normalizeConditionKey(trimmed)
  const camelKey = key.replace(/\s+(.)/g, (_, c: string) => c.toUpperCase()).replace(/\s/g, "")
  const mapped =
    CONDITION_ALIASES[key] ??
    CONDITION_ALIASES[camelKey] ??
    (LISTING_CONDITIONS.includes(camelKey as ListingCondition)
      ? (camelKey as ListingCondition)
      : undefined)
  if (mapped) return { condition: mapped, invalid: false }
  return { condition: null, invalid: true }
}

export const normalizeCsvTradePreference = (
  raw: string
): { tradePreference: TradePreference; invalid: boolean } => {
  const trimmed = raw.trim()
  if (!trimmed) return { tradePreference: "cash", invalid: false }
  const key = trimmed.toLowerCase()
  const mapped = TRADE_PREF_ALIASES[key]
  if (mapped) return { tradePreference: mapped, invalid: false }
  return { tradePreference: "cash", invalid: true }
}

const stripBom = (text: string): string =>
  text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

const normalizeLineEndings = (text: string): string => text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

/** RFC 4180-style field parser for a full file body. */
export const parseCsvRecords = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field)
      field = ""
    } else if (c === "\n") {
      row.push(field)
      field = ""
      if (row.some(cell => cell.trim() !== "")) {
        rows.push(row)
      }
      row = []
    } else {
      field += c
    }
  }

  row.push(field)
  if (row.some(cell => cell.trim() !== "")) {
    rows.push(row)
  }

  return rows
}

const detectDelimiter = (firstDataLine: string | undefined): "," | ";" => {
  if (!firstDataLine) return ","
  const commaParts = firstDataLine.split(",").length
  const semiParts = firstDataLine.split(";").length
  if (commaParts <= 1 && semiParts > 1) return ";"
  return ","
}

const normalizeHeaderCell = (cell: string): string =>
  cell.trim().toLowerCase().replace(/^\uFEFF/, "")

const resolveHeaderMap = (
  headerCells: string[]
): {
  columnIndex: Partial<Record<CsvImportHeader, number>>
  hasMlRemaining: boolean
  missingRequired: CsvImportHeader[]
} => {
  const columnIndex: Partial<Record<CsvImportHeader, number>> = {}
  let hasMlRemaining = false

  headerCells.forEach((cell, index) => {
    const norm = normalizeHeaderCell(cell)
    if (norm === "mlremaining" || norm === "ml_remaining") {
      hasMlRemaining = true
      return
    }
    for (const canonical of CSV_IMPORT_HEADERS) {
      if (columnIndex[canonical] !== undefined) continue
      const aliases = [canonical.toLowerCase(), ...HEADER_ALIASES[canonical]]
      if (aliases.includes(norm)) {
        columnIndex[canonical] = index
        break
      }
    }
  })

  const missingRequired: CsvImportHeader[] = []
  if (columnIndex.perfumeName === undefined) {
    missingRequired.push("perfumeName")
  }

  return { columnIndex, hasMlRemaining, missingRequired }
}

const getCell = (cells: string[], index: number | undefined): string =>
  index === undefined ? "" : (cells[index] ?? "").trim()

const rowKey = (perfumeName: string, house: string): string =>
  `${perfumeName.trim().toLowerCase()}|${house.trim().toLowerCase()}`

const isEmptyDataRow = (cells: string[]): boolean =>
  cells.every(cell => !cell.trim())

/** Parse CSV text (for tests and browser File reads). NO DB WRITES. */
export const parseCsvImportText = (text: string): CsvParseResult => {
  const normalized = normalizeLineEndings(stripBom(text))
  const lines = normalized.split("\n").filter((_, i, arr) => i < arr.length)
  const firstNonEmpty = lines.find(l => l.trim().length > 0)
  const delimiter = detectDelimiter(firstNonEmpty)
  const records = parseCsvRecords(normalized, delimiter)

  const headerNotices: string[] = []
  if (delimiter === ";") {
    headerNotices.push("semicolon_delimiter")
  }

  if (records.length === 0) {
    return {
      rows: [],
      headerErrors: ["no_rows"],
      headerNotices,
      truncatedFrom: null,
      fileError: null,
    }
  }

  const [headerRow, ...dataRows] = records
  const { columnIndex, hasMlRemaining, missingRequired } = resolveHeaderMap(headerRow)

  if (hasMlRemaining) {
    headerNotices.push("ml_remaining_column")
  }

  const headerErrors: string[] = []
  if (missingRequired.length > 0) {
    headerErrors.push(`missing_headers:${missingRequired.join(",")}`)
    return {
      rows: [],
      headerErrors,
      headerNotices,
      truncatedFrom: null,
      fileError: null,
    }
  }

  const nonEmptyDataRows = dataRows.filter(row => !isEmptyDataRow(row))
  const truncatedFrom =
    nonEmptyDataRows.length > CSV_IMPORT_MAX_ROWS ? nonEmptyDataRows.length : null
  const rowsToProcess = nonEmptyDataRows.slice(0, CSV_IMPORT_MAX_ROWS)

  const parsedRows: CsvImportRow[] = []
  const seenKeys = new Map<string, number>()

  rowsToProcess.forEach((cells, index) => {
    const rowIndex = index + 1
    const perfumeName = getCell(cells, columnIndex.perfumeName)
    const house = getCell(cells, columnIndex.house)
    const amountRaw = getCell(cells, columnIndex.amount)
    const conditionRaw = getCell(cells, columnIndex.condition)
    const tradePrefRaw = getCell(cells, columnIndex.tradePreference)

    const raw: Record<string, string> = {
      perfumeName,
      house,
      amount: amountRaw,
      condition: conditionRaw,
      tradePreference: tradePrefRaw,
    }

    const parseErrors: CsvParseError[] = []

    const { amount, invalid: amountInvalid } = normalizeCsvAmount(amountRaw)
    if (amountInvalid) {
      parseErrors.push({ key: "invalid_amount" })
    }

    const { condition, invalid: conditionInvalid } = normalizeCsvCondition(conditionRaw)
    if (conditionInvalid) {
      parseErrors.push({ key: "invalid_condition" })
    }

    const { tradePreference, invalid: tradeInvalid } =
      normalizeCsvTradePreference(tradePrefRaw)
    if (tradeInvalid) {
      parseErrors.push({ key: "invalid_trade_preference" })
    }

    const key = rowKey(perfumeName, house)
    if (perfumeName && seenKeys.has(key)) {
      parseErrors.push({
        key: "duplicate_row",
        params: { row: seenKeys.get(key)! },
      })
    } else if (perfumeName) {
      seenKeys.set(key, rowIndex)
    }

    parsedRows.push({
      rowIndex,
      raw,
      parsed: {
        perfumeName,
        house,
        amount,
        condition,
        tradePreference,
      },
      parseErrors,
    })
  })

  return {
    rows: parsedRows,
    headerErrors,
    headerNotices,
    truncatedFrom,
    fileError: null,
  }
}

export const parseCsvImportFile = async (file: File): Promise<CsvParseResult> => {
  if (file.size > CSV_IMPORT_MAX_FILE_BYTES) {
    return {
      rows: [],
      headerErrors: [],
      headerNotices: [],
      truncatedFrom: null,
      fileError: "file_too_large",
    }
  }

  try {
    const text = await file.text()
    return parseCsvImportText(text)
  } catch {
    return {
      rows: [],
      headerErrors: [],
      headerNotices: [],
      truncatedFrom: null,
      fileError: "read_failed",
    }
  }
}

export const CSV_IMPORT_TEMPLATE = [
  CSV_IMPORT_HEADERS.join(","),
  "Aventus,Creed,50ml,mint,trade",
  "Black Orchid,Tom Ford,full,lightlyUsed,both",
].join("\n")

export const downloadCsvImportTemplate = (): void => {
  const blob = new Blob([CSV_IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "shadow-inventory-template.csv"
  anchor.click()
  URL.revokeObjectURL(url)
}

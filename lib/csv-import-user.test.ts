import { describe, expect, it } from "vitest"

import {
  CSV_IMPORT_MAX_ROWS,
  normalizeCsvAmount,
  normalizeCsvCondition,
  normalizeCsvTradePreference,
  parseCsvImportText,
  parseCsvRecords,
} from "@/lib/csv-import-user"

describe("normalizeCsvAmount", () => {
  it("defaults empty to full", () => {
    expect(normalizeCsvAmount("")).toEqual({ amount: "full", invalid: false })
  })

  it("strips ml units", () => {
    expect(normalizeCsvAmount("50ml")).toEqual({ amount: "50", invalid: false })
    expect(normalizeCsvAmount("50 ml")).toEqual({ amount: "50", invalid: false })
  })

  it("flags invalid non-numeric values", () => {
    expect(normalizeCsvAmount("abc")).toEqual({ amount: "full", invalid: true })
  })
})

describe("normalizeCsvCondition", () => {
  it("maps aliases", () => {
    expect(normalizeCsvCondition("lightly used")).toEqual({
      condition: "lightlyUsed",
      invalid: false,
    })
  })

  it("rejects unknown values", () => {
    expect(normalizeCsvCondition("used")).toEqual({ condition: null, invalid: true })
  })
})

describe("normalizeCsvTradePreference", () => {
  it("maps swap to trade without warning", () => {
    expect(normalizeCsvTradePreference("swap")).toEqual({
      tradePreference: "trade",
      invalid: false,
    })
  })

  it("defaults unknown with warning", () => {
    expect(normalizeCsvTradePreference("barter")).toEqual({
      tradePreference: "cash",
      invalid: true,
    })
  })
})

describe("parseCsvRecords", () => {
  it("handles quoted commas", () => {
    const rows = parseCsvRecords('"Tobacco, Oudh",Creed,50ml\n', ",")
    expect(rows[0][0]).toBe("Tobacco, Oudh")
    expect(rows[0][1]).toBe("Creed")
  })
})

describe("parseCsvImportText", () => {
  const happyCsv = `perfumeName,house,amount,condition,tradePreference
Aventus,Creed,50ml,mint,trade
Black Orchid,Tom Ford,full,lightlyUsed,both`

  it("parses valid rows", () => {
    const result = parseCsvImportText(happyCsv)
    expect(result.headerErrors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].parsed).toMatchObject({
      perfumeName: "Aventus",
      house: "Creed",
      amount: "50",
      condition: "mint",
      tradePreference: "trade",
    })
  })

  it("detects semicolon delimiter", () => {
    const csv = `perfumeName;house;amount;condition;tradePreference
Aventus;Creed;50ml;mint;trade`
    const result = parseCsvImportText(csv)
    expect(result.headerNotices).toContain("semicolon_delimiter")
    expect(result.rows).toHaveLength(1)
  })

  it("warns on mlRemaining column", () => {
    const csv = `perfumeName,house,mlRemaining,condition,tradePreference
Aventus,Creed,50,mint,trade`
    const result = parseCsvImportText(csv)
    expect(result.headerNotices).toContain("ml_remaining_column")
    expect(result.rows[0].parsed.amount).toBe("full")
  })

  it("blocks missing perfumeName header", () => {
    const csv = `scent,brand,ml,cond,pref
Aventus,Creed,50,mint,trade`
    const result = parseCsvImportText(csv)
    expect(result.headerErrors[0]).toMatch(/missing_headers/)
    expect(result.rows).toHaveLength(0)
  })

  it("flags duplicate rows", () => {
    const csv = `perfumeName,house,amount,condition,tradePreference
Aventus,Creed,50ml,mint,trade
Aventus,Creed,30ml,lightlyUsed,cash`
    const result = parseCsvImportText(csv)
    expect(result.rows[1].parseErrors).toContainEqual({
      key: "duplicate_row",
      params: { row: 1 },
    })
  })

  it("truncates beyond max rows", () => {
    const header = "perfumeName,house,amount,condition,tradePreference\n"
    const body = Array.from(
      { length: CSV_IMPORT_MAX_ROWS + 1 },
      (_, i) => `Perfume ${i},House,full,,`
    ).join("\n")
    const result = parseCsvImportText(header + body)
    expect(result.rows).toHaveLength(CSV_IMPORT_MAX_ROWS)
    expect(result.truncatedFrom).toBe(CSV_IMPORT_MAX_ROWS + 1)
  })

  it("returns no data rows for header-only file", () => {
    const result = parseCsvImportText(
      "perfumeName,house,amount,condition,tradePreference\n"
    )
    expect(result.headerErrors).toHaveLength(0)
    expect(result.rows).toHaveLength(0)
  })
})

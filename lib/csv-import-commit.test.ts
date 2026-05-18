import { describe, expect, it } from "vitest"

import { parseCsvCommitRequestRows } from "@/lib/csv-import-commit"

describe("parseCsvCommitRequestRows", () => {
  it("parses valid commit rows", () => {
    const result = parseCsvCommitRequestRows({
      rows: [
        {
          rowIndex: 0,
          perfumeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
          amount: "50ml",
          condition: "mint",
          tradePreference: "trade",
        },
      ],
    })
    expect("rows" in result).toBe(true)
    if ("rows" in result) {
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]!.condition).toBe("mint")
      expect(result.rows[0]!.tradePreference).toBe("trade")
    }
  })

  it("rejects empty rows array", () => {
    const result = parseCsvCommitRequestRows({ rows: [] })
    expect("error" in result).toBe(true)
  })

  it("rejects invalid condition", () => {
    const result = parseCsvCommitRequestRows({
      rows: [
        {
          rowIndex: 0,
          perfumeId: "id",
          amount: "full",
          condition: "not_a_condition",
        },
      ],
    })
    expect("error" in result).toBe(true)
  })
})

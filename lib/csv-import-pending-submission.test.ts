import { describe, expect, it } from "vitest"

import {
  buildCsvHouseSubmissionData,
  buildCsvPerfumeSubmissionData,
  buildPerfumeFormDataFromSubmission,
  CSV_IMPORT_SOURCE,
  HOUSE_PLACEHOLDER_IMAGE,
  MANUAL_COLLECTION_SOURCE,
  PERFUME_PLACEHOLDER_IMAGE,
  extractInventoryIntent,
  isCsvImportSubmission,
  normalizeHouseKey,
  parseCsvSubmitCatalogRows,
  stripPerfumeMetadataForDisplay,
} from "@/lib/csv-import-pending-submission"

describe("parseCsvSubmitCatalogRows", () => {
  it("parses valid submit-catalog rows", () => {
    const result = parseCsvSubmitCatalogRows({
      rows: [
        {
          rowIndex: 2,
          perfumeName: "Unknown Scent",
          house: "New House",
          amount: "50ml",
          condition: "mint",
          tradePreference: "trade",
        },
      ],
    })
    expect("rows" in result).toBe(true)
    if ("rows" in result) {
      expect(result.rows[0]!.perfumeName).toBe("Unknown Scent")
      expect(result.rows[0]!.tradePreference).toBe("trade")
    }
  })

  it("rejects empty perfume name", () => {
    const result = parseCsvSubmitCatalogRows({
      rows: [
        {
          rowIndex: 0,
          perfumeName: "  ",
          house: "House",
          amount: "full",
        },
      ],
    })
    expect("error" in result).toBe(true)
  })
})

describe("buildCsvPerfumeSubmissionData", () => {
  it("includes inventory intent and source", () => {
    const data = buildCsvPerfumeSubmissionData(
      {
        rowIndex: 1,
        perfumeName: "Test",
        house: "Maison",
        amount: "full",
        condition: null,
        tradePreference: "cash",
      },
      { pendingHouseSubmissionId: "house-sub-1" }
    )
    expect(data.source).toBe(CSV_IMPORT_SOURCE)
    expect(data.pendingHouseSubmissionId).toBe("house-sub-1")
    expect(data.inventoryIntent.amount).toBe("full")
  })
})

describe("buildCsvHouseSubmissionData", () => {
  it("includes placeholder website", () => {
    const data = buildCsvHouseSubmissionData("New House")
    expect(data.website).toMatch(/^https:\/\//)
    expect(data.type).toBe("indie")
  })
})

describe("normalizeHouseKey", () => {
  it("dedupes house names case-insensitively", () => {
    expect(normalizeHouseKey("  Creed ")).toBe(normalizeHouseKey("creed"))
  })
})

describe("extractInventoryIntent", () => {
  it("reads nested inventory from submission data", () => {
    const intent = extractInventoryIntent({
      inventoryIntent: {
        amount: "30ml",
        condition: "sealed",
        tradePreference: "both",
      },
    })
    expect(intent?.amount).toBe("30ml")
    expect(intent?.condition).toBe("sealed")
  })
})

describe("buildPerfumeFormDataFromSubmission", () => {
  it("strips metadata and sets house id", () => {
    const form = buildPerfumeFormDataFromSubmission(
      {
        name: "Test",
        description: "A long enough description for catalog.",
        source: CSV_IMPORT_SOURCE,
        houseName: "House",
        inventoryIntent: { amount: "full", condition: null, tradePreference: "cash" },
        csvRowIndex: 0,
      },
      "house-id-1"
    )
    expect(form.get("house")).toBe("house-id-1")
    expect(form.get("name")).toBe("Test")
    expect(form.get("source")).toBeNull()
  })
})

describe("stripPerfumeMetadataForDisplay", () => {
  it("omits inventory intent from detail dump", () => {
    const display = stripPerfumeMetadataForDisplay({
      name: "Test",
      description: "Desc",
      houseName: "House",
      inventoryIntent: { amount: "full" },
      source: CSV_IMPORT_SOURCE,
    })
    expect(display.inventoryIntent).toBeUndefined()
    expect(display.houseName).toBe("House")
  })
})

describe("isCsvImportSubmission", () => {
  it("detects csv import source", () => {
    expect(isCsvImportSubmission({ source: CSV_IMPORT_SOURCE })).toBe(true)
    expect(isCsvImportSubmission({ source: "contact" })).toBe(false)
  })
})

describe("manual collection placeholders", () => {
  it("exports manual source and placeholder image constants", () => {
    expect(MANUAL_COLLECTION_SOURCE).toBe("manual_collection")
    expect(PERFUME_PLACEHOLDER_IMAGE).toContain("/images/")
    expect(HOUSE_PLACEHOLDER_IMAGE).toContain("/images/")
  })
})

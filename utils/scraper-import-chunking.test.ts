import { describe, expect, it } from "vitest"

import {
  chunkPerfumeCsvRecordsForImport,
  chunkPerfumeCsvRecordsForRetryR2,
} from "./scraper-import-chunking"
import type { PerfumeCsvRecord } from "@/types/scraper"

function record(name: string, description = "x"): PerfumeCsvRecord {
  return {
    name,
    description,
    image: "",
    perfumeHouse: "H",
    openNotes: "[]",
    heartNotes: "[]",
    baseNotes: "[]",
    detailURL: "https://example.com/p",
  }
}

describe("chunkPerfumeCsvRecordsForImport", () => {
  it("returns a single chunk when payload is small", () => {
    const records = [record("A"), record("B")]
    const chunks = chunkPerfumeCsvRecordsForImport(records, true, true, 50_000)
    expect(chunks).toEqual([records])
  })

  it("splits when records exceed maxUtf8Bytes", () => {
    const big = "€".repeat(4000)
    const records = [record("1", big), record("2", big), record("3", big)]
    const chunks = chunkPerfumeCsvRecordsForImport(records, true, true, 8000)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.flat()).toEqual(records)
  })
})

describe("chunkPerfumeCsvRecordsForRetryR2", () => {
  it("keeps order and full set", () => {
    const records = [record("a"), record("b"), record("c")]
    const chunks = chunkPerfumeCsvRecordsForRetryR2(records, 500)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.flat()).toEqual(records)
  })
})

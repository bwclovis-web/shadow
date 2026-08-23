import { describe, expect, it } from "vitest"

import {
  buildProgress,
  isScraperJobStage,
  parseProgressJson,
  toScraperRunResponse,
} from "@/lib/scraper/jobs/scraper-job-types"
import {
  dedupePreviewRecords,
  normalizeRecordNotes,
  recordsToCsv,
} from "@/lib/scraper/jobs/preview-normalize"
import type { PerfumeCsvRecord } from "@/types/scraper"

describe("scraper job progress types", () => {
  it("validates stages and builds progress", () => {
    expect(isScraperJobStage("scraping")).toBe(true)
    expect(isScraperJobStage("nope")).toBe(false)
    const progress = buildProgress("note_extraction", 150, { message: "x" })
    expect(progress.percent).toBe(100)
    expect(progress.stage).toBe("note_extraction")
    expect(parseProgressJson(progress)?.stage).toBe("note_extraction")
  })

  it("builds a run response with job id", () => {
    const res = toScraperRunResponse({
      ok: true,
      scrapedCount: 1,
      records: [],
      csvContent: "",
      errors: [],
      jobId: "job_1",
    })
    expect(res.jobId).toBe("job_1")
    expect(res.ok).toBe(true)
  })

  it("includes scraper log on empty-result response", () => {
    const res = toScraperRunResponse({
      ok: true,
      scrapedCount: 0,
      records: [],
      csvContent: "",
      errors: ["Scraper ran successfully but found 0 products. Check your collection URLs and selectors."],
      scraperLog: "Discovery HTTP sitemap.xml → 406",
      jobId: "job_empty",
    })
    expect(res.scrapedCount).toBe(0)
    expect(res.scraperLog).toContain("406")
    expect(res.errors[0]).toContain("0 products")
  })
})

describe("preview normalize helpers", () => {
  const sample = (name: string, url: string): PerfumeCsvRecord => ({
    name,
    description: "d",
    image: "https://example.com/a.jpg",
    perfumeHouse: "House",
    openNotes: '["rose"]',
    heartNotes: "[]",
    baseNotes: "[]",
    detailURL: url,
  })

  it("dedupes by detail URL and keeps richer row", () => {
    const richer = {
      ...sample("A", "https://shop.example/products/a"),
      heartNotes: '["jasmine"]',
    }
    const { records, warnings } = dedupePreviewRecords([
      sample("A", "https://shop.example/products/a"),
      richer,
    ])
    expect(records).toHaveLength(1)
    expect(records[0]?.heartNotes).toContain("jasmine")
    expect(warnings.length).toBeGreaterThan(0)
  })

  it("normalizes repeated notes within a layer", () => {
    const { record, removedCount } = normalizeRecordNotes({
      ...sample("B", "https://shop.example/products/b"),
      openNotes: '["Rose", "rose", "Bergamot"]',
    })
    expect(JSON.parse(record.openNotes)).toEqual(["Rose", "Bergamot"])
    expect(removedCount).toBe(1)
  })

  it("serializes csv", () => {
    const csv = recordsToCsv([sample("C", "https://shop.example/products/c")])
    expect(csv.split("\n")[0]).toContain("name")
    expect(csv).toContain("C")
  })
})

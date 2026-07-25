import { describe, expect, it, vi } from "vitest"

import { assessDuplicateRisk } from "@/lib/scraper/duplicate-review"
import type { PerfumeCsvRecord } from "@/types/scraper"

const baseRecord = (name: string, house: string): PerfumeCsvRecord => ({
  name,
  perfumeHouse: house,
  description: "",
  image: "",
  openNotes: "[]",
  heartNotes: "[]",
  baseNotes: "[]",
})

describe("assessDuplicateRisk", () => {
  it("does not flag same-house house-suffix names as high risk (intended upsert)", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "1",
        name: "Songbird - Area Of Effect",
        slug: "songbird-area-of-effect",
        perfumeHouse: { name: "Area Of Effect" },
      },
      {
        id: "2",
        name: "Songbird - Area Of Effect",
        slug: "songbird-area-of-effect-1",
        perfumeHouse: { name: "Area Of Effect" },
      },
    ])

    const result = await assessDuplicateRisk(
      [baseRecord("Songbird", "Area Of Effect")],
      { prismaClient: { perfume: { findMany } } as never },
    )

    expect(result[0]?.duplicateRisk).toBe("none")
  })

  it("still flags fuzzy near-duplicates in the same house as high risk", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "1",
        name: "The Bird Or The Cage",
        slug: "the-bird-or-the-cage",
        perfumeHouse: { name: "Area Of Effect" },
      },
    ])

    const result = await assessDuplicateRisk(
      [baseRecord("Bird Or The Cage", "Area Of Effect")],
      { prismaClient: { perfume: { findMany } } as never },
    )

    expect(result[0]?.duplicateRisk).toBe("high")
  })
})

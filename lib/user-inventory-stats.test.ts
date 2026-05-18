import { describe, expect, it } from "vitest"

import { computeCollectionCounts } from "@/lib/user-inventory-stats"

describe("computeCollectionCounts", () => {
  it("counts distinct perfumes and houses from collection bottles", () => {
    const result = computeCollectionCounts([
      {
        id: "1",
        perfumeId: "p1",
        amount: "100",
        perfume: { perfumeHouse: { id: "h1" } },
      },
      {
        id: "2",
        perfumeId: "p2",
        amount: "50",
        perfume: { perfumeHouse: { id: "h1" } },
      },
    ])
    expect(result).toEqual({ bottleCount: 2, houseCount: 1 })
  })

  it("excludes destash-only rows", () => {
    const result = computeCollectionCounts([
      {
        id: "1",
        perfumeId: "p1",
        amount: "0",
        available: "10",
        perfume: { perfumeHouse: { id: "h1" } },
      },
    ])
    expect(result).toEqual({ bottleCount: 0, houseCount: 0 })
  })
})

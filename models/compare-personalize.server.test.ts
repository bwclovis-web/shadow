import { describe, expect, it } from "vitest"

import { computeComparePersonalization } from "@/models/compare-personalize.server"

describe("computeComparePersonalization", () => {
  const map = (entries: [string, string[]][]) => new Map(entries)

  it("picks perfume with highest weighted note overlap; tie → first in order", () => {
    const noteIdsByPerfumeId = map([
      ["a", ["n1", "n2"]],
      ["b", ["n1"]],
    ])
    const weights = { n1: 2, n2: 1 }
    const r = computeComparePersonalization(
      ["a", "b"],
      noteIdsByPerfumeId,
      weights,
      new Set()
    )
    expect(r.winnerId).toBe("a")
    expect(r.explainNoteIds).toEqual(["n1", "n2"])
  })

  it("tie on score keeps earlier ordered id", () => {
    const noteIdsByPerfumeId = map([
      ["a", ["n1"]],
      ["b", ["n1"]],
    ])
    const weights = { n1: 1 }
    const r = computeComparePersonalization(
      ["a", "b"],
      noteIdsByPerfumeId,
      weights,
      new Set()
    )
    expect(r.winnerId).toBe("a")
  })

  it("disqualifies perfumes that share any avoid note", () => {
    const noteIdsByPerfumeId = map([
      ["a", ["n1", "avoid"]],
      ["b", ["n1"]],
    ])
    const weights = { n1: 5, avoid: 1 }
    const r = computeComparePersonalization(
      ["a", "b"],
      noteIdsByPerfumeId,
      weights,
      new Set(["avoid"])
    )
    expect(r.winnerId).toBe("b")
  })

  it("returns no winner when all scores are zero", () => {
    const noteIdsByPerfumeId = map([["a", ["n1"]]])
    const r = computeComparePersonalization(
      ["a"],
      noteIdsByPerfumeId,
      {},
      new Set()
    )
    expect(r.winnerId).toBeNull()
    expect(r.explainNoteIds).toEqual([])
  })
})

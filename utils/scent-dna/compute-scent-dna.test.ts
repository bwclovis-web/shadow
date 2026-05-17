import { describe, expect, it } from "vitest"

import {
  computeHouseTypeBreakdown,
  computeSeasonAffinity,
  computeTopNoteFamilies,
} from "./compute-scent-dna"
import { classifyNoteNameToFamily } from "./note-families"

describe("classifyNoteNameToFamily", () => {
  it("maps common notes to expected families", () => {
    expect(classifyNoteNameToFamily("Bergamot")).toBe("citrus")
    expect(classifyNoteNameToFamily("Rose")).toBe("florals")
    expect(classifyNoteNameToFamily("Sandalwood")).toBe("woods")
    expect(classifyNoteNameToFamily("Vanilla")).toBe("gourmands")
    expect(classifyNoteNameToFamily("Sea Salt")).toBe("aquatics")
    expect(classifyNoteNameToFamily("Amber")).toBe("orientals")
  })
})

describe("computeTopNoteFamilies", () => {
  it("returns top three families by aggregated weight", () => {
    const noteNameById = new Map([
      ["n1", "Rose"],
      ["n2", "Jasmine"],
      ["n3", "Bergamot"],
      ["n4", "Sandalwood"],
      ["n5", "Vanilla"],
    ])

    const top = computeTopNoteFamilies(
      { n1: 3, n2: 2, n3: 1, n4: 4, n5: 1 },
      noteNameById
    )

    expect(top).toHaveLength(3)
    expect(top[0]?.family).toBe("florals")
    expect(top[1]?.family).toBe("woods")
    expect(top[0]?.percent).toBeGreaterThan(top[1]?.percent ?? 0)
  })
})

describe("computeSeasonAffinity", () => {
  it("scores each season 0–100 from vote flags", () => {
    const affinity = computeSeasonAffinity([
      { winter: true, spring: false, summer: false, fall: true },
      { winter: true, spring: true, summer: false, fall: false },
    ])

    expect(affinity.winter).toBe(50)
    expect(affinity.spring).toBe(25)
    expect(affinity.fall).toBe(25)
    expect(affinity.summer).toBe(0)
  })
})

describe("computeHouseTypeBreakdown", () => {
  it("returns indie/niche/designer percentages", () => {
    expect(
      computeHouseTypeBreakdown(["niche", "niche", "designer", "indie"])
    ).toEqual({ indie: 25, niche: 50, designer: 25 })
  })
})

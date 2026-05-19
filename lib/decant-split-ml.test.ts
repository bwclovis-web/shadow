import { describe, expect, it } from "vitest"

import {
  computePourableMlBudget,
  sumListedMlForPerfume,
  sumOwnedMlForPerfume,
} from "@/lib/decant-split-ml"

describe("decant-split-ml", () => {
  it("sums owned and listed ml from rows", () => {
    const rows = [
      { id: "1", perfumeId: "p1", amount: "100", available: "0" },
      { id: "2", perfumeId: "p1", amount: "0", available: "10" },
      { id: "3", perfumeId: "p1", amount: "0", available: "5" },
    ]
    expect(sumOwnedMlForPerfume(rows)).toBe(100)
    expect(sumListedMlForPerfume(rows)).toBe(15)
  })

  it("computes remaining pourable ml", () => {
    expect(
      computePourableMlBudget({
        ownedMl: 100,
        listedMl: 20,
        reservedMl: 30,
      }).remainingPourableMl
    ).toBe(50)
  })

  it("never returns negative remaining", () => {
    expect(
      computePourableMlBudget({
        ownedMl: 10,
        listedMl: 20,
        reservedMl: 5,
      }).remainingPourableMl
    ).toBe(0)
  })
})

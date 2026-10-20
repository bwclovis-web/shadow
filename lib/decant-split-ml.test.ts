import { describe, expect, it } from "vitest"

import {
  ACTIVE_DECANT_SPLIT_STATUSES,
  canAcceptAllocationMl,
  classifyStoredOwnedAmount,
  computePooledFragranceAllocation,
  computePourableMlBudget,
  getDestashListingTreatment,
  getSourceBottleAttribution,
  ML_COMPARISON_TOLERANCE,
  ML_DECIMAL_PLACES,
  mlFitsWithinBudget,
  parseStrictAllocationMl,
  roundMl,
  SPLIT_STATUS_ML_ACCOUNTING,
  sumActiveDestashMlForPerfume,
  sumConsumedCompletedSplitMl,
  sumKnownOwnedMlForPerfume,
  sumListedMlForPerfume,
  sumOwnedMlForPerfume,
  sumReservingSplitMl,
  volumesWithinTolerance,
} from "@/lib/decant-split-ml"
import type { UserInventoryRow } from "@/lib/user-inventory"

const row = (
  partial: Partial<UserInventoryRow> & Pick<UserInventoryRow, "id" | "perfumeId">
): UserInventoryRow => ({
  amount: "0",
  available: "0",
  ...partial,
})

describe("decant-split-ml legacy helpers", () => {
  it("sums owned and listed ml from rows (lenient)", () => {
    const rows = [
      row({ id: "1", perfumeId: "p1", amount: "100", available: "0" }),
      row({ id: "2", perfumeId: "p1", amount: "0", available: "10" }),
      row({ id: "3", perfumeId: "p1", amount: "0", available: "5" }),
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

describe("precision / tolerance policy", () => {
  it("uses one decimal place and half-step tolerance", () => {
    expect(ML_DECIMAL_PLACES).toBe(1)
    expect(ML_COMPARISON_TOLERANCE).toBe(0.05)
    expect(roundMl(10.14)).toBe(10.1)
    expect(roundMl(10.15)).toBe(10.2)
    expect(volumesWithinTolerance(10.0, 10.05)).toBe(true)
    expect(volumesWithinTolerance(10.0, 10.06)).toBe(false)
    expect(mlFitsWithinBudget(10.05, 10)).toBe(true)
    expect(mlFitsWithinBudget(10.06, 10)).toBe(false)
  })
})

describe("split status accounting", () => {
  it("defines reservation vs release for every status", () => {
    expect(SPLIT_STATUS_ML_ACCOUNTING.open).toBe("reserves")
    expect(SPLIT_STATUS_ML_ACCOUNTING.filling).toBe("reserves")
    expect(SPLIT_STATUS_ML_ACCOUNTING.shipped).toBe("reserves")
    expect(SPLIT_STATUS_ML_ACCOUNTING.cancelled).toBe("released_unpoured")
    expect(SPLIT_STATUS_ML_ACCOUNTING.completed).toBe(
      "released_poured_unaccounted"
    )
    expect(ACTIVE_DECANT_SPLIT_STATUSES).toEqual(["open", "filling", "shipped"])
  })

  it("sums reserving vs completed consumption separately", () => {
    const splits = [
      { totalMl: 20, status: "open" as const },
      { totalMl: 10, status: "shipped" as const },
      { totalMl: 15, status: "completed" as const },
      { totalMl: 5, status: "cancelled" as const },
    ]
    expect(sumReservingSplitMl(splits)).toBe(30)
    expect(sumConsumedCompletedSplitMl(splits)).toBe(15)
  })
})

describe("classifyStoredOwnedAmount / parseStrictAllocationMl", () => {
  it("treats numeric stored amounts (optional ml) as known", () => {
    expect(classifyStoredOwnedAmount("100")).toEqual({ status: "known", ml: 100 })
    expect(classifyStoredOwnedAmount("50.5ml")).toEqual({ status: "known", ml: 50.5 })
    expect(classifyStoredOwnedAmount("0")).toEqual({ status: "known", ml: 0 })
    expect(classifyStoredOwnedAmount("")).toEqual({ status: "known", ml: 0 })
    expect(classifyStoredOwnedAmount(null)).toEqual({ status: "known", ml: 0 })
  })

  it("marks legacy tokens and malformed ownership as unknown (never unlimited)", () => {
    expect(classifyStoredOwnedAmount("full").status).toBe("unknown")
    expect(classifyStoredOwnedAmount("about 50").status).toBe("unknown")
    expect(classifyStoredOwnedAmount("-10").status).toBe("unknown")
    expect(classifyStoredOwnedAmount("Infinity").status).toBe("unknown")
  })

  it("rejects malformed / negative / unitful new volume inputs", () => {
    expect(parseStrictAllocationMl("10")).toEqual({ ok: true, ml: 10 })
    expect(parseStrictAllocationMl("10.5")).toEqual({ ok: true, ml: 10.5 })
    expect(parseStrictAllocationMl("").ok).toBe(false)
    expect(parseStrictAllocationMl("10ml").ok).toBe(false)
    expect(parseStrictAllocationMl("full").ok).toBe(false)
    expect(parseStrictAllocationMl("-1").ok).toBe(false)
    expect(parseStrictAllocationMl("NaN").ok).toBe(false)
    expect(parseStrictAllocationMl("Infinity").ok).toBe(false)
    expect(parseStrictAllocationMl("1.2.3").ok).toBe(false)
  })
})

describe("destash listing treatment", () => {
  it("treats active vs paused vs inactive explicitly", () => {
    expect(
      getDestashListingTreatment(
        row({ id: "a", perfumeId: "p", available: "10" })
      )
    ).toBe("active")
    expect(
      getDestashListingTreatment(
        row({
          id: "b",
          perfumeId: "p",
          available: "0",
          pausedAvailable: "10",
        })
      )
    ).toBe("paused")
    expect(
      getDestashListingTreatment(
        row({ id: "c", perfumeId: "p", available: "0" })
      )
    ).toBe("inactive")
  })

  it("excludes paused listings from active destash sum", () => {
    const rows = [
      row({ id: "bottle", perfumeId: "p", amount: "100", available: "0" }),
      row({ id: "d1", perfumeId: "p", available: "20" }),
      row({
        id: "d2",
        perfumeId: "p",
        available: "0",
        pausedAvailable: "15",
      }),
    ]
    expect(sumActiveDestashMlForPerfume(rows)).toBe(20)
  })
})

describe("computePooledFragranceAllocation", () => {
  it("handles multiple bottles and multiple active destashes", () => {
    const rows = [
      row({ id: "b1", perfumeId: "p", amount: "60", available: "0" }),
      row({ id: "b2", perfumeId: "p", amount: "40", available: "5" }),
      row({ id: "d1", perfumeId: "p", amount: "0", available: "10" }),
      row({ id: "d2", perfumeId: "p", amount: "0", available: "15" }),
    ]
    const budget = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 20,
      consumedCompletedSplitMl: 0,
    })
    expect(budget.scope).toBe("pooled_fragrance")
    expect(budget.ownership).toBe("known")
    expect(budget.knownOwnedMl).toBe(100)
    expect(budget.activeDestashMl).toBe(30) // 5+10+15
    expect(budget.reservedSplitMl).toBe(20)
    expect(budget.availableToAllocateMl).toBe(50) // 100-30-20
    expect(budget.mayAllocate).toBe(true)
  })

  it("excludes the listing being edited before applying a replacement", () => {
    const rows = [
      row({ id: "b1", perfumeId: "p", amount: "100", available: "0" }),
      row({ id: "d1", perfumeId: "p", available: "40" }),
      row({ id: "d2", perfumeId: "p", available: "30" }),
    ]
    const withoutExclude = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 0,
    })
    expect(withoutExclude.availableToAllocateMl).toBe(30)

    const editingD1 = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 0,
      excludeListingId: "d1",
    })
    expect(editingD1.activeDestashMl).toBe(30)
    expect(editingD1.availableToAllocateMl).toBe(70)

    expect(canAcceptAllocationMl(editingD1, "70")).toEqual({ ok: true, ml: 70 })
    expect(canAcceptAllocationMl(editingD1, "70.1").ok).toBe(false)
  })

  it("does not count paused listings against the pool", () => {
    const rows = [
      row({ id: "b1", perfumeId: "p", amount: "50", available: "0" }),
      row({
        id: "paused",
        perfumeId: "p",
        available: "0",
        pausedAvailable: "20",
      }),
      row({ id: "active", perfumeId: "p", available: "10" }),
    ]
    const budget = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 0,
    })
    expect(budget.activeDestashMl).toBe(10)
    expect(budget.availableToAllocateMl).toBe(40)
  })

  it("subtracts active split reservations", () => {
    const rows = [row({ id: "b1", perfumeId: "p", amount: "100", available: "0" })]
    const budget = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 40,
    })
    expect(budget.availableToAllocateMl).toBe(60)
    expect(canAcceptAllocationMl(budget, "60").ok).toBe(true)
    expect(canAcceptAllocationMl(budget, "60.1").reason).toBe("exceeds_available")
  })

  it("keeps completed poured ml consumed after reservation release", () => {
    const rows = [row({ id: "b1", perfumeId: "p", amount: "100", available: "0" })]
    // After complete: reserved=0 but consumedCompleted=30 must still block.
    const budget = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 0,
      consumedCompletedSplitMl: 30,
    })
    expect(budget.availableToAllocateMl).toBe(70)
    expect(canAcceptAllocationMl(budget, "71").reason).toBe("exceeds_available")
  })

  it("treats unknown / legacy owned amounts as non-allocatable (not unlimited)", () => {
    const rows = [
      row({ id: "b1", perfumeId: "p", amount: "full", available: "0" }),
      row({ id: "d1", perfumeId: "p", available: "5" }),
    ]
    const owned = sumKnownOwnedMlForPerfume(rows)
    expect(owned.ownership).toBe("unknown")
    expect(owned.unknownOwnedRowIds).toEqual(["b1"])

    const budget = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 0,
    })
    expect(budget.mayAllocate).toBe(false)
    expect(budget.availableToAllocateMl).toBe(0)
    expect(canAcceptAllocationMl(budget, "1").reason).toBe("ownership_unknown")
  })

  it("rejects positive allocation when there is no known owned volume", () => {
    const rows = [
      row({ id: "d1", perfumeId: "p", amount: "0", available: "0" }),
    ]
    const budget = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 0,
    })
    expect(budget.ownership).toBe("none")
    expect(canAcceptAllocationMl(budget, "5").reason).toBe("no_owned_volume")
    // Zero (pause/clear) does not consume volume
    expect(canAcceptAllocationMl(budget, "0")).toEqual({ ok: true, ml: 0 })
  })

  it("allows zero allocation when ownership is known (pause path)", () => {
    const rows = [
      row({ id: "b1", perfumeId: "p", amount: "50", available: "0" }),
      row({ id: "d1", perfumeId: "p", available: "50" }),
    ]
    const editing = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 0,
      excludeListingId: "d1",
    })
    expect(canAcceptAllocationMl(editing, "0")).toEqual({ ok: true, ml: 0 })
  })
})

describe("source bottle attribution vs pooled caps", () => {
  it("exposes bottle attribution without using it as a ceiling", () => {
    const rows = [
      row({ id: "b1", perfumeId: "p", amount: "30", available: "0" }),
      row({ id: "b2", perfumeId: "p", amount: "70", available: "0" }),
    ]
    const attribution = getSourceBottleAttribution(rows, "b1")
    expect(attribution?.scope).toBe("source_bottle_attribution")
    expect(attribution?.owned).toEqual({ status: "known", ml: 30 })

    const pooled = computePooledFragranceAllocation({
      rows,
      reservedSplitMl: 0,
    })
    // Pooled available is 100, not the source bottle's 30.
    expect(pooled.availableToAllocateMl).toBe(100)
    expect(pooled.scope).toBe("pooled_fragrance")
  })

  it("returns null when bottle id is not in the row set", () => {
    expect(
      getSourceBottleAttribution(
        [row({ id: "b1", perfumeId: "p", amount: "10" })],
        "missing"
      )
    ).toBeNull()
  })
})

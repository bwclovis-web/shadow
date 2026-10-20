import { describe, expect, it } from "vitest"

import {
  budgetFromFragrancePool,
  commitmentsExceedOwned,
  fragrancePoolLockKeys,
} from "@/models/fragrance-pool-lock.server"

describe("fragrancePoolLockKeys", () => {
  it("returns stable signed 32-bit pairs for the same user+perfume", () => {
    const a = fragrancePoolLockKeys("user-1", "perfume-a")
    const b = fragrancePoolLockKeys("user-1", "perfume-a")
    expect(a).toEqual(b)
    expect(Number.isInteger(a[0])).toBe(true)
    expect(Number.isInteger(a[1])).toBe(true)
  })

  it("differs across users or perfumes", () => {
    expect(fragrancePoolLockKeys("u1", "p1")).not.toEqual(
      fragrancePoolLockKeys("u2", "p1")
    )
    expect(fragrancePoolLockKeys("u1", "p1")).not.toEqual(
      fragrancePoolLockKeys("u1", "p2")
    )
  })
})

describe("commitmentsExceedOwned", () => {
  it("detects over-commitment after a simulated inventory reduction", () => {
    const ok = budgetFromFragrancePool({
      rows: [
        { id: "b1", perfumeId: "p", amount: "100", available: "0" },
        { id: "d1", perfumeId: "p", amount: "0", available: "40" },
      ],
      reservedSplitMl: 20,
      consumedCompletedSplitMl: 10,
      splits: [],
    })
    expect(commitmentsExceedOwned(ok)).toBe(false)

    const reduced = budgetFromFragrancePool({
      rows: [
        { id: "b1", perfumeId: "p", amount: "50", available: "0" },
        { id: "d1", perfumeId: "p", amount: "0", available: "40" },
      ],
      reservedSplitMl: 20,
      consumedCompletedSplitMl: 10,
      splits: [],
    })
    // 40+20+10 = 70 > 50
    expect(commitmentsExceedOwned(reduced)).toBe(true)
  })

  it("treats unknown ownership with active commitments as invalid", () => {
    const unknown = budgetFromFragrancePool({
      rows: [
        { id: "b1", perfumeId: "p", amount: "full", available: "0" },
        { id: "d1", perfumeId: "p", amount: "0", available: "5" },
      ],
      reservedSplitMl: 0,
      consumedCompletedSplitMl: 0,
      splits: [],
    })
    expect(commitmentsExceedOwned(unknown)).toBe(true)
  })
})

describe("concurrency evidence note", () => {
  it("documents that mocked tests do not prove DB serialization", () => {
    // Real cross-connection oversubscribe protection uses PostgreSQL
    // pg_advisory_xact_lock inside withFragrancePoolTransaction.
    // Enable models/fragrance-pool-concurrency.integration.test.ts with
    // ALLOCATION_CONCURRENCY_TEST=1 against an isolated database to prove it.
    expect(true).toBe(true)
  })
})

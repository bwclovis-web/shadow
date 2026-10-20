import { describe, expect, it } from "vitest"

import { canAcceptAllocationMl, computePooledFragranceAllocation } from "@/lib/decant-split-ml"
import {
  allocationErrorFromAccept,
  LISTING_ALLOCATION_ERROR_CODES,
} from "@/lib/listing-allocation-errors"

describe("allocationErrorFromAccept", () => {
  it("maps accept failures to structured API codes", () => {
    const budget = computePooledFragranceAllocation({
      rows: [{ id: "b", perfumeId: "p", amount: "10", available: "0" }],
      reservedSplitMl: 0,
    })
    const over = canAcceptAllocationMl(budget, "11")
    expect(over.ok).toBe(false)
    if (over.ok) return
    expect(allocationErrorFromAccept(over).errorCode).toBe(
      LISTING_ALLOCATION_ERROR_CODES.exceedsAvailable
    )

    const unknown = computePooledFragranceAllocation({
      rows: [{ id: "b", perfumeId: "p", amount: "full", available: "0" }],
      reservedSplitMl: 0,
    })
    const blocked = canAcceptAllocationMl(unknown, "1")
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(allocationErrorFromAccept(blocked).errorCode).toBe(
      LISTING_ALLOCATION_ERROR_CODES.ownershipUnknown
    )
  })
})

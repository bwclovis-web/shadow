import { describe, expect, it } from "vitest"

import { resolveOfferFillPercent } from "@/utils/exchange-offer-fill"

describe("resolveOfferFillPercent", () => {
  it("returns null without mlRemaining or capacity", () => {
    expect(resolveOfferFillPercent({ mlRemaining: null, amount: "50" })).toBeNull()
    expect(resolveOfferFillPercent({ mlRemaining: 40, amount: "" })).toBeNull()
    expect(resolveOfferFillPercent({ mlRemaining: 40, amount: "about half" })).toBeNull()
  })

  it("does not infer from condition-like strings", () => {
    expect(
      resolveOfferFillPercent({ mlRemaining: null, amount: "lightly used" })
    ).toBeNull()
  })

  it("computes percent from mlRemaining / amount", () => {
    expect(resolveOfferFillPercent({ mlRemaining: 45, amount: "50" })).toBe(90)
    expect(resolveOfferFillPercent({ mlRemaining: 50, amount: "50 ml" })).toBe(100)
  })

  it("rejects negative remaining", () => {
    expect(resolveOfferFillPercent({ mlRemaining: -1, amount: "50" })).toBeNull()
  })
})

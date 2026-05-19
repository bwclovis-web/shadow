import { describe, expect, it } from "vitest"

import { computeTradeMatchReasons } from "./computeTradeMatchReasons"

describe("computeTradeMatchReasons", () => {
  const viewer = {
    region: "United States",
    topFamilies: ["woods", "orientals"] as const,
  }

  const counterparty = {
    region: "US",
    topFamilies: ["woods", "citrus"] as const,
  }

  it("returns on_your_wishlist for matches_for_you surface", () => {
    const result = computeTradeMatchReasons({
      surface: "matches_for_you",
      viewer,
      counterparty,
    })
    expect(result.reasons.some(r => r.kind === "on_your_wishlist")).toBe(true)
    expect(result.primaryReasons[0]?.kind).toBe("on_your_wishlist")
  })

  it("includes scent_dna_overlap and same_region when data aligns", () => {
    const result = computeTradeMatchReasons({
      surface: "matches_for_you",
      viewer,
      counterparty,
    })
    expect(result.reasons.some(r => r.kind === "scent_dna_overlap")).toBe(true)
    expect(result.reasons.some(r => r.kind === "same_region")).toBe(true)
  })

  it("uses wishlist_overlap_depth on demand when count >= 2", () => {
    const result = computeTradeMatchReasons({
      surface: "wishlist_demand",
      viewer,
      counterparty,
      wishlistOverlapCount: 3,
    })
    expect(result.reasons.some(r => r.kind === "wishlist_overlap_depth")).toBe(
      true
    )
    expect(
      result.reasons.find(r => r.kind === "wishlist_overlap_depth")
    ).toMatchObject({ count: 3 })
  })

  it("fires trust reasons from reputation", () => {
    const result = computeTradeMatchReasons({
      surface: "matches_for_you",
      viewer,
      counterparty,
      reputation: {
        score: 85,
        badges: ["topReviewed", "fastResponder"],
        tradeReliabilityPercent: 90,
        completedTradeCount: 5,
      },
    })
    expect(result.reasons.some(r => r.kind === "top_rated_swapper")).toBe(true)
    expect(result.reasons.some(r => r.kind === "fast_responder")).toBe(true)
    expect(result.reasons.some(r => r.kind === "reliable_swapper")).toBe(true)
  })

  it("limits primaryReasons to two", () => {
    const result = computeTradeMatchReasons({
      surface: "matches_for_you",
      viewer,
      counterparty,
      reputation: {
        score: 90,
        badges: ["topReviewed", "fastResponder"],
        tradeReliabilityPercent: 95,
        completedTradeCount: 10,
      },
    })
    expect(result.primaryReasons).toHaveLength(2)
    expect(result.reasons.length).toBeGreaterThan(2)
  })
})

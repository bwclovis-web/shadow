import { describe, expect, it } from "vitest"

import { computeTraderReputationV1 } from "./computeReputation"
import { computeReplyStatsFromMessages } from "./loadReputationInputs.server"

function rep(
  feedback: { traderId?: string; averageRating: number | null; totalReviews: number },
  messageStats: {
    medianFirstReplyHours: number | null
    replySampleCount: number
  } = { medianFirstReplyHours: null, replySampleCount: 0 }
) {
  return computeTraderReputationV1({
    feedback: {
      traderId: feedback.traderId ?? "t1",
      averageRating: feedback.averageRating,
      totalReviews: feedback.totalReviews,
    },
    messageStats,
  })
}

describe("computeTraderReputationV1", () => {
  it("returns no score with no reviews", () => {
    const r = rep({ averageRating: null, totalReviews: 0 })
    expect(r.score).toBeNull()
    expect(r.insufficientDataReason).toBe("noReviews")
    expect(r.badges).toEqual([])
  })

  it("returns tooFewReviews when below minimum sample", () => {
    const r = rep({ averageRating: 5, totalReviews: 2 })
    expect(r.score).toBeNull()
    expect(r.insufficientDataReason).toBe("tooFewReviews")
  })

  it("computes rating-only score for three perfect reviews", () => {
    const r = rep({ averageRating: 5, totalReviews: 3 })
    expect(r.score).toBe(65)
    expect(r.insufficientDataReason).toBe("none")
  })

  it("reaches 100 for ten five-star reviews without response data", () => {
    const r = rep({ averageRating: 5, totalReviews: 10 })
    expect(r.score).toBe(100)
  })

  it("blends response timing when enough samples exist", () => {
    const r = rep(
      { averageRating: 4, totalReviews: 10 },
      { medianFirstReplyHours: 6, replySampleCount: 5 }
    )
    expect(r.score).toBe(81)
  })

  it("awards topReviewed and reliableTrader independently", () => {
    const topOnly = rep({ averageRating: 4.5, totalReviews: 5 })
    expect(topOnly.badges).toContain("topReviewed")
    expect(topOnly.badges).not.toContain("reliableTrader")

    const both = rep({ averageRating: 4.6, totalReviews: 10 })
    expect(both.badges).toContain("topReviewed")
    expect(both.badges).toContain("reliableTrader")
  })

  it("awards fastResponder when median reply is within threshold", () => {
    const r = rep(
      { averageRating: null, totalReviews: 0 },
      { medianFirstReplyHours: 24, replySampleCount: 5 }
    )
    expect(r.badges).toContain("fastResponder")
  })
})

describe("computeReplyStatsFromMessages", () => {
  it("measures first reply hours per counterparty", () => {
    const t0 = new Date("2025-01-01T12:00:00Z")
    const tReply = new Date("2025-01-01T18:00:00Z")
    const stats = computeReplyStatsFromMessages("trader", [
      { senderId: "u1", recipientId: "trader", createdAt: t0 },
      { senderId: "trader", recipientId: "u1", createdAt: tReply },
    ])
    expect(stats.replySampleCount).toBe(1)
    expect(stats.medianFirstReplyHours).toBe(6)
  })

  it("ignores pairs without a trader reply", () => {
    const stats = computeReplyStatsFromMessages("trader", [
      { senderId: "u1", recipientId: "trader", createdAt: new Date() },
    ])
    expect(stats.replySampleCount).toBe(0)
    expect(stats.medianFirstReplyHours).toBeNull()
  })
})

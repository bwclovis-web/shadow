import { describe, expect, it } from "vitest"

import { computeTraderReputationV1 } from "./computeReputation"
import { computeReplyStatsFromMessages } from "./loadReputationInputs.server"

function rep(
  feedback: { traderId?: string; averageRating: number | null; totalReviews: number },
  messageStats: {
    medianFirstReplyHours: number | null
    replySampleCount: number
  } = { medianFirstReplyHours: null, replySampleCount: 0 },
  tradeStats = {
    completedCount: 0,
    cancelledByTraderCount: 0,
    tradeReliabilityPercent: null as number | null,
  }
) {
  return computeTraderReputationV1({
    feedback: {
      traderId: feedback.traderId ?? "t1",
      averageRating: feedback.averageRating,
      totalReviews: feedback.totalReviews,
    },
    messageStats,
    tradeStats,
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

  it("awards fastResponder when median reply is within 24h threshold", () => {
    const r = rep(
      { averageRating: null, totalReviews: 0 },
      { medianFirstReplyHours: 20, replySampleCount: 3 }
    )
    expect(r.badges).toContain("fastResponder")
  })

  it("does not award fastResponder when median exceeds 24h", () => {
    const r = rep(
      { averageRating: null, totalReviews: 0 },
      { medianFirstReplyHours: 30, replySampleCount: 3 }
    )
    expect(r.badges).not.toContain("fastResponder")
  })

  it("exposes trade reliability percent from trade stats", () => {
    const r = rep(
      { averageRating: 5, totalReviews: 5 },
      { medianFirstReplyHours: null, replySampleCount: 0 },
      {
        completedCount: 8,
        cancelledByTraderCount: 2,
        tradeReliabilityPercent: 80,
      }
    )
    expect(r.completedTradeCount).toBe(8)
    expect(r.tradeReliabilityPercent).toBe(80)
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

  it("uses only the last 10 conversation partners by recent inbound", () => {
    const base = new Date("2025-06-01T12:00:00Z").getTime()
    const hour = 60 * 60 * 1000
    const messages: Parameters<typeof computeReplyStatsFromMessages>[1] = []

    for (let i = 0; i < 12; i++) {
      const partner = `u${i}`
      const inboundAt = new Date(base + i * hour)
      const replyAt = new Date(inboundAt.getTime() + (i < 2 ? 48 * hour : 2 * hour))
      messages.push(
        { senderId: partner, recipientId: "trader", createdAt: inboundAt },
        { senderId: "trader", recipientId: partner, createdAt: replyAt }
      )
    }

    const stats = computeReplyStatsFromMessages("trader", messages)
    expect(stats.replySampleCount).toBe(10)
    expect(stats.medianFirstReplyHours).toBe(2)
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearHelpfulnessVote,
  upsertHelpfulnessVote,
} from "./traderFeedbackHelpfulness.server"

const mockFindUnique = vi.fn()
const mockTransaction = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    traderFeedback: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}))

const feedbackRow = {
  id: "fb-1",
  traderId: "trader-1",
  reviewerId: "reviewer-1",
  helpfulCount: 2,
  unhelpfulCount: 0,
}

const createTx = (existingVote: { id: string; value: "helpful" | "unhelpful" } | null) => {
  const voteFindUnique = vi.fn().mockResolvedValue(existingVote)
  const voteDelete = vi.fn().mockResolvedValue({})
  const voteUpsert = vi.fn().mockResolvedValue({})
  const feedbackUpdate = vi.fn().mockResolvedValue({
    helpfulCount: existingVote ? 2 : 3,
    unhelpfulCount: 0,
  })
  const feedbackFindUnique = vi.fn().mockResolvedValue(feedbackRow)

  return {
    traderFeedbackHelpfulnessVote: {
      findUnique: voteFindUnique,
      delete: voteDelete,
      upsert: voteUpsert,
    },
    traderFeedback: {
      update: feedbackUpdate,
      findUnique: feedbackFindUnique,
    },
  }
}

describe("traderFeedbackHelpfulness.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue(feedbackRow)
  })

  it("rejects vote from review author", async () => {
    await expect(
      upsertHelpfulnessVote("fb-1", "reviewer-1", "helpful")
    ).rejects.toThrow(/own review/)
  })

  it("rejects vote from reviewed trader", async () => {
    await expect(
      upsertHelpfulnessVote("fb-1", "trader-1", "helpful")
    ).rejects.toThrow(/your profile/)
  })

  it("increments helpful count on new vote", async () => {
    const tx = createTx(null)
    mockTransaction.mockImplementation(async (fn) => fn(tx))

    const result = await upsertHelpfulnessVote("fb-1", "voter-1", "helpful")

    expect(tx.traderFeedbackHelpfulnessVote.upsert).toHaveBeenCalled()
    expect(tx.traderFeedback.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { helpfulCount: { increment: 1 }, unhelpfulCount: { increment: 0 } },
      })
    )
    expect(result.viewerVote).toBe("helpful")
  })

  it("clears vote when same value is toggled", async () => {
    const tx = createTx({ id: "vote-1", value: "helpful" })
    mockTransaction.mockImplementation(async (fn) => fn(tx))

    const result = await upsertHelpfulnessVote("fb-1", "voter-1", "helpful")

    expect(tx.traderFeedbackHelpfulnessVote.delete).toHaveBeenCalled()
    expect(result.viewerVote).toBeNull()
  })

  it("clearHelpfulnessVote is idempotent when no vote exists", async () => {
    const tx = createTx(null)
    mockTransaction.mockImplementation(async (fn) => fn(tx))

    const result = await clearHelpfulnessVote("fb-1", "voter-1")

    expect(tx.traderFeedbackHelpfulnessVote.delete).not.toHaveBeenCalled()
    expect(result.viewerVote).toBeNull()
  })
})

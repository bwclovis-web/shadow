import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreate = vi.fn()
const mockFindFirst = vi.fn()
const mockFindUnique = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    trade: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    tradeDispute: {
      create: (...args: unknown[]) => mockCreate(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

import { createTradeDispute } from "./trade-dispute.server"

describe("createTradeDispute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue({
      id: "trade-1",
      status: "accepted",
      initiatorId: "user-a",
      counterpartyId: "user-b",
    })
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: "dispute-1" })
  })

  it("rejects when an active dispute already exists", async () => {
    mockFindFirst.mockResolvedValue({ id: "existing" })
    const result = await createTradeDispute({
      initiatedByUserId: "user-a",
      tradeId: "trade-1",
      category: "noShip",
    })
    expect(result.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("creates a dispute for a trade participant", async () => {
    const result = await createTradeDispute({
      initiatedByUserId: "user-a",
      tradeId: "trade-1",
      category: "fakeItem",
      description: " Wrong item ",
    })
    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tradeId: "trade-1",
          initiatedByUserId: "user-a",
          otherPartyUserId: "user-b",
          category: "fakeItem",
          description: "Wrong item",
          status: "open",
        }),
      })
    )
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  userPerfumeFindManyMock,
  tradeFindManyMock,
  traderFeedbackFindManyMock,
  scentProfileFindUniqueMock,
} = vi.hoisted(() => ({
  userPerfumeFindManyMock: vi.fn(),
  tradeFindManyMock: vi.fn(),
  traderFeedbackFindManyMock: vi.fn(),
  scentProfileFindUniqueMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfume: { findMany: userPerfumeFindManyMock },
    trade: { findMany: tradeFindManyMock },
    traderFeedback: { findMany: traderFeedbackFindManyMock },
    scentProfile: { findUnique: scentProfileFindUniqueMock },
  },
}))

vi.mock("@/lib/sanity/articles.server", () => ({
  getPublishedArticlesWithRefs: vi.fn().mockResolvedValue([]),
}))

import { getScentJourneyForUser } from "./scent-journey.server"

describe("scent-journey.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userPerfumeFindManyMock.mockResolvedValue([])
    tradeFindManyMock.mockResolvedValue([])
    traderFeedbackFindManyMock.mockResolvedValue([])
    scentProfileFindUniqueMock.mockResolvedValue(null)
  })

  it("merges sources newest-first and respects limit", async () => {
    const old = new Date("2024-01-01T00:00:00.000Z")
    const mid = new Date("2024-06-01T00:00:00.000Z")
    const recent = new Date("2025-01-01T00:00:00.000Z")

    userPerfumeFindManyMock
      .mockResolvedValueOnce([
        {
          id: "up-1",
          createdAt: mid,
          perfumeId: "p-1",
          perfume: { name: "Aventus", slug: "aventus", image: null },
        },
      ])
      .mockResolvedValueOnce([])

    tradeFindManyMock.mockResolvedValue([
      {
        id: "t-1",
        updatedAt: recent,
        initiatorId: "u1",
        counterpartyId: "u2",
        initiator: {
          id: "u1",
          firstName: "A",
          lastName: "B",
          username: null,
          email: "a@example.com",
        },
        counterparty: {
          id: "u2",
          firstName: "C",
          lastName: "D",
          username: null,
          email: "c@example.com",
        },
        lineItems: [{ perfumeName: "Sauvage" }],
      },
    ])

    traderFeedbackFindManyMock.mockResolvedValue([
      {
        id: "fb-1",
        traderId: "u3",
        rating: 5,
        comment: "Great swapper",
        createdAt: old,
        trader: {
          id: "u3",
          firstName: "E",
          lastName: "F",
          username: null,
          email: "e@example.com",
        },
      },
    ])

    const result = await getScentJourneyForUser("u1", 2)

    expect(result).toHaveLength(2)
    expect(result[0]?.kind).toBe("trade_completed")
    expect(result[1]?.kind).toBe("bottle_added")
  })

  it("loads only completed trades for the trader", async () => {
    await getScentJourneyForUser("trader-1")

    expect(tradeFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "completed",
          OR: [{ initiatorId: "trader-1" }, { counterpartyId: "trader-1" }],
        }),
      })
    )
  })

  it("collapses scent DNA to a single latest event", async () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z")
    const lastQuizAt = new Date("2024-03-01T00:00:00.000Z")
    const updatedAt = new Date("2024-09-01T00:00:00.000Z")

    scentProfileFindUniqueMock.mockResolvedValue({
      createdAt,
      updatedAt,
      lastQuizAt,
    })

    const result = await getScentJourneyForUser("u1", 10)
    const dnaEvents = result.filter(item => item.kind === "scent_dna")

    expect(dnaEvents).toHaveLength(1)
    expect(dnaEvents[0]?.variant).toBe("refined")
  })

  it("dedupes bottle adds to one card per perfume", async () => {
    const recent = new Date("2025-06-01T00:00:00.000Z")
    const older = new Date("2024-01-01T00:00:00.000Z")

    userPerfumeFindManyMock
      .mockResolvedValueOnce([
        {
          id: "up-new",
          createdAt: recent,
          perfumeId: "p-1",
          perfume: { name: "Aventus", slug: "aventus", image: null },
        },
        {
          id: "up-old",
          createdAt: older,
          perfumeId: "p-1",
          perfume: { name: "Aventus", slug: "aventus", image: null },
        },
      ])
      .mockResolvedValueOnce([])

    const result = await getScentJourneyForUser("u1", 10)
    const bottles = result.filter(item => item.kind === "bottle_added")

    expect(bottles).toHaveLength(1)
    expect(bottles[0]?.userPerfumeId).toBe("up-new")
  })
})

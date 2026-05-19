import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    scentProfile: {
      findUnique: vi.fn(),
    },
    userPerfume: {
      count: vi.fn(),
    },
  },
}))

vi.mock("@/models/wishlist-matching.server", () => ({
  getWishlistExchangeMatches: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/services/recommendations", () => ({
  getPersonalizedRecommendations: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/services/reputation/loadReputationInputs.server", () => ({
  loadTraderReputationsForUserIds: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock("@/services/trade-match", () => ({
  enrichOnboardingMatches: vi.fn().mockResolvedValue([]),
}))

import { prisma } from "@/lib/db"
import {
  dismissOnboarding,
  getOnboardingState,
  syncOnboardingCompletion,
} from "@/models/onboarding.server"

describe("onboarding.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when onboarding is already completed", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      onboardingCompletedAt: new Date(),
      profileSlug: "jane",
      username: "jane",
    } as never)

    const state = await getOnboardingState("user-1")
    expect(state).toBeNull()
  })

  it("shows banner with quiz as active step for new users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      onboardingCompletedAt: null,
      profileSlug: "jane",
      username: "jane",
    } as never)
    vi.mocked(prisma.scentProfile.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.userPerfume.count).mockResolvedValue(0)

    const state = await getOnboardingState("user-1")
    expect(state?.showBanner).toBe(true)
    expect(state?.activeStep).toBe("quiz")
    expect(state?.steps.quiz).toBe(false)
  })

  it("sets onboardingCompletedAt when all steps are done", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        onboardingCompletedAt: null,
      } as never)
      .mockResolvedValueOnce({
        onboardingMatchesViewedAt: new Date(),
      } as never)
    vi.mocked(prisma.scentProfile.findUnique).mockResolvedValue({
      lastQuizAt: new Date(),
    } as never)
    vi.mocked(prisma.userPerfume.count).mockResolvedValue(1)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)

    await syncOnboardingCompletion("user-1")

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingCompletedAt: expect.any(Date) },
    })
  })

  it("dismissOnboarding sets onboardingCompletedAt", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)

    await dismissOnboarding("user-1")

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingCompletedAt: expect.any(Date) },
    })
  })
})

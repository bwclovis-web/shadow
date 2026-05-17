import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateScentProfileFromQuiz } from "./scent-profile.server"

vi.mock("@/lib/db", () => ({
  prisma: {
    scentProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/db"

const mockFindUnique = vi.mocked(prisma.scentProfile.findUnique)
const mockUpdate = vi.mocked(prisma.scentProfile.update)

const baseProfile = {
  id: "profile-1",
  userId: "user-1",
  noteWeights: { oldNote: 3, keptFromBehavior: 2 },
  avoidNoteIds: ["oldAvoid"],
  preferredPriceRange: { min: 50, max: 100 },
  preferredConcentration: "edp",
  preferredHouseTier: "niche",
  seasonHint: "winter",
  browsingStyle: "trader",
  lastQuizAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("updateScentProfileFromQuiz", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue({ ...baseProfile } as never)
    mockUpdate.mockImplementation(({ data }) =>
      Promise.resolve({ ...baseProfile, ...data } as never)
    )
  })

  it("merges note weights on first quiz completion", async () => {
    await updateScentProfileFromQuiz("user-1", {
      noteWeights: { newNote: 1 },
      avoidNoteIds: ["newAvoid"],
      seasonHints: ["spring"],
      browsingStyle: "explorer",
      preferredPriceRange: { min: 100, max: 200 },
      preferredConcentration: "edt",
      preferredHouseTier: "indie",
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          noteWeights: { oldNote: 3, keptFromBehavior: 2, newNote: 1 },
          avoidNoteIds: ["oldAvoid", "newAvoid"],
        }),
      })
    )
  })

  it("replaces prior quiz answers on retake", async () => {
    mockFindUnique.mockResolvedValue({
      ...baseProfile,
      lastQuizAt: new Date("2025-01-01"),
    } as never)

    await updateScentProfileFromQuiz("user-1", {
      noteWeights: { freshNote: 1 },
      avoidNoteIds: [],
      seasonHints: ["summer"],
      browsingStyle: "focused",
      preferredPriceRange: null,
      preferredConcentration: null,
      preferredHouseTier: null,
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          noteWeights: { freshNote: 1 },
          avoidNoteIds: [],
          seasonHint: "summer",
          browsingStyle: "focused",
          preferredConcentration: null,
          preferredHouseTier: null,
        }),
      })
    )
  })
})

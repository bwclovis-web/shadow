import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaPendingSubmissionUpdateMock = vi.fn()
const prismaPerfumeUpdateMock = vi.fn()
const prismaHouseUpdateMock = vi.fn()
const prismaUserFindManyMock = vi.fn()
const prismaPerfumeFindFirstMock = vi.fn()
const prismaPerfumeCreateMock = vi.fn()
const prismaUserPerfumeFindFirstMock = vi.fn()

const createPerfumeMock = vi.fn()
const createPerfumeHouseMock = vi.fn()
const getPerfumeHouseByNameMock = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    pendingSubmission: {
      update: (...args: unknown[]) => prismaPendingSubmissionUpdateMock(...args),
    },
    perfume: {
      update: (...args: unknown[]) => prismaPerfumeUpdateMock(...args),
      findFirst: (...args: unknown[]) => prismaPerfumeFindFirstMock(...args),
      create: (...args: unknown[]) => prismaPerfumeCreateMock(...args),
    },
    perfumeHouse: {
      update: (...args: unknown[]) => prismaHouseUpdateMock(...args),
    },
    user: {
      findMany: (...args: unknown[]) => prismaUserFindManyMock(...args),
    },
    userPerfume: {
      findFirst: (...args: unknown[]) => prismaUserPerfumeFindFirstMock(...args),
    },
  },
}))

vi.mock("./house.server", () => ({
  createPerfumeHouse: (...args: unknown[]) => createPerfumeHouseMock(...args),
  getPerfumeHouseByName: (...args: unknown[]) => getPerfumeHouseByNameMock(...args),
}))

vi.mock("./perfume.server", () => ({
  createPerfume: (...args: unknown[]) => createPerfumeMock(...args),
}))

vi.mock("./user.server", () => ({
  addUserPerfume: vi.fn(),
}))

vi.mock("./user-alerts.server", () => ({
  createUserAlert: vi.fn(),
}))

import { approvePendingSubmission } from "./pending-submission.server"

describe("approvePendingSubmission placeholder linkage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaPendingSubmissionUpdateMock.mockResolvedValue({})
    prismaPerfumeUpdateMock.mockResolvedValue({ id: "placeholder-perfume-1" })
    prismaHouseUpdateMock.mockResolvedValue({ id: "placeholder-house-1" })
    createPerfumeMock.mockResolvedValue({ id: "created-perfume-1" })
    createPerfumeHouseMock.mockResolvedValue({ success: true, data: { id: "created-house-1" } })
    getPerfumeHouseByNameMock.mockResolvedValue(null)
    prismaUserFindManyMock.mockResolvedValue([])
    prismaPerfumeFindFirstMock.mockResolvedValue(null)
    prismaPerfumeCreateMock.mockResolvedValue({ id: "system-admin-alerts" })
    prismaUserPerfumeFindFirstMock.mockResolvedValue(null)
  })

  it("updates placeholder perfume instead of creating a new perfume", async () => {
    const result = await approvePendingSubmission(
      {
        id: "submission-1",
        submissionType: "perfume",
        status: "pending",
        submittedBy: null,
        reviewedBy: null,
        reviewedAt: null,
        adminNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        submissionData: {
          name: "Unknown Scent",
          description: "Pending description",
          image: "/images/single-bottle.webp",
          house: "house-1",
          houseName: "Known House",
          placeholderPerfumeId: "placeholder-perfume-1",
        },
      },
      "admin-1"
    )

    expect(result.success).toBe(true)
    expect(prismaPerfumeUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "placeholder-perfume-1" },
        data: expect.objectContaining({
          isPending: false,
          submittedBy: null,
          pendingSubmissionId: null,
        }),
      })
    )
    expect(createPerfumeMock).not.toHaveBeenCalled()
  })

  it("updates placeholder house instead of creating a new house", async () => {
    const result = await approvePendingSubmission(
      {
        id: "submission-2",
        submissionType: "perfume_house",
        status: "pending",
        submittedBy: null,
        reviewedBy: null,
        reviewedAt: null,
        adminNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        submissionData: {
          name: "New House",
          description: "Pending house description",
          image: "/images/house-soon.webp",
          website: "https://example.com",
          placeholderHouseId: "placeholder-house-1",
        },
      },
      "admin-1"
    )

    expect(result.success).toBe(true)
    expect(prismaHouseUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "placeholder-house-1" },
        data: expect.objectContaining({
          isPending: false,
          submittedBy: null,
          pendingSubmissionId: null,
        }),
      })
    )
    expect(createPerfumeHouseMock).not.toHaveBeenCalled()
  })
})

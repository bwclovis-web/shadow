import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const authenticateUserMock = vi.fn()
const requireCSRFMock = vi.fn()
const validateRateLimitMock = vi.fn()
const getClientIdentifierFromHeadersMock = vi.fn()
const parseWithZodMock = vi.fn()
const getPerfumeHouseByIdMock = vi.fn()
const getPerfumeHouseByNameMock = vi.fn()
const createPendingPerfumeHousePlaceholderMock = vi.fn()
const createPendingSubmissionMock = vi.fn()
const createAdminAlertsForPendingSubmissionMock = vi.fn()
const createPendingPerfumePlaceholderMock = vi.fn()
const addUserPerfumeMock = vi.fn()
const perfumeFindFirstMock = vi.fn()
const perfumeUpdateMock = vi.fn()
const perfumeHouseUpdateMock = vi.fn()

vi.mock("@conform-to/zod", () => ({
  parseWithZod: (...args: unknown[]) => parseWithZodMock(...args),
}))

vi.mock("@/utils/server/auth.server", () => ({
  authenticateUser: (...args: unknown[]) => authenticateUserMock(...args),
}))

vi.mock("@/utils/server/csrf.server", () => ({
  requireCSRF: (...args: unknown[]) => requireCSRFMock(...args),
  CSRFError: class CSRFError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 403) {
      super(message)
      this.statusCode = statusCode
    }
  },
}))

vi.mock("@/utils/api-validation.server", () => ({
  validateRateLimit: (...args: unknown[]) => validateRateLimitMock(...args),
}))

vi.mock("@/utils/server/request.server", () => ({
  getClientIdentifierFromHeaders: (...args: unknown[]) =>
    getClientIdentifierFromHeadersMock(...args),
}))

vi.mock("@/models/house.server", () => ({
  getPerfumeHouseById: (...args: unknown[]) => getPerfumeHouseByIdMock(...args),
  getPerfumeHouseByName: (...args: unknown[]) => getPerfumeHouseByNameMock(...args),
  createPendingPerfumeHousePlaceholder: (...args: unknown[]) =>
    createPendingPerfumeHousePlaceholderMock(...args),
}))

vi.mock("@/models/pending-submission.server", () => ({
  createPendingSubmission: (...args: unknown[]) => createPendingSubmissionMock(...args),
  createAdminAlertsForPendingSubmission: (...args: unknown[]) =>
    createAdminAlertsForPendingSubmissionMock(...args),
}))

vi.mock("@/models/perfume.server", () => ({
  createPendingPerfumePlaceholder: (...args: unknown[]) =>
    createPendingPerfumePlaceholderMock(...args),
}))

vi.mock("@/models/user.server", () => ({
  addUserPerfume: (...args: unknown[]) => addUserPerfumeMock(...args),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    perfume: {
      findFirst: (...args: unknown[]) => perfumeFindFirstMock(...args),
      update: (...args: unknown[]) => perfumeUpdateMock(...args),
    },
    perfumeHouse: {
      update: (...args: unknown[]) => perfumeHouseUpdateMock(...args),
    },
  },
}))

import { POST } from "./route"

const makeRequest = (fields: Record<string, string>) => {
  const formData = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    formData.append(k, v)
  }
  return new NextRequest("http://localhost/api/user-perfumes/manual-entry", {
    method: "POST",
    body: formData,
  })
}

describe("POST /api/user-perfumes/manual-entry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateUserMock.mockResolvedValue({
      success: true,
      user: { id: "user-1" },
    })
    requireCSRFMock.mockResolvedValue(undefined)
    validateRateLimitMock.mockReturnValue(undefined)
    getClientIdentifierFromHeadersMock.mockReturnValue("127.0.0.1")
    parseWithZodMock.mockReturnValue({
      status: "success",
      value: {
        perfumeName: "Unknown Scent",
        existingHouseId: "house-1",
        customHouseName: "",
        amount: "50",
        type: "eauDeParfum",
        price: "",
        placeOfPurchase: "",
      },
    })
    getPerfumeHouseByIdMock.mockResolvedValue({
      id: "house-1",
      name: "Known House",
      isPending: false,
      submittedBy: null,
    })
    perfumeFindFirstMock.mockResolvedValue(null)
    createPendingPerfumePlaceholderMock.mockResolvedValue({
      id: "perfume-1",
      name: "Unknown Scent",
    })
    createPendingSubmissionMock.mockResolvedValue({ id: "pending-perfume-1" })
    perfumeUpdateMock.mockResolvedValue({ id: "perfume-1" })
    addUserPerfumeMock.mockResolvedValue({ success: true, id: "user-perfume-1" })
  })

  it("creates pending perfume submission for known house and adds to collection", async () => {
    const res = await POST(
      makeRequest({
        perfumeName: "Unknown Scent",
        existingHouseId: "house-1",
        amount: "50",
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(createPendingSubmissionMock).toHaveBeenCalledWith(
      "perfume",
      expect.objectContaining({
        name: "Unknown Scent",
        house: "house-1",
        placeholderPerfumeId: "perfume-1",
      }),
      "user-1"
    )
    expect(addUserPerfumeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        perfumeId: "perfume-1",
      })
    )
  })

  it("creates linked house+perfume submissions when custom house is missing", async () => {
    parseWithZodMock.mockReturnValue({
      status: "success",
      value: {
        perfumeName: "Fresh Mist",
        existingHouseId: "",
        customHouseName: "New House",
        amount: "40",
        type: "eauDeParfum",
        price: "",
        placeOfPurchase: "",
      },
    })
    getPerfumeHouseByNameMock.mockResolvedValue(null)
    createPendingPerfumeHousePlaceholderMock.mockResolvedValue({
      id: "house-pending-1",
      name: "New House",
    })
    createPendingSubmissionMock
      .mockResolvedValueOnce({ id: "house-sub-1" })
      .mockResolvedValueOnce({ id: "perfume-sub-1" })

    const res = await POST(
      makeRequest({
        perfumeName: "Fresh Mist",
        customHouseName: "New House",
        amount: "40",
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(createPendingSubmissionMock).toHaveBeenNthCalledWith(
      1,
      "perfume_house",
      expect.objectContaining({
        placeholderHouseId: "house-pending-1",
      }),
      "user-1"
    )
    expect(createPendingSubmissionMock).toHaveBeenNthCalledWith(
      2,
      "perfume",
      expect.objectContaining({
        pendingHouseSubmissionId: "house-sub-1",
      }),
      "user-1"
    )
  })
})

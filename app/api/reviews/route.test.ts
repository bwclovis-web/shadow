import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const authenticateUserMock = vi.fn()
const getPerfumeReviewsMock = vi.fn()

vi.mock("@/utils/server/auth.server", () => ({
  authenticateUser: (...args: unknown[]) => authenticateUserMock(...args),
}))

vi.mock("@/models/perfumeReview.server", () => ({
  createPerfumeReview: vi.fn(),
  deletePerfumeReview: vi.fn(),
  getPerfumeReviews: (...args: unknown[]) => getPerfumeReviewsMock(...args),
  getUserPerfumeReview: vi.fn(),
  moderatePerfumeReview: vi.fn(),
  updatePerfumeReview: vi.fn(),
}))

import { GET } from "./route"

const validPerfumeId = "clxxxxxxxxxxxxxxxxxxxxxxxxx"

describe("GET /api/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateUserMock.mockResolvedValue({ success: false })
    getPerfumeReviewsMock.mockResolvedValue({
      reviews: [
        {
          id: "review-1",
          review: "Nice scent",
          user: { id: "user-1", username: "sniffer", firstName: "Sam" },
        },
      ],
      pagination: { page: 1, limit: 10, totalCount: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    })
  })

  it("defaults to approved reviews for unauthenticated callers", async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/reviews?perfumeId=${validPerfumeId}`)
    )

    expect(response.status).toBe(200)
    expect(getPerfumeReviewsMock).toHaveBeenCalledWith(
      validPerfumeId,
      expect.objectContaining({ isApproved: true }),
      expect.any(Object)
    )
    const body = await response.json()
    expect(body.reviews[0].user).not.toHaveProperty("email")
  })

  it("rejects unapproved filter without admin auth", async () => {
    authenticateUserMock.mockResolvedValue({
      success: true,
      user: { id: "user-1", role: "user" },
    })

    const response = await GET(
      new NextRequest(
        `http://localhost/api/reviews?perfumeId=${validPerfumeId}&isApproved=false`
      )
    )

    expect(response.status).toBe(403)
    expect(getPerfumeReviewsMock).not.toHaveBeenCalled()
  })

  it("allows unapproved filter for editors", async () => {
    authenticateUserMock.mockResolvedValue({
      success: true,
      user: { id: "editor-1", role: "editor" },
    })

    const response = await GET(
      new NextRequest(
        `http://localhost/api/reviews?perfumeId=${validPerfumeId}&isApproved=false`
      )
    )

    expect(response.status).toBe(200)
    expect(getPerfumeReviewsMock).toHaveBeenCalledWith(
      validPerfumeId,
      expect.objectContaining({ isApproved: false }),
      expect.any(Object)
    )
  })
})

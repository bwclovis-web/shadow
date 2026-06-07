import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const authenticateUserMock = vi.fn()
const requireCSRFMock = vi.fn()
const getUserPerfumeByIdMock = vi.fn()
const getCommentsByUserPerfumeIdMock = vi.fn()
const addPerfumeCommentMock = vi.fn()

vi.mock("@/utils/server/auth.server", () => ({
  authenticateUser: (...args: unknown[]) => authenticateUserMock(...args),
}))

vi.mock("@/utils/server/csrf.server", () => ({
  requireCSRF: (...args: unknown[]) => requireCSRFMock(...args),
  CSRFError: class CSRFError extends Error {
    statusCode = 403
  },
}))

vi.mock("@/models/perfume.server", () => ({
  fetchAllPerfumesForCatalog: vi.fn(),
}))

vi.mock("@/models/user-inventory-stats.server", () => ({
  getUserInventoryStats: vi.fn(),
}))

vi.mock("@/models/user.server", () => ({
  addPerfumeComment: (...args: unknown[]) => addPerfumeCommentMock(...args),
  addUserPerfume: vi.fn(),
  createDestashEntry: vi.fn(),
  deletePerfumeComment: vi.fn(),
  getCommentsByUserPerfumeId: (...args: unknown[]) => getCommentsByUserPerfumeIdMock(...args),
  getUserPerfumeById: (...args: unknown[]) => getUserPerfumeByIdMock(...args),
  getUserPerfumes: vi.fn(),
  removeUserPerfume: vi.fn(),
  updateAvailableAmount: vi.fn(),
  updatePerfumeComment: vi.fn(),
  updateUserPerfumeAmount: vi.fn(),
}))

import { POST } from "./route"

const ownerId = "clxxxxxxxxxxxxxxxxxxxxxxxxx"
const otherUserId = "clyyyyyyyyyyyyyyyyyyyyyyyyy"
const listingId = "clzzzzzzzzzzzzzzzzzzzzzzzzz"
const perfumeId = "claaaaaaaaaaaaaaaaaaaaaaaaa"

const makePost = (formEntries: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(formEntries)) {
    formData.append(key, value)
  }
  return new NextRequest("http://localhost/api/user-perfumes", {
    method: "POST",
    body: formData,
  })
}

describe("POST /api/user-perfumes comment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireCSRFMock.mockResolvedValue(undefined)
    authenticateUserMock.mockResolvedValue({
      success: true,
      user: { id: ownerId },
    })
  })

  it("returns only public comments for non-owners", async () => {
    getUserPerfumeByIdMock.mockResolvedValue({
      id: listingId,
      userId: otherUserId,
      perfumeId,
    })
    getCommentsByUserPerfumeIdMock.mockResolvedValue([{ id: "comment-1", isPublic: true }])

    const response = await POST(
      makePost({
        action: "get-comments",
        userPerfumeId: listingId,
        _csrf: "token",
      })
    )

    expect(response.status).toBe(200)
    expect(getCommentsByUserPerfumeIdMock).toHaveBeenCalledWith(listingId, {
      publicOnly: true,
    })
  })

  it("returns all comments for listing owners", async () => {
    getUserPerfumeByIdMock.mockResolvedValue({
      id: listingId,
      userId: ownerId,
      perfumeId,
    })
    getCommentsByUserPerfumeIdMock.mockResolvedValue([
      { id: "comment-1", isPublic: true },
      { id: "comment-2", isPublic: false },
    ])

    const response = await POST(
      makePost({
        action: "get-comments",
        userPerfumeId: listingId,
        _csrf: "token",
      })
    )

    expect(response.status).toBe(200)
    expect(getCommentsByUserPerfumeIdMock).toHaveBeenCalledWith(listingId, {
      publicOnly: false,
    })
  })

  it("delegates add-comment to model with ownership validation", async () => {
    addPerfumeCommentMock.mockResolvedValue({ success: true, userComment: { id: "new-comment" } })

    const response = await POST(
      makePost({
        action: "add-comment",
        userPerfumeId: listingId,
        perfumeId,
        comment: "My note",
        _csrf: "token",
      })
    )

    expect(response.status).toBe(200)
    expect(addPerfumeCommentMock).toHaveBeenCalledWith({
      userId: ownerId,
      perfumeId,
      comment: "My note",
      isPublic: false,
      userPerfumeId: listingId,
    })
  })
})

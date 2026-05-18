import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const followMock = vi.fn()
const unfollowMock = vi.fn()
const getFollowerCountForUserMock = vi.fn()

vi.mock("@/models/user-follow.server", () => ({
  follow: (...args: unknown[]) => followMock(...args),
  unfollow: (...args: unknown[]) => unfollowMock(...args),
  getFollowerCountForUser: (...args: unknown[]) => getFollowerCountForUserMock(...args),
}))

vi.mock("@/utils/server/auth.server", () => ({
  authenticateUser: vi.fn(async () => ({
    success: true,
    user: { id: "viewer-1" },
  })),
}))

vi.mock("@/utils/server/csrf.server", () => ({
  requireCSRF: vi.fn(async () => undefined),
  CSRFError: class CSRFError extends Error {},
}))

vi.mock("@/utils/api-validation.server", () => ({
  validateRateLimit: vi.fn(),
}))

import { POST } from "./route"

describe("POST /api/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFollowerCountForUserMock.mockResolvedValue(2)
  })

  const makeRequest = (fields: Record<string, string>) => {
    const formData = new FormData()
    for (const [k, v] of Object.entries(fields)) {
      formData.append(k, v)
    }
    return new NextRequest("http://localhost/api/follow", {
      method: "POST",
      body: formData,
    })
  }

  it("follows a user", async () => {
    followMock.mockResolvedValue({ success: true, following: true })
    const res = await POST(
      makeRequest({
        action: "follow",
        targetType: "user",
        targetId: "clq2x9k000000000000000001",
      })
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.following).toBe(true)
    expect(json.followerCount).toBe(2)
  })

  it("unfollows a house", async () => {
    unfollowMock.mockResolvedValue({ success: true, following: false })
    const res = await POST(
      makeRequest({
        action: "unfollow",
        targetType: "house",
        targetId: "clq2x9k000000000000000001",
      })
    )
    const json = await res.json()
    expect(json.following).toBe(false)
  })
})

import type { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SessionUser } from "@/utils/session-from-request.server"

const mockRedirect = vi.fn<(url: string) => never>()
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    throw new Error(`REDIRECT:${url}`)
  },
}))

const mockGetCookieHeader = vi.fn()
vi.mock("@/utils/server/get-cookie-header.server", () => ({
  getCookieHeader: () => mockGetCookieHeader(),
}))

const mockGetSessionFromCookieHeader = vi.fn()
vi.mock("@/utils/session-from-request.server", () => ({
  getSessionFromCookieHeader: (...args: unknown[]) =>
    mockGetSessionFromCookieHeader(...args),
}))

const mockGetProfileSlug = vi.fn()
vi.mock("@/utils/user", () => ({
  getProfileSlug: (user: { id: string }) => mockGetProfileSlug(user),
}))

let requireOwnedProfileSession: (
  userSlug: string,
  options?: { subPath?: string }
) => Promise<{ user: SessionUser; session: { user: SessionUser } }>

const sessionUser: SessionUser = {
  id: "user-123",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  username: "testuser",
  role: "user" as UserRole,
}

beforeEach(async () => {
  vi.clearAllMocks()
  mockGetCookieHeader.mockResolvedValue("accessToken=abc")
  const mod = await import("./require-profile-session.server")
  requireOwnedProfileSession = mod.requireOwnedProfileSession
})

describe("requireOwnedProfileSession", () => {
  it("redirects to sign-in when session has no user", async () => {
    mockGetSessionFromCookieHeader.mockResolvedValue(null)

    await expect(requireOwnedProfileSession("testuser")).rejects.toThrow(
      "REDIRECT:/sign-in"
    )
    expect(mockRedirect).toHaveBeenCalledWith("/sign-in")
  })

  it("redirects to owned profile when slug does not match URL", async () => {
    mockGetSessionFromCookieHeader.mockResolvedValue({ userId: sessionUser.id, user: sessionUser })
    mockGetProfileSlug.mockReturnValue("correct-slug")

    await expect(requireOwnedProfileSession("wrong-slug")).rejects.toThrow(
      "REDIRECT:/correct-slug/profile"
    )
    expect(mockRedirect).toHaveBeenCalledWith("/correct-slug/profile")
  })

  it("redirects to owned profile sub-path when slug does not match URL", async () => {
    mockGetSessionFromCookieHeader.mockResolvedValue({ userId: sessionUser.id, user: sessionUser })
    mockGetProfileSlug.mockReturnValue("correct-slug")

    await expect(
      requireOwnedProfileSession("wrong-slug", { subPath: "wishlist" })
    ).rejects.toThrow("REDIRECT:/correct-slug/profile/wishlist")
    expect(mockRedirect).toHaveBeenCalledWith("/correct-slug/profile/wishlist")
  })

  it("returns user and session when slug matches", async () => {
    mockGetSessionFromCookieHeader.mockResolvedValue({ userId: sessionUser.id, user: sessionUser })
    mockGetProfileSlug.mockReturnValue("testuser")

    const result = await requireOwnedProfileSession("testuser")

    expect(result.user).toEqual(sessionUser)
    expect(result.session.user).toEqual(sessionUser)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("passes includeUser: true to getSessionFromCookieHeader", async () => {
    mockGetSessionFromCookieHeader.mockResolvedValue({ userId: sessionUser.id, user: sessionUser })
    mockGetProfileSlug.mockReturnValue("testuser")

    await requireOwnedProfileSession("testuser")

    expect(mockGetSessionFromCookieHeader).toHaveBeenCalledWith("accessToken=abc", {
      includeUser: true,
    })
  })
})

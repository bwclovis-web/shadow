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

const mockUserFindUnique = vi.fn()
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
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
  mockUserFindUnique.mockResolvedValue({
    isEarlyAdopter: false,
    subscriptionStatus: "paid",
  })
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
    mockGetSessionFromCookieHeader.mockResolvedValue({
      userId: sessionUser.id,
      user: sessionUser,
    })
    mockGetProfileSlug.mockReturnValue("correct-slug")

    await expect(requireOwnedProfileSession("wrong-slug")).rejects.toThrow(
      "REDIRECT:/correct-slug/profile"
    )
  })

  it("redirects to subscribe when user cannot participate", async () => {
    mockGetSessionFromCookieHeader.mockResolvedValue({
      userId: sessionUser.id,
      user: sessionUser,
    })
    mockGetProfileSlug.mockReturnValue("testuser")
    mockUserFindUnique.mockResolvedValue({
      isEarlyAdopter: false,
      subscriptionStatus: "free",
    })

    await expect(requireOwnedProfileSession("testuser")).rejects.toThrow(
      "REDIRECT:/subscribe?tier=member&redirect=%2Ftestuser%2Fprofile"
    )
  })

  it("returns user when slug matches and user can participate", async () => {
    mockGetSessionFromCookieHeader.mockResolvedValue({
      userId: sessionUser.id,
      user: sessionUser,
    })
    mockGetProfileSlug.mockReturnValue("testuser")

    const result = await requireOwnedProfileSession("testuser")

    expect(result.user).toEqual(sessionUser)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("allows grandfathered early adopters without paid status", async () => {
    mockGetSessionFromCookieHeader.mockResolvedValue({
      userId: sessionUser.id,
      user: sessionUser,
    })
    mockGetProfileSlug.mockReturnValue("testuser")
    mockUserFindUnique.mockResolvedValue({
      isEarlyAdopter: true,
      subscriptionStatus: "free",
    })

    const result = await requireOwnedProfileSession("testuser")
    expect(result.user).toEqual(sessionUser)
  })
})

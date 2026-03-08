import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateSession = vi.fn().mockResolvedValue({
  accessToken: "access",
  refreshToken: "refresh",
})
const mockRedirect = vi.fn(() => {
  const err = new Error("NEXT_REDIRECT")
  ;(err as unknown as { digest: string }).digest = "NEXT_REDIRECT"
  throw err
})

vi.mock("@/utils/security/session-manager.server", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}))
vi.mock("@/models/user.server", () => ({
  signInCustomer: vi.fn(),
}))
vi.mock("@/models/user.query", () => ({
  updateUser: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/utils/username-generator.server", () => ({
  generateUniqueUsername: vi.fn().mockResolvedValue("NoirShadow_7"),
}))
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn() }),
}))
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))
vi.mock("@/utils/server/csrf.server", () => ({ requireCSRF: vi.fn().mockResolvedValue(undefined) }))

import { updateUser } from "@/models/user.query"
import { signInCustomer } from "@/models/user.server"
import { generateUniqueUsername } from "@/utils/username-generator.server"
import { signInAction } from "./actions"

const mockSignInCustomer = vi.mocked(signInCustomer)
const mockUpdateUser = vi.mocked(updateUser)
const mockGenerateUniqueUsername = vi.mocked(generateUniqueUsername)

function formData(email = "user@example.com", password = "ValidPassword1!") {
  const fd = new FormData()
  fd.set("email", email)
  fd.set("password", password)
  return fd
}

describe("signInAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSession.mockResolvedValue({ accessToken: "a", refreshToken: "r" })
  })

  it("returns error when credentials are invalid", async () => {
    mockSignInCustomer.mockResolvedValue(null)
    const result = await signInAction(null, formData())
    expect(result).toEqual({ error: "Invalid email or password" })
    expect(mockCreateSession).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("when user has username, does not call generateUniqueUsername or updateUser and redirects to profile", async () => {
    mockSignInCustomer.mockResolvedValue({
      id: "user-1",
      username: "ExistingUser",
      tokenVersion: 0,
    } as Awaited<ReturnType<typeof signInCustomer>>)

    try {
      await signInAction(null, formData())
    } catch (e) {
      expect((e as Error).message).toBe("NEXT_REDIRECT")
    }

    expect(mockGenerateUniqueUsername).not.toHaveBeenCalled()
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith("/existinguser/profile")
  })

  it("when user has null username, generates username, updates user, and redirects with new slug", async () => {
    mockSignInCustomer.mockResolvedValue({
      id: "legacy-user-id",
      username: null,
      tokenVersion: 0,
    } as Awaited<ReturnType<typeof signInCustomer>>)
    mockGenerateUniqueUsername.mockResolvedValue("DarkAlley_42")

    try {
      await signInAction(null, formData())
    } catch (e) {
      expect((e as Error).message).toBe("NEXT_REDIRECT")
    }

    expect(mockGenerateUniqueUsername).toHaveBeenCalledTimes(1)
    expect(mockUpdateUser).toHaveBeenCalledTimes(1)
    expect(mockUpdateUser).toHaveBeenCalledWith("legacy-user-id", {
      username: "DarkAlley_42",
    })
    expect(mockRedirect).toHaveBeenCalledWith("/darkalley-42/profile")
  })

  it("when user has empty string username, backfills and redirects with new slug", async () => {
    mockSignInCustomer.mockResolvedValue({
      id: "user-empty",
      username: "   ",
      tokenVersion: 0,
    } as Awaited<ReturnType<typeof signInCustomer>>)
    mockGenerateUniqueUsername.mockResolvedValue("PaleShadow_99")

    try {
      await signInAction(null, formData())
    } catch {
      // redirect throws
    }

    expect(mockGenerateUniqueUsername).toHaveBeenCalledTimes(1)
    expect(mockUpdateUser).toHaveBeenCalledWith("user-empty", {
      username: "PaleShadow_99",
    })
    expect(mockRedirect).toHaveBeenCalledWith("/paleshadow-99/profile")
  })
})

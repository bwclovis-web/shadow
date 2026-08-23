import { beforeEach, describe, expect, it, vi } from "vitest"

const mockUserCreate = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
  },
}))

vi.mock("@/utils/security/password-security.server", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  validatePasswordComplexity: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
}))
vi.mock("@/utils/username-generator.server", () => ({
  generateUniqueUsername: vi.fn().mockResolvedValue("DarkAlley_42"),
}))
vi.mock("@/utils/profile-slug.server", () => ({
  allocateUniqueProfileSlug: vi.fn().mockResolvedValue("noirshadow-7"),
}))

import { createUser } from "./user.server"
import { allocateUniqueProfileSlug } from "@/utils/profile-slug.server"
import { generateUniqueUsername } from "@/utils/username-generator.server"

const mockGenerateUniqueUsername = vi.mocked(generateUniqueUsername)
const mockAllocateUniqueProfileSlug = vi.mocked(allocateUniqueProfileSlug)

const formData = (overrides: { email?: string; password?: string } = {}) => {
  const fd = new FormData()
  fd.set("email", overrides.email ?? "new@example.com")
  fd.set("password", overrides.password ?? "ValidPassword1!")
  return fd
}

describe("createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateUniqueUsername.mockResolvedValue("NoirShadow_7")
    mockUserCreate.mockResolvedValue({
      id: "user-123",
      email: "new@example.com",
      username: "NoirShadow_7",
      tokenVersion: 0,
    })
  })

  it("creates user with defaults (free tier, not early adopter)", async () => {
    const data = formData()
    await createUser(data)

    expect(mockGenerateUniqueUsername).toHaveBeenCalledTimes(1)
    expect(mockAllocateUniqueProfileSlug).toHaveBeenCalled()
    expect(mockUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        password: "hashed-password",
        username: "NoirShadow_7",
        profileSlug: "noirshadow-7",
        subscriptionStatus: "free",
        membershipTier: "free",
        isEarlyAdopter: false,
      }),
    })
  })

  it("includes membershipTier for paid signup", async () => {
    const data = formData()
    await createUser(data, {
      subscriptionStatus: "paid",
      membershipTier: "premium",
      isEarlyAdopter: false,
    })

    expect(mockUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriptionStatus: "paid",
        membershipTier: "premium",
        isEarlyAdopter: false,
      }),
    })
  })
})

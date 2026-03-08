import { beforeEach, describe, expect, it, vi } from "vitest"

const mockUserCreate = vi.fn()
const mockUserCount = vi.fn()
const mockTransaction = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      create: (...args: unknown[]) => mockUserCreate(...args),
      count: (...args: unknown[]) => mockUserCount(...args),
    },
    $transaction: (fn: (tx: any) => Promise<any>) => mockTransaction(fn),
  },
}))

vi.mock("@/utils/security/password-security.server", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  validatePasswordComplexity: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
}))
vi.mock("@/utils/server/user-limit.server", () => ({
  canSignupForFree: vi.fn().mockResolvedValue(true),
  FREE_USER_LIMIT: 100,
}))
vi.mock("@/utils/username-generator.server", () => ({
  generateUniqueUsername: vi.fn().mockResolvedValue("DarkAlley_42"),
}))

import { createUser, FreeSignupLimitReachedError } from "./user.server"
import { generateUniqueUsername } from "@/utils/username-generator.server"
import { canSignupForFree } from "@/utils/server/user-limit.server"

const mockGenerateUniqueUsername = vi.mocked(generateUniqueUsername)
const mockCanSignupForFree = vi.mocked(canSignupForFree)

function formData(overrides: { email?: string; password?: string } = {}) {
  const fd = new FormData()
  fd.set("email", overrides.email ?? "new@example.com")
  fd.set("password", overrides.password ?? "ValidPassword1!")
  return fd
}

describe("createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanSignupForFree.mockResolvedValue(true)
    mockGenerateUniqueUsername.mockResolvedValue("NoirShadow_7")
    mockUserCount.mockResolvedValue(0)
    mockUserCreate.mockResolvedValue({
      id: "user-123",
      email: "new@example.com",
      username: "NoirShadow_7",
      tokenVersion: 0,
    })
    mockTransaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        user: {
          count: mockUserCount,
          create: mockUserCreate,
        },
      }
      return fn(tx)
    })
  })

  it("calls generateUniqueUsername and includes username in create data (free signup path)", async () => {
    const data = formData()
    await createUser(data)

    expect(mockGenerateUniqueUsername).toHaveBeenCalledTimes(1)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        password: "hashed-password",
        username: "NoirShadow_7",
        subscriptionStatus: "free",
        isEarlyAdopter: true,
      }),
    })
  })

  it("includes username in create data for paid signup path", async () => {
    mockCanSignupForFree.mockResolvedValue(false)
    mockTransaction.mockClear()
    const data = formData()
    await createUser(data, { subscriptionStatus: "paid", isEarlyAdopter: false })

    expect(mockGenerateUniqueUsername).toHaveBeenCalledTimes(1)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        username: "NoirShadow_7",
        subscriptionStatus: "paid",
        isEarlyAdopter: false,
      }),
    })
  })

  it("uses transaction for free early-adopter path and passes username into tx.user.create", async () => {
    const data = formData()
    await createUser(data)

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    const createCall = mockUserCreate.mock.calls[0][0]
    expect(createCall.data.username).toBe("NoirShadow_7")
  })
})

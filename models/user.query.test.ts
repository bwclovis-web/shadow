import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/db"
import { getUserTokenVersion } from "./user.query"

const mockFindUnique = vi.mocked(prisma.user.findUnique)

describe("getUserTokenVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns tokenVersion when user exists", async () => {
    mockFindUnique.mockResolvedValue({ tokenVersion: 3 })
    const result = await getUserTokenVersion("user-123")
    expect(result).toBe(3)
    expect(mockFindUnique).toHaveBeenCalledTimes(1)
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: { tokenVersion: true },
    })
  })

  it("returns null when user does not exist", async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await getUserTokenVersion("missing-user")
    expect(result).toBeNull()
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "missing-user" },
      select: { tokenVersion: true },
    })
  })

  it("returns 0 when user has tokenVersion 0", async () => {
    mockFindUnique.mockResolvedValue({ tokenVersion: 0 })
    const result = await getUserTokenVersion("user-0")
    expect(result).toBe(0)
  })
})

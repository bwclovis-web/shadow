import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfumeWishlist: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/db"
import { getPublicWishlistForUser } from "@/models/wishlist.server"

describe("getPublicWishlistForUser", () => {
  beforeEach(() => {
    vi.mocked(prisma.userPerfumeWishlist.findMany).mockReset()
  })

  it("returns only public items for the user", async () => {
    const rows = [{ id: "w1", perfumeId: "p1", isPublic: true }]
    vi.mocked(prisma.userPerfumeWishlist.findMany).mockResolvedValue(rows as never)

    const result = await getPublicWishlistForUser("user-1")

    expect(result).toEqual(rows)
    expect(prisma.userPerfumeWishlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isPublic: true },
      })
    )
  })
})

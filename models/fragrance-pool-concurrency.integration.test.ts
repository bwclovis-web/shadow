/**
 * Optional DB concurrency proof for fragrance-pool advisory locks.
 *
 * Skipped unless:
 *   ALLOCATION_CONCURRENCY_TEST=1
 * and a database URL is available (LOCAL_DATABASE_URL or DATABASE_URL).
 *
 * Default CI / unit runs do **not** execute this file’s assertions — mocked
 * or sequential budget tests do not prove cross-connection serialization.
 */
import { afterAll, describe, expect, it } from "vitest"

const enabled = process.env.ALLOCATION_CONCURRENCY_TEST === "1"
const hasDb = Boolean(
  process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL
)

describe.skipIf(!enabled || !hasDb)(
  "fragrance pool concurrent allocations (isolated DB)",
  () => {
    afterAll(async () => {
      const { prisma } = await import("@/lib/db")
      await prisma.$disconnect()
    })

    it("two concurrent create-destash writers cannot oversubscribe one pool", async () => {
      const { prisma } = await import("@/lib/db")
      const { createDestashEntry } = await import(
        "@/models/user-inventory.server"
      )

      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const user = await prisma.user.create({
        data: {
          email: `alloc-concurrency-${suffix}@example.com`,
          username: `alloc_${suffix}`.slice(0, 30),
          password: "test-password-not-for-login",
        },
      })
      const house = await prisma.perfumeHouse.create({
        data: { name: `Alloc House ${suffix}`, slug: `alloc-house-${suffix}` },
      })
      const perfume = await prisma.perfume.create({
        data: {
          name: `Alloc Perfume ${suffix}`,
          slug: `alloc-perfume-${suffix}`,
          perfumeHouseId: house.id,
        },
      })
      await prisma.userPerfume.create({
        data: {
          userId: user.id,
          perfumeId: perfume.id,
          amount: "50",
          available: "0",
        },
      })

      try {
        const results = await Promise.all([
          createDestashEntry({
            userId: user.id,
            perfumeId: perfume.id,
            available: "40",
            listing: { images: ["https://example.com/a.jpg"], condition: null, decantFormat: null },
          }),
          createDestashEntry({
            userId: user.id,
            perfumeId: perfume.id,
            available: "40",
            listing: { images: ["https://example.com/b.jpg"], condition: null, decantFormat: null },
          }),
        ])

        const successes = results.filter(r => r.success)
        const failures = results.filter(r => !r.success)
        expect(successes).toHaveLength(1)
        expect(failures).toHaveLength(1)
        expect(failures[0]?.errorCode).toBe("exceedsAvailable")

        const listed = await prisma.userPerfume.findMany({
          where: { userId: user.id, perfumeId: perfume.id },
          select: { available: true },
        })
        const totalListed = listed.reduce(
          (sum, row) => sum + (parseFloat(row.available || "0") || 0),
          0
        )
        expect(totalListed).toBeLessThanOrEqual(50.05)
      } finally {
        await prisma.decantSplit.deleteMany({
          where: { hostUserId: user.id },
        })
        await prisma.userPerfumeComment.deleteMany({
          where: { userPerfume: { userId: user.id } },
        })
        await prisma.userPerfume.deleteMany({ where: { userId: user.id } })
        await prisma.perfume.delete({ where: { id: perfume.id } })
        await prisma.perfumeHouse.delete({ where: { id: house.id } })
        await prisma.user.delete({ where: { id: user.id } })
      }
    })
  }
)

describe("fragrance pool concurrency gate", () => {
  it("stays skipped without ALLOCATION_CONCURRENCY_TEST=1", () => {
    if (!enabled || !hasDb) {
      expect(enabled && hasDb).toBe(false)
    }
  })
})

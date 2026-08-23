/**
 * One-off backfill: mark the first FREE_USER_LIMIT users (by createdAt) as early adopters
 * so they keep profile access after the free signup window closes.
 *
 * Usage:
 *   npx tsx scripts/backfill-early-adopters.ts
 *   npx tsx scripts/backfill-early-adopters.ts --dry-run
 */
import { PrismaClient } from "@prisma/client"

import {
  FREE_USER_LIMIT,
  getCurrentUserCount,
} from "@/utils/server/user-limit.server"

const prisma = new PrismaClient()

const isDryRun = process.argv.includes("--dry-run")

const main = async () => {
  const totalUsers = await getCurrentUserCount()
  console.log(`Total users: ${totalUsers} (free limit: ${FREE_USER_LIMIT})`)

  const eligible = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    take: FREE_USER_LIMIT,
    select: { id: true, email: true, isEarlyAdopter: true, createdAt: true },
  })

  const toUpdate = eligible.filter((user) => !user.isEarlyAdopter)

  console.log(
    `Eligible for early adopter (${eligible.length} oldest users): ${toUpdate.length} need isEarlyAdopter=true`
  )

  if (toUpdate.length === 0) {
    console.log("Nothing to update.")
    return
  }

  if (isDryRun) {
    console.log("Dry run — would update:")
    for (const user of toUpdate) {
      console.log(`  ${user.email} (${user.id})`)
    }
    return
  }

  const result = await prisma.user.updateMany({
    where: { id: { in: toUpdate.map((user) => user.id) } },
    data: { isEarlyAdopter: true },
  })

  console.log(`Updated ${result.count} user(s) with isEarlyAdopter=true`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

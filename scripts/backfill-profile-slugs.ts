/**
 * One-off backfill: set `User.profileSlug` for rows where it is null.
 * Assigns collision-safe slugs (older users by `createdAt` win the base slug).
 *
 * From project root:
 *   1. npm run db:push   # after schema includes profileSlug
 *   2. npx tsx scripts/backfill-profile-slugs.ts
 *
 * Optional: after all rows are non-null, you may change `profileSlug` to `String` (NOT NULL)
 * in prisma/schema.prisma and run `npm run db:push` again.
 */

import { PrismaClient } from "@prisma/client"

import { allocateUniqueProfileSlug } from "../utils/profile-slug.server"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { profileSlug: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true },
  })

  console.log(`Backfilling profileSlug for ${users.length} user(s).`)

  for (const u of users) {
    const slug = await allocateUniqueProfileSlug(prisma, u.username, u.id)
    await prisma.user.update({
      where: { id: u.id },
      data: { profileSlug: slug },
    })
    console.log(`  ${u.id} -> ${slug}`)
  }

  console.log("Done.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })

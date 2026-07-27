/**
 * One-off: delete perfumes orphaned when Nicolai Parfum house was deleted.
 * Run: npx tsx scripts/cleanup-nicolai-orphans.ts
 * Dry run: npx tsx scripts/cleanup-nicolai-orphans.ts --dry-run
 */

import "dotenv/config"

import { PrismaClient } from "@prisma/client"

import { deletePerfumeWithRelatedData } from "@/models/perfume-delete.server"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

const main = async () => {
  const orphans = await prisma.perfume.findMany({
    where: {
      perfumeHouseId: null,
      OR: [
        { name: { contains: "Nicolai", mode: "insensitive" } },
        { slug: { contains: "nicolai", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  })

  console.log(`Found ${orphans.length} orphaned Nicolai perfume(s)`)
  for (const perfume of orphans) {
    console.log(`- ${perfume.name} (${perfume.slug})`)
  }

  if (dryRun || orphans.length === 0) {
    return
  }

  for (const perfume of orphans) {
    await deletePerfumeWithRelatedData(perfume.id)
    console.log(`Deleted ${perfume.name}`)
  }
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

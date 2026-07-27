/**
 * Delete all perfumes for a single house (house is kept).
 * Run: npx tsx scripts/delete-house-perfumes.ts --house-slug=<slug>
 * Dry run: npx tsx scripts/delete-house-perfumes.ts --house-slug=<slug> --dry-run
 */

import "dotenv/config"

import { PrismaClient } from "@prisma/client"

import { deletePerfumeWithRelatedData } from "@/models/perfume-delete.server"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

const houseSlugArg = process.argv.find(arg => arg.startsWith("--house-slug="))
const houseSlug = houseSlugArg?.split("=")[1]?.trim()

const main = async () => {
  const house = houseSlug
    ? await prisma.perfumeHouse.findUnique({
        where: { slug: houseSlug },
        select: { id: true, name: true, slug: true },
      })
    : await prisma.perfumeHouse.findFirst({
        where: {
          OR: [
            { name: { contains: "Nicolai", mode: "insensitive" } },
            { slug: { contains: "nicolai", mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, slug: true },
      })

  if (!house) {
    console.error("House not found")
    process.exitCode = 1
    return
  }

  const perfumes = await prisma.perfume.findMany({
    where: { perfumeHouseId: house.id },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  })

  console.log(`House: ${house.name} (${house.slug})`)
  console.log(`Perfumes to delete: ${perfumes.length}`)
  for (const perfume of perfumes) {
    console.log(`- ${perfume.name}`)
  }

  if (dryRun || perfumes.length === 0) {
    return
  }

  for (const perfume of perfumes) {
    await deletePerfumeWithRelatedData(perfume.id)
    console.log(`Deleted ${perfume.name}`)
  }

  console.log(`Done. Deleted ${perfumes.length} perfume(s) from ${house.name}.`)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

/**
 * Clean Area Of Effect duplicate perfumes:
 * - Each product has two "Name - Area Of Effect" rows (plain slug + "-1" slug)
 * - Keep the non-"-1" row, delete the twin (incl. R2 image)
 * - Keep the " - Area Of Effect" display name so cross-house same names stay distinct
 *
 * Run: npx tsx scripts/cleanup-aoe-suffix-duplicates.ts
 * Dry run: npx tsx scripts/cleanup-aoe-suffix-duplicates.ts --dry-run
 */

import "dotenv/config"

import { PrismaClient } from "@prisma/client"

import { deletePerfume } from "@/models/perfume-detail.server"

const prisma = new PrismaClient()

const HOUSE_SLUG = "area-of-effect"
const SUFFIX_RE = /\s*-\s*Area Of Effect$/i

const plainName = (name: string): string => name.replace(SUFFIX_RE, "").trim()

const main = async () => {
  const dryRun = process.argv.includes("--dry-run")
  if (dryRun) console.log("DRY RUN – no changes will be made.\n")

  const house = await prisma.perfumeHouse.findUnique({
    where: { slug: HOUSE_SLUG },
    select: { id: true, name: true },
  })
  if (!house) {
    console.error(`House slug "${HOUSE_SLUG}" not found`)
    process.exit(1)
  }
  console.log(`House: ${house.name} (${house.id})\n`)

  const suffixRows = await prisma.perfume.findMany({
    where: {
      perfumeHouseId: house.id,
      name: { contains: " - Area Of Effect" },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { perfumeNoteRelations: true } },
    },
    orderBy: { slug: "asc" },
  })

  const byPlain = new Map<string, typeof suffixRows>()
  for (const row of suffixRows) {
    const key = plainName(row.name).toLowerCase()
    if (!byPlain.has(key)) byPlain.set(key, [])
    byPlain.get(key)!.push(row)
  }

  let deleted = 0

  for (const [, rows] of [...byPlain.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const preferred =
      rows.find(r => !r.slug.endsWith("-1") && r.slug.includes("area-of-effect")) ??
      rows.find(r => !r.slug.endsWith("-1")) ??
      rows[0]!
    const toDelete = rows.filter(r => r.id !== preferred.id)

    console.log(`• ${preferred.name}`)
    console.log(
      `  keep:   ${preferred.slug} (${preferred._count.perfumeNoteRelations} notes)`,
    )
    for (const d of toDelete) {
      console.log(`  delete: ${d.slug}`)
      if (!dryRun) {
        await deletePerfume(d.id)
      }
      deleted++
    }
  }

  console.log(`\nDone. deleted=${deleted}${dryRun ? " (dry-run)" : ""}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

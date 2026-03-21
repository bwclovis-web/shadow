/**
 * Merge CocoaPink " - cc pink" duplicate perfumes: keep only the canonical (no suffix),
 * migrate any user data from the duplicate to the canonical, then delete the duplicate.
 *
 * Run from project root: npx tsx scripts/merge-cocoapink-cc-pink-duplicates.ts
 * Add --dry-run to only list what would be done.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const CC_PINK_SUFFIX = " - cc pink"

function isCcPinkDuplicate(name: string): boolean {
  return name.endsWith(CC_PINK_SUFFIX) || name.toLowerCase().endsWith(CC_PINK_SUFFIX.toLowerCase())
}

function getBaseName(name: string): string {
  if (name.toLowerCase().endsWith(CC_PINK_SUFFIX.toLowerCase())) {
    return name.slice(0, -CC_PINK_SUFFIX.length).trim()
  }
  return name
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  if (dryRun) {
    console.log("DRY RUN – no changes will be made.\n")
  }

  const house = await prisma.perfumeHouse.findFirst({
    where: {
      name: { in: ["CocoaPink", "Cocoa Pink"], mode: "insensitive" },
    },
  })

  if (!house) {
    console.log("CocoaPink house not found.")
    process.exit(1)
  }

  console.log(`Found house: ${house.name} (id: ${house.id})\n`)

  const allHousePerfumes = await prisma.perfume.findMany({
    where: { perfumeHouseId: house.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const ccPinkPerfumes = allHousePerfumes.filter((p) => isCcPinkDuplicate(p.name))
  const nameToCanonical = new Map<string, { id: string; name: string }>()
  for (const p of allHousePerfumes) {
    if (!isCcPinkDuplicate(p.name)) {
      const key = p.name.trim().toLowerCase()
      if (!nameToCanonical.has(key)) {
        nameToCanonical.set(key, { id: p.id, name: p.name })
      }
    }
  }

  const toMerge: { duplicate: { id: string; name: string }; canonical: { id: string; name: string } }[] = []
  const noCanonical: { id: string; name: string }[] = []

  for (const dup of ccPinkPerfumes) {
    const baseName = getBaseName(dup.name)
    const canonical = nameToCanonical.get(baseName.toLowerCase())
    if (canonical) {
      toMerge.push({ duplicate: dup, canonical })
    } else {
      noCanonical.push(dup)
    }
  }

  if (noCanonical.length > 0) {
    console.log("Perfumes with ' - cc pink' but no canonical (kept as-is):")
    noCanonical.forEach((p) => console.log(`  - ${p.name} (id: ${p.id})`))
    console.log("")
  }

  if (toMerge.length === 0) {
    console.log("No duplicate ' - cc pink' perfumes to merge.")
    process.exit(0)
  }

  console.log(`Merging ${toMerge.length} duplicate(s) into canonical perfumes:\n`)

  for (const { duplicate, canonical } of toMerge) {
    console.log(`  "${duplicate.name}" → "${canonical.name}" (canonical id: ${canonical.id})`)

    if (dryRun) {
      console.log("    [dry-run] would migrate references and delete duplicate")
      continue
    }

    const dupId = duplicate.id
    const canId = canonical.id

    await prisma.$transaction(async (tx) => {
      const userPerfumeCount = await tx.userPerfume.updateMany({
        where: { perfumeId: dupId },
        data: { perfumeId: canId },
      })
      if (userPerfumeCount.count > 0) {
        console.log(`    UserPerfume: ${userPerfumeCount.count} updated`)
      }

      const comments = await tx.userPerfumeComment.findMany({
        where: { perfumeId: dupId },
        select: { id: true, userId: true },
      })
      for (const c of comments) {
        await tx.userPerfumeComment.update({
          where: { id: c.id },
          data: { perfumeId: canId },
        })
      }
      if (comments.length > 0) {
        console.log(`    UserPerfumeComment: ${comments.length} updated`)
      }

      const ratings = await tx.userPerfumeRating.findMany({ where: { perfumeId: dupId } })
      for (const r of ratings) {
        const existing = await tx.userPerfumeRating.findUnique({
          where: { userId_perfumeId: { userId: r.userId, perfumeId: canId } },
        })
        if (existing) {
          await tx.userPerfumeRating.delete({ where: { id: r.id } })
        } else {
          await tx.userPerfumeRating.update({
            where: { id: r.id },
            data: { perfumeId: canId },
          })
        }
      }
      if (ratings.length > 0) {
        console.log(`    UserPerfumeRating: ${ratings.length} migrated`)
      }

      const reviews = await tx.userPerfumeReview.findMany({ where: { perfumeId: dupId } })
      for (const r of reviews) {
        const existing = await tx.userPerfumeReview.findUnique({
          where: { userId_perfumeId: { userId: r.userId, perfumeId: canId } },
        })
        if (existing) {
          await tx.userPerfumeReview.delete({ where: { id: r.id } })
        } else {
          await tx.userPerfumeReview.update({
            where: { id: r.id },
            data: { perfumeId: canId },
          })
        }
      }
      if (reviews.length > 0) {
        console.log(`    UserPerfumeReview: ${reviews.length} migrated`)
      }

      const wishlists = await tx.userPerfumeWishlist.findMany({ where: { perfumeId: dupId } })
      for (const w of wishlists) {
        const existing = await tx.userPerfumeWishlist.findUnique({
          where: { userId_perfumeId: { userId: w.userId, perfumeId: canId } },
        })
        if (existing) {
          await tx.userPerfumeWishlist.delete({ where: { id: w.id } })
        } else {
          await tx.userPerfumeWishlist.update({
            where: { id: w.id },
            data: { perfumeId: canId },
          })
        }
      }
      if (wishlists.length > 0) {
        console.log(`    UserPerfumeWishlist: ${wishlists.length} migrated`)
      }

      const notifications = await tx.wishlistNotification.findMany({ where: { perfumeId: dupId } })
      for (const n of notifications) {
        const existing = await tx.wishlistNotification.findUnique({
          where: { userId_perfumeId: { userId: n.userId, perfumeId: canId } },
        })
        if (existing) {
          await tx.wishlistNotification.delete({ where: { id: n.id } })
        } else {
          await tx.wishlistNotification.update({
            where: { id: n.id },
            data: { perfumeId: canId },
          })
        }
      }
      if (notifications.length > 0) {
        console.log(`    WishlistNotification: ${notifications.length} migrated`)
      }

      await tx.userAlert.updateMany({
        where: { perfumeId: dupId },
        data: { perfumeId: canId },
      })

      await tx.perfume.delete({ where: { id: dupId } })
      console.log(`    Deleted duplicate perfume ${dupId}`)
    })
  }

  console.log("\nDone.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

/**
 * Seed sample community challenges (additive upsert by slug).
 * Usage: npx tsx scripts/seed-community-challenges.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const challenges = [
  {
    slug: "vanilla-but-make-it-weird",
    title: "Vanilla, But Make It Weird",
    description:
      "Share a vanilla that isn’t bakery — smoked, woody, animalic, or incense. Pick one bottle and tell us why it works.",
    daysOpen: 14,
  },
  {
    slug: "first-frost",
    title: "First Frost",
    description:
      "Cold air, metallic edges, incense, or skin-close musks for early winter. Log what you’re wearing when the temperature drops.",
    daysOpen: 21,
  },
  {
    slug: "blind-buy-bravery",
    title: "Blind Buy Bravery",
    description:
      "A perfume you bought without smelling first — and how it went. Caption the surprise (good or bad).",
    daysOpen: 10,
  },
]

const main = async () => {
  const now = new Date()
  for (const c of challenges) {
    const endsAt = new Date(now.getTime() + c.daysOpen * 86_400_000)
    await prisma.communityChallenge.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        title: c.title,
        description: c.description,
        startsAt: now,
        endsAt,
        isPublished: true,
      },
      update: {
        title: c.title,
        description: c.description,
        endsAt,
        isPublished: true,
      },
    })
    console.log(`Upserted challenge: ${c.slug}`)
  }
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

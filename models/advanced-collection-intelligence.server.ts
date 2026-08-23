import { prisma } from "@/lib/db"
import { isCollectionBottle } from "@/lib/user-inventory"
import { classifyNoteNameToFamily } from "@/utils/scent-dna/note-families"
import { getScentDnaForUser } from "@/models/scent-dna.server"
import { requireEntitlement } from "@/utils/membership/entitlements.server"

export type RedundancyCluster = {
  family: string
  count: number
  perfumeNames: string[]
}

export type CollectionGap = {
  family: string
  message: string
}

export type DecantBottleMix = {
  fullBottles: number
  decants: number
  unknown: number
}

export type AdvancedCollectionIntelligence = {
  redundancy: RedundancyCluster[]
  gaps: CollectionGap[]
  mix: DecantBottleMix
}

/**
 * Premium advanced collection insights: redundancy, gaps, decant mix (Phase 4.2).
 */
export const getAdvancedCollectionIntelligence = async (
  userId: string
): Promise<AdvancedCollectionIntelligence | null> => {
  const gate = await requireEntitlement(userId, "collection_analytics")
  if (!gate.ok) return null

  const [bottles, dna] = await Promise.all([
    prisma.userPerfume.findMany({
      where: { userId },
      select: {
        id: true,
        perfumeId: true,
        amount: true,
        available: true,
        decantFormat: true,
        mlRemaining: true,
        perfume: {
          select: {
            name: true,
            perfumeNoteRelations: {
              take: 8,
              select: { note: { select: { name: true } } },
            },
          },
        },
      },
    }),
    getScentDnaForUser(userId),
  ])

  const collection = bottles.filter(isCollectionBottle)
  const familyToNames = new Map<string, string[]>()

  for (const row of collection) {
    const families = new Set(
      row.perfume.perfumeNoteRelations
        .map(r => classifyNoteNameToFamily(r.note.name))
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
    )
    for (const family of families) {
      const list = familyToNames.get(family) ?? []
      if (!list.includes(row.perfume.name)) list.push(row.perfume.name)
      familyToNames.set(family, list)
    }
  }

  const redundancy: RedundancyCluster[] = [...familyToNames.entries()]
    .filter(([, names]) => names.length >= 3)
    .map(([family, perfumeNames]) => ({
      family,
      count: perfumeNames.length,
      perfumeNames: perfumeNames.slice(0, 6),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const ownedFamilies = new Set(familyToNames.keys())
  const gaps: CollectionGap[] = dna.topFamilies
    .filter(f => !ownedFamilies.has(f.family))
    .map(f => ({
      family: f.family,
      message: `You love ${f.family}, but own little or none of it.`,
    }))
    .slice(0, 4)

  let fullBottles = 0
  let decants = 0
  let unknown = 0
  for (const row of collection) {
    if (row.decantFormat === "atomizer" || row.decantFormat === "vial") {
      decants += 1
    } else if (row.decantFormat === "original") {
      fullBottles += 1
    } else {
      unknown += 1
    }
  }

  return {
    redundancy,
    gaps,
    mix: { fullBottles, decants, unknown },
  }
}

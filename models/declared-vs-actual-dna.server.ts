import { prisma } from "@/lib/db"
import {
  buildScentDnaSnapshot,
  type ScentDnaSnapshot,
} from "@/utils/scent-dna/compute-scent-dna"
import { getScentDnaForUser } from "@/models/scent-dna.server"
import type { NoteFamilyId } from "@/utils/scent-dna/note-families"

export type DeclaredVsActualDna = {
  declared: ScentDnaSnapshot
  actual: ScentDnaSnapshot
  /** Families strong in quiz but weak on shelf. */
  quizSays: NoteFamilyId[]
  /** Families strong on shelf but weak in quiz. */
  shelfSays: NoteFamilyId[]
  narrative: string | null
}

/**
 * Collection-derived Scent DNA from owned bottle notes (Phase 4.1).
 */
export const getCollectionDerivedDna = async (
  userId: string
): Promise<ScentDnaSnapshot> => {
  const [collectionRows, seasonVotes] = await Promise.all([
    prisma.userPerfume.findMany({
      where: { userId },
      select: {
        perfume: {
          select: {
            perfumeHouse: { select: { type: true } },
            perfumeNoteRelations: {
              take: 12,
              select: { note: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.userPerfumeSeasonVote.findMany({
      where: { userId },
      select: { winter: true, spring: true, summer: true, fall: true },
    }),
  ])

  const noteWeights: Record<string, number> = {}
  const noteNameById = new Map<string, string>()
  for (const row of collectionRows) {
    for (const rel of row.perfume.perfumeNoteRelations) {
      noteWeights[rel.note.id] = (noteWeights[rel.note.id] ?? 0) + 1
      noteNameById.set(rel.note.id, rel.note.name)
    }
  }

  const houseTypes = collectionRows.map(
    row => row.perfume.perfumeHouse?.type ?? null
  )

  return buildScentDnaSnapshot({
    noteWeights,
    noteNameById,
    seasonVotes,
    houseTypes,
  })
}

export const getDeclaredVsActualDna = async (
  userId: string
): Promise<DeclaredVsActualDna> => {
  const [declared, actual] = await Promise.all([
    getScentDnaForUser(userId),
    getCollectionDerivedDna(userId),
  ])

  const declaredTop = declared.topFamilies.slice(0, 3).map(f => f.family)
  const actualTop = actual.topFamilies.slice(0, 3).map(f => f.family)
  const declaredSet = new Set(declaredTop)
  const actualSet = new Set(actualTop)

  const quizSays = declaredTop.filter(f => !actualSet.has(f))
  const shelfSays = actualTop.filter(f => !declaredSet.has(f))

  let narrative: string | null = null
  if (quizSays.length > 0 || shelfSays.length > 0) {
    const parts: string[] = []
    if (quizSays.length > 0) {
      parts.push(`Your quiz leans ${quizSays.join(", ")}`)
    }
    if (shelfSays.length > 0) {
      parts.push(`your shelf leans ${shelfSays.join(", ")}`)
    }
    narrative = parts.join("; ") + "."
  } else if (declaredTop.length > 0 && actualTop.length > 0) {
    narrative = "Your quiz and shelf tell a consistent story."
  }

  return { declared, actual, quizSays, shelfSays, narrative }
}

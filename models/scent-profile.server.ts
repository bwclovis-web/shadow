import { Prisma } from "@prisma/client"
import { prisma } from "~/db.server"

/** Empty profile shape for new users (no quiz, no behavior yet). */
const EMPTY_NOTE_WEIGHTS: Record<string, number> = {}
const EMPTY_AVOID_IDS: string[] = []

/** Quiz payload from onboarding scent quiz. */
export type ScentQuizData = {
  noteWeights?: Record<string, number>
  avoidNoteIds?: string[]
  preferredPriceRange?: { min?: number; max?: number } | null
  /** Preferred seasons (multi-select). Stored in DB as comma-separated in seasonHint. */
  seasonHints?: ("spring" | "summer" | "fall" | "winter")[] | null
  browsingStyle?: "explorer" | "focused" | "trader" | null
}

/** Behavior event for profile evolution (rating, wishlist, collection). */
export type ScentProfileBehaviorEvent =
  | { type: "rating"; perfumeId: string; overall: number }
  | { type: "wishlist"; perfumeId: string }
  | { type: "collection"; perfumeId: string }

/** Weight delta applied per note when user likes a perfume (rating ≥4, wishlist, collection). */
const BEHAVIOR_WEIGHT_DELTA = 1

/** Get note IDs for a perfume from PerfumeNoteRelation. Shared by scent profile and recommendations. */
export async function getNoteIdsForPerfume(perfumeId: string): Promise<string[]> {
  const relations = await prisma.perfumeNoteRelation.findMany({
    where: { perfumeId },
    select: { noteId: true },
  })
  return [...new Set(relations.map(r => r.noteId))]
}

/**
 * Returns the user's ScentProfile, or creates an empty one if none exists.
 * Use this so behavior-based evolution can run for users who skipped the quiz.
 * Handles concurrent create: on unique-constraint (P2002), fetches the profile
 * created by the other request instead of throwing.
 */
export async function getOrCreateScentProfile(userId: string) {
  if (!prisma.scentProfile) {
    throw new Error(
      "Prisma client missing ScentProfile model. Run: npx prisma generate"
    )
  }
  const existing = await prisma.scentProfile.findUnique({
    where: { userId },
  })
  if (existing) return existing

  try {
    return await prisma.scentProfile.create({
      data: {
        userId,
        noteWeights: EMPTY_NOTE_WEIGHTS as object,
        avoidNoteIds: EMPTY_AVOID_IDS as string[],
        preferredPriceRange: Prisma.JsonNull,
        seasonHint: null,
        browsingStyle: null,
        lastQuizAt: null,
      },
    })
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined
    if (code === "P2002") {
      const created = await prisma.scentProfile.findUnique({
        where: { userId },
      })
      if (created) return created
    }
    throw err
  }
}

/**
 * Persists onboarding quiz answers into the user's ScentProfile.
 * Merges with existing profile (behavior data is preserved): quiz note weights
 * are added to existing weights, and quiz avoid IDs are unioned with existing.
 * Sets lastQuizAt to now.
 */
export async function updateScentProfileFromQuiz(
  userId: string,
  quizData: ScentQuizData
) {
  const profile = await getOrCreateScentProfile(userId)
  const existingWeights = (profile.noteWeights as Record<string, number>) ?? {}
  const existingAvoidIds = (profile.avoidNoteIds as string[]) ?? []

  const noteWeights =
    quizData.noteWeights !== undefined
      ? (() => {
          const merged = { ...existingWeights }
          const quizWeights = quizData.noteWeights as Record<string, number>
          for (const [noteId, weight] of Object.entries(quizWeights)) {
            merged[noteId] = (merged[noteId] ?? 0) + weight
          }
          return merged
        })()
      : existingWeights

  const avoidNoteIds =
    quizData.avoidNoteIds !== undefined && quizData.avoidNoteIds.length > 0
      ? [...new Set([...existingAvoidIds, ...quizData.avoidNoteIds])]
      : existingAvoidIds

  return prisma.scentProfile.update({
    where: { id: profile.id },
    data: {
      noteWeights: noteWeights as object,
      avoidNoteIds: avoidNoteIds as string[],
      preferredPriceRange:
        quizData.preferredPriceRange !== undefined
          ? (quizData.preferredPriceRange as object)
          : (profile.preferredPriceRange as object),
      seasonHint:
        Array.isArray(quizData.seasonHints)
          ? quizData.seasonHints.length > 0
            ? quizData.seasonHints.join(",")
            : null
          : profile.seasonHint,
      browsingStyle: quizData.browsingStyle ?? profile.browsingStyle,
      lastQuizAt: new Date(),
    },
  })
}

/**
 * Evolves the ScentProfile from a single behavior event:
 * - rating (overall ≥4): increment noteWeights for the perfume's notes
 * - rating (overall ≤2): add the perfume's notes to avoidNoteIds
 * - wishlist / collection: increment noteWeights for the perfume's notes
 *
 * Uses a transaction with SELECT FOR UPDATE so concurrent updates do not
 * overwrite each other (no lost updates on noteWeights/avoidNoteIds).
 */
export async function updateScentProfileFromBehavior(
  userId: string,
  event: ScentProfileBehaviorEvent
) {
  const noteIds = await getNoteIdsForPerfume(event.perfumeId)
  if (noteIds.length === 0) return getOrCreateScentProfile(userId)

  return prisma.$transaction(async (tx) => {
    type LockedRow = {
      id: string
      userId: string
      noteWeights: unknown
      avoidNoteIds: unknown
    }
    let rows = await tx.$queryRaw<LockedRow[]>`
      SELECT id, "userId", "noteWeights", "avoidNoteIds"
      FROM "ScentProfile"
      WHERE "userId" = ${userId}
      FOR UPDATE
    `
    if (rows.length === 0) {
      try {
        await tx.scentProfile.create({
          data: {
            userId,
            noteWeights: EMPTY_NOTE_WEIGHTS as object,
            avoidNoteIds: EMPTY_AVOID_IDS as string[],
            preferredPriceRange: Prisma.JsonNull,
            seasonHint: null,
            browsingStyle: null,
            lastQuizAt: null,
          },
        })
      } catch (err: unknown) {
        const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined
        if (code !== "P2002") throw err
      }
      rows = await tx.$queryRaw<LockedRow[]>`
        SELECT id, "userId", "noteWeights", "avoidNoteIds"
        FROM "ScentProfile"
        WHERE "userId" = ${userId}
        FOR UPDATE
      `
      if (rows.length === 0) throw new Error("ScentProfile get-or-create failed under transaction")
    }
    const row = rows[0]!
    const weights = { ...((row.noteWeights as Record<string, number>) ?? {}) }
    let avoidIds = [...((row.avoidNoteIds as string[]) ?? [])]

    if (event.type === "rating") {
      if (event.overall >= 4) {
        for (const noteId of noteIds) {
          weights[noteId] = (weights[noteId] ?? 0) + BEHAVIOR_WEIGHT_DELTA
        }
      } else if (event.overall <= 2) {
        for (const noteId of noteIds) {
          if (!avoidIds.includes(noteId)) avoidIds.push(noteId)
        }
      }
    } else {
      for (const noteId of noteIds) {
        weights[noteId] = (weights[noteId] ?? 0) + BEHAVIOR_WEIGHT_DELTA
      }
    }

    return tx.scentProfile.update({
      where: { id: row.id },
      data: {
        noteWeights: weights as object,
        avoidNoteIds: avoidIds as string[],
      },
    })
  })
}

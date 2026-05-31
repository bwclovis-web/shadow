import { Prisma } from "@prisma/client"
import { resolveNoteToMaterialId } from "@/lib/note-materials"
import { prisma } from "@/lib/db"
import { getNoteMaterialIndex } from "@/models/note-materials.server"

const EMPTY_NOTE_WEIGHTS: Record<string, number> = {}
const EMPTY_AVOID_IDS: string[] = []
const EMPTY_MATERIAL_WEIGHTS: Record<string, number> = {}
const EMPTY_MATERIAL_AVOID_IDS: string[] = []
const BEHAVIOR_WEIGHT_DELTA = 1

const createEmptyProfileData = () => ({
  noteWeights: EMPTY_NOTE_WEIGHTS as object,
  avoidNoteIds: EMPTY_AVOID_IDS as string[],
  materialWeights: EMPTY_MATERIAL_WEIGHTS as object,
  materialAvoidIds: EMPTY_MATERIAL_AVOID_IDS as string[],
  preferredPriceRange: Prisma.JsonNull,
  preferredConcentration: null,
  preferredHouseTier: null,
  seasonHint: null,
  browsingStyle: null,
  lastQuizAt: null,
})

const getPrismaErrorCode = (err: unknown): string | undefined =>
  err && typeof err === "object" && "code" in err
    ? (err as { code: string }).code
    : undefined

const mergeNoteWeights = (
  existing: Record<string, number>,
  incoming: Record<string, number>
): Record<string, number> => {
  const merged = { ...existing }
  for (const [noteId, weight] of Object.entries(incoming)) {
    merged[noteId] = (merged[noteId] ?? 0) + weight
  }
  return merged
}

const incrementWeightsForNotes = (
  weights: Record<string, number>,
  noteIds: string[]
): void => {
  for (const noteId of noteIds) {
    weights[noteId] = (weights[noteId] ?? 0) + BEHAVIOR_WEIGHT_DELTA
  }
}

const incrementWeightsForMaterials = (
  weights: Record<string, number>,
  materialIds: string[]
): void => {
  for (const materialId of materialIds) {
    weights[materialId] = (weights[materialId] ?? 0) + BEHAVIOR_WEIGHT_DELTA
  }
}

/** Quiz payload from onboarding scent quiz. */
export type ScentQuizData = {
  noteWeights?: Record<string, number>
  avoidNoteIds?: string[]
  materialWeights?: Record<string, number>
  materialAvoidIds?: string[]
  preferredPriceRange?: { min?: number; max?: number } | null
  preferredConcentration?: "edt" | "edp" | "parfum" | "noPreference" | null
  preferredHouseTier?: "designer" | "niche" | "indie" | "all" | null
  /** Preferred seasons (multi-select). Stored in DB as comma-separated in seasonHint. */
  seasonHints?: ("spring" | "summer" | "fall" | "winter")[] | null
  browsingStyle?: "explorer" | "focused" | "trader" | null
}

/** Behavior event for profile evolution (rating, wishlist, collection). */
export type ScentProfileBehaviorEvent =
  | { type: "rating"; perfumeId: string; overall: number }
  | { type: "wishlist"; perfumeId: string }
  | { type: "collection"; perfumeId: string }

/** Get note IDs for a perfume from PerfumeNoteRelation. Shared by scent profile and recommendations. */
export const getNoteIdsForPerfume = async (perfumeId: string): Promise<string[]> => {
  const relations = await prisma.perfumeNoteRelation.findMany({
    where: { perfumeId },
    select: { noteId: true },
  })
  return [...new Set(relations.map((r) => r.noteId))]
}

/**
 * Returns the user's ScentProfile, or creates an empty one if none exists.
 * Use this so behavior-based evolution can run for users who skipped the quiz.
 * Handles concurrent create: on unique-constraint (P2002), fetches the profile
 * created by the other request instead of throwing.
 */
export const getOrCreateScentProfile = async (userId: string) => {
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
      data: { userId, ...createEmptyProfileData() },
    })
  } catch (err: unknown) {
    if (getPrismaErrorCode(err) === "P2002") {
      const created = await prisma.scentProfile.findUnique({
        where: { userId },
      })
      if (created) return created
    }
    throw err
  }
}

/**
 * Persists scent quiz answers into the user's ScentProfile.
 *
 * First completion: merges quiz note weights with any existing behavior weights
 * and unions avoid-note IDs so ratings/wishlist signals are preserved.
 *
 * Retake (lastQuizAt already set): replaces prior quiz answers — note weights,
 * avoids, seasons, browsing style, and preference fields are overwritten.
 * Behavior-driven updates after the retake continue to evolve the profile.
 */
export const updateScentProfileFromQuiz = async (
  userId: string,
  quizData: ScentQuizData
) => {
  const profile = await getOrCreateScentProfile(userId)
  const isRetake = profile.lastQuizAt != null
  const existingWeights = (profile.noteWeights as Record<string, number>) ?? {}
  const existingAvoidIds = (profile.avoidNoteIds as string[]) ?? []

  const noteWeights =
    quizData.noteWeights !== undefined
      ? isRetake
        ? { ...quizData.noteWeights }
        : mergeNoteWeights(
            existingWeights,
            quizData.noteWeights as Record<string, number>
          )
      : existingWeights

  const avoidNoteIds =
    quizData.avoidNoteIds !== undefined
      ? isRetake
        ? [...quizData.avoidNoteIds]
        : quizData.avoidNoteIds.length > 0
          ? [...new Set([...existingAvoidIds, ...quizData.avoidNoteIds])]
          : existingAvoidIds
      : existingAvoidIds

  const existingMaterialWeights =
    (profile.materialWeights as Record<string, number>) ?? {}
  const existingMaterialAvoidIds =
    (profile.materialAvoidIds as string[]) ?? []

  const materialWeights =
    quizData.materialWeights !== undefined
      ? isRetake
        ? { ...quizData.materialWeights }
        : mergeNoteWeights(
            existingMaterialWeights,
            quizData.materialWeights as Record<string, number>
          )
      : existingMaterialWeights

  const materialAvoidIds =
    quizData.materialAvoidIds !== undefined
      ? isRetake
        ? [...quizData.materialAvoidIds]
        : quizData.materialAvoidIds.length > 0
          ? [...new Set([...existingMaterialAvoidIds, ...quizData.materialAvoidIds])]
          : existingMaterialAvoidIds
      : existingMaterialAvoidIds

  const seasonHint = Array.isArray(quizData.seasonHints)
    ? quizData.seasonHints.length > 0
      ? quizData.seasonHints.join(",")
      : null
    : isRetake
      ? null
      : profile.seasonHint

  const browsingStyle =
    quizData.browsingStyle !== undefined
      ? quizData.browsingStyle
      : isRetake
        ? null
        : profile.browsingStyle

  return prisma.scentProfile.update({
    where: { id: profile.id },
    data: {
      noteWeights: noteWeights as object,
      avoidNoteIds: avoidNoteIds as string[],
      materialWeights: materialWeights as object,
      materialAvoidIds: materialAvoidIds as string[],
      preferredPriceRange:
        quizData.preferredPriceRange !== undefined
          ? quizData.preferredPriceRange === null
            ? Prisma.JsonNull
            : (quizData.preferredPriceRange as object)
          : isRetake
            ? Prisma.JsonNull
            : (profile.preferredPriceRange as object),
      preferredConcentration:
        quizData.preferredConcentration !== undefined
          ? quizData.preferredConcentration === "noPreference"
            ? null
            : quizData.preferredConcentration
          : isRetake
            ? null
            : profile.preferredConcentration,
      preferredHouseTier:
        quizData.preferredHouseTier !== undefined
          ? quizData.preferredHouseTier === "all"
            ? null
            : quizData.preferredHouseTier
          : isRetake
            ? null
            : profile.preferredHouseTier,
      seasonHint,
      browsingStyle,
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
export const updateScentProfileFromBehavior = async (
  userId: string,
  event: ScentProfileBehaviorEvent
) => {
  const noteIds = await getNoteIdsForPerfume(event.perfumeId)
  if (noteIds.length === 0) return getOrCreateScentProfile(userId)

  const index = await getNoteMaterialIndex()
  const noteRows =
    noteIds.length > 0
      ? await prisma.perfumeNotes.findMany({
          where: { id: { in: noteIds } },
          select: { id: true, name: true },
        })
      : []
  const materialIdsForEvent = [
    ...new Set(
      noteRows
        .map((n) =>
          resolveNoteToMaterialId(index, { noteId: n.id, noteName: n.name })
        )
        .filter((id): id is string => id != null)
    ),
  ]

  return prisma.$transaction(async (tx) => {
    type LockedRow = {
      id: string
      userId: string
      noteWeights: unknown
      avoidNoteIds: unknown
      materialWeights: unknown
      materialAvoidIds: unknown
    }
    let rows = await tx.$queryRaw<LockedRow[]>`
      SELECT id, "userId", "noteWeights", "avoidNoteIds", "materialWeights", "materialAvoidIds"
      FROM "ScentProfile"
      WHERE "userId" = ${userId}
      FOR UPDATE
    `
    if (rows.length === 0) {
      try {
        await tx.scentProfile.create({
          data: { userId, ...createEmptyProfileData() },
        })
      } catch (err: unknown) {
        if (getPrismaErrorCode(err) !== "P2002") throw err
      }
      rows = await tx.$queryRaw<LockedRow[]>`
        SELECT id, "userId", "noteWeights", "avoidNoteIds", "materialWeights", "materialAvoidIds"
        FROM "ScentProfile"
        WHERE "userId" = ${userId}
        FOR UPDATE
      `
      if (rows.length === 0) throw new Error("ScentProfile get-or-create failed under transaction")
    }
    const row = rows[0]!
    const weights = { ...((row.noteWeights as Record<string, number>) ?? {}) }
    let avoidIds = [...((row.avoidNoteIds as string[]) ?? [])]
    const materialWeights = {
      ...((row.materialWeights as Record<string, number>) ?? {}),
    }
    let materialAvoidIds = [...((row.materialAvoidIds as string[]) ?? [])]

    if (event.type === "rating") {
      if (event.overall >= 4) {
        incrementWeightsForNotes(weights, noteIds)
        incrementWeightsForMaterials(materialWeights, materialIdsForEvent)
      } else if (event.overall <= 2) {
        avoidIds = [...new Set([...avoidIds, ...noteIds])]
        materialAvoidIds = [
          ...new Set([...materialAvoidIds, ...materialIdsForEvent]),
        ]
      }
    } else {
      incrementWeightsForNotes(weights, noteIds)
      incrementWeightsForMaterials(materialWeights, materialIdsForEvent)
    }

    return tx.scentProfile.update({
      where: { id: row.id },
      data: {
        noteWeights: weights as object,
        avoidNoteIds: avoidIds as string[],
        materialWeights: materialWeights as object,
        materialAvoidIds: materialAvoidIds as string[],
      },
    })
  })
}

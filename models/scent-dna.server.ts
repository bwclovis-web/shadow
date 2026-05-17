import { cache } from "react"

import { prisma } from "@/lib/db"
import {
  buildScentDnaSnapshot,
  type ScentDnaSnapshot,
} from "@/utils/scent-dna/compute-scent-dna"

export type { ScentDnaSnapshot }

export const getScentDnaForUser = cache(
  async (userId: string): Promise<ScentDnaSnapshot> => {
    const [profile, seasonVotes, collectionRows] = await Promise.all([
      prisma.scentProfile.findUnique({
        where: { userId },
        select: { noteWeights: true },
      }),
      prisma.userPerfumeSeasonVote.findMany({
        where: { userId },
        select: {
          winter: true,
          spring: true,
          summer: true,
          fall: true,
        },
      }),
      prisma.userPerfume.findMany({
        where: { userId },
        select: {
          perfume: {
            select: {
              perfumeHouse: {
                select: { type: true },
              },
            },
          },
        },
      }),
    ])

    const noteWeights =
      (profile?.noteWeights as Record<string, number> | null) ?? {}
    const noteIds = Object.keys(noteWeights)

    const noteRows =
      noteIds.length > 0
        ? await prisma.perfumeNotes.findMany({
            where: { id: { in: noteIds } },
            select: { id: true, name: true },
          })
        : []

    const noteNameById = new Map(noteRows.map((row) => [row.id, row.name]))

    const houseTypes = collectionRows.map(
      (row) => row.perfume.perfumeHouse?.type ?? null
    )

    return buildScentDnaSnapshot({
      noteWeights,
      noteNameById,
      seasonVotes,
      houseTypes,
    })
  }
)

import { prisma } from "@/lib/db"
import { computeCollectionCounts } from "@/lib/user-inventory-stats"
import { isCollectionBottle } from "@/lib/user-inventory"
import {
  computeTopNoteFamilies,
  type TopNoteFamily,
} from "@/utils/scent-dna/compute-scent-dna"

export type UserInventoryStats = {
  bottleCount: number
  houseCount: number
  topFamilies: TopNoteFamily[]
  tradedValue: number
}

const parseMoney = (value: string | null | undefined): number => {
  if (!value?.trim()) return 0
  const n = parseFloat(value.replace(/[^0-9.]/g, "") || "0")
  return Number.isFinite(n) ? n : 0
}

export const getUserInventoryStats = async (
  userId: string
): Promise<UserInventoryStats> => {
  const rows = await prisma.userPerfume.findMany({
    where: { userId },
    select: {
      id: true,
      perfumeId: true,
      amount: true,
      available: true,
      tradePrice: true,
      price: true,
      perfume: {
        select: {
          perfumeHouse: { select: { id: true } },
        },
      },
    },
  })

  const bottles = rows.filter(isCollectionBottle)
  const perfumeIds = [...new Set(bottles.map((b) => b.perfumeId))]
  const { bottleCount, houseCount } = computeCollectionCounts(
    bottles.map((b) => ({
      id: b.id,
      perfumeId: b.perfumeId,
      amount: b.amount,
      perfume: b.perfume,
    }))
  )

  const noteWeights: Record<string, number> = {}
  const noteNameById = new Map<string, string>()

  if (perfumeIds.length > 0) {
    const relations = await prisma.perfumeNoteRelation.findMany({
      where: { perfumeId: { in: perfumeIds } },
      select: {
        perfumeId: true,
        noteId: true,
        note: { select: { id: true, name: true } },
      },
    })

    const perfumeIdSet = new Set(perfumeIds)
    for (const rel of relations) {
      if (!perfumeIdSet.has(rel.perfumeId)) continue
      noteNameById.set(rel.note.id, rel.note.name)
      noteWeights[rel.noteId] = (noteWeights[rel.noteId] ?? 0) + 1
    }
  }

  const topFamilies = computeTopNoteFamilies(noteWeights, noteNameById, 3)

  const lineItems = await prisma.tradeLineItem.findMany({
    where: {
      trade: { status: "completed" },
      userPerfume: { userId },
    },
    select: {
      userPerfumeId: true,
      userPerfume: {
        select: { tradePrice: true, price: true },
      },
    },
  })

  const seenUserPerfumeIds = new Set<string>()
  let tradedValue = 0
  for (const item of lineItems) {
    if (seenUserPerfumeIds.has(item.userPerfumeId)) continue
    seenUserPerfumeIds.add(item.userPerfumeId)
    const fromTrade = parseMoney(item.userPerfume.tradePrice)
    const fromPrice = parseMoney(item.userPerfume.price)
    tradedValue += fromTrade > 0 ? fromTrade : fromPrice
  }

  return {
    bottleCount,
    houseCount,
    topFamilies,
    tradedValue,
  }
}

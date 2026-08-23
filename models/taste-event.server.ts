import type { Prisma, TasteEventType } from "@prisma/client"

import { prisma } from "@/lib/db"

export const recordTasteEvent = async (params: {
  userId: string
  eventType: TasteEventType
  perfumeId?: string | null
  weight?: number
  metadata?: Prisma.InputJsonValue
}) => {
  return prisma.tasteEvent.create({
    data: {
      userId: params.userId,
      eventType: params.eventType,
      perfumeId: params.perfumeId ?? null,
      weight: params.weight ?? 1,
      metadata: params.metadata,
    },
  })
}

export const listTasteEventsForUser = async (
  userId: string,
  options?: { limit?: number; eventType?: TasteEventType }
) => {
  return prisma.tasteEvent.findMany({
    where: {
      userId,
      ...(options?.eventType ? { eventType: options.eventType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    select: {
      id: true,
      eventType: true,
      perfumeId: true,
      weight: true,
      metadata: true,
      createdAt: true,
    },
  })
}

export const getRecentSkippedOrDislikedPerfumeIds = async (
  userId: string,
  limit = 100
): Promise<string[]> => {
  const rows = await prisma.tasteEvent.findMany({
    where: {
      userId,
      eventType: { in: ["dislike", "skip_recommendation"] },
      perfumeId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { perfumeId: true },
  })
  return rows.map(r => r.perfumeId!).filter(Boolean)
}

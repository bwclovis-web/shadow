import type { SamplingQueueStatus } from "@prisma/client"

import { prisma } from "@/lib/db"

export const addToSamplingQueue = async (params: {
  userId: string
  perfumeId: string
  notes?: string | null
}) => {
  return prisma.samplingQueueItem.upsert({
    where: {
      userId_perfumeId: {
        userId: params.userId,
        perfumeId: params.perfumeId,
      },
    },
    create: {
      userId: params.userId,
      perfumeId: params.perfumeId,
      notes: params.notes ?? null,
      status: "queued",
    },
    update: {
      notes: params.notes ?? undefined,
      status: "queued",
    },
  })
}

export const listSamplingQueue = async (userId: string) => {
  return prisma.samplingQueueItem.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          perfumeHouse: { select: { name: true, slug: true } },
        },
      },
    },
  })
}

export const updateSamplingQueueStatus = async (params: {
  userId: string
  id: string
  status: SamplingQueueStatus
  notes?: string | null
}) => {
  return prisma.samplingQueueItem.updateMany({
    where: { id: params.id, userId: params.userId },
    data: {
      status: params.status,
      ...(params.notes !== undefined ? { notes: params.notes } : {}),
    },
  })
}

export const removeFromSamplingQueue = async (userId: string, id: string) => {
  return prisma.samplingQueueItem.deleteMany({
    where: { id, userId },
  })
}

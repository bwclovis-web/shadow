import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

type PausedAvailableRow = {
  id: string
  pausedAvailable: string | null
}

type DbClient = Prisma.TransactionClient | typeof prisma

/** Read pause snapshots without relying on regenerated Prisma client fields. */
export const fetchPausedAvailableByUser = async (
  userId: string
): Promise<Map<string, string | null>> => {
  const rows = await prisma.$queryRaw<PausedAvailableRow[]>`
    SELECT id, "pausedAvailable"
    FROM "UserPerfume"
    WHERE "userId" = ${userId}
  `
  return new Map(rows.map((row) => [row.id, row.pausedAvailable]))
}

export const getPausedAvailable = async (
  userPerfumeId: string,
  userId: string,
  db: DbClient = prisma
): Promise<string | null> => {
  const rows = await db.$queryRaw<PausedAvailableRow[]>`
    SELECT id, "pausedAvailable"
    FROM "UserPerfume"
    WHERE "id" = ${userPerfumeId} AND "userId" = ${userId}
    LIMIT 1
  `
  return rows[0]?.pausedAvailable ?? null
}

export const setPausedAvailable = async (
  userPerfumeId: string,
  userId: string,
  pausedAvailable: string | null,
  db: DbClient = prisma
): Promise<void> => {
  await db.$executeRaw`
    UPDATE "UserPerfume"
    SET "pausedAvailable" = ${pausedAvailable}
    WHERE "id" = ${userPerfumeId} AND "userId" = ${userId}
  `
}

export const attachPausedAvailable = <T extends { id: string }>(
  rows: T[],
  pauseById: Map<string, string | null>
): Array<T & { pausedAvailable: string | null }> =>
  rows.map((row) => ({
    ...row,
    pausedAvailable: pauseById.get(row.id) ?? null,
  }))

import { createHash } from "crypto"
import { Prisma, type DecantSplitStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  computePooledFragranceAllocation,
  sumConsumedCompletedSplitMl,
  sumReservingSplitMl,
  type PooledFragranceAllocation,
} from "@/lib/decant-split-ml"
import {
  AllocationValidationError,
  LISTING_ALLOCATION_ERROR_CODES,
} from "@/lib/listing-allocation-errors"
import type { UserInventoryRow } from "@/lib/user-inventory"

export type FragrancePoolSnapshot = {
  rows: UserInventoryRow[]
  reservedSplitMl: number
  consumedCompletedSplitMl: number
  splits: Array<{ id: string; totalMl: number; status: DecantSplitStatus; sourceUserPerfumeId: string | null }>
}

export type FragrancePoolTx = Prisma.TransactionClient

const POOL_TX_MAX_ATTEMPTS = 4
const POOL_TX_TIMEOUT_MS = 15_000
const POOL_TX_MAX_WAIT_MS = 10_000

/** Stable signed 32-bit pair for `pg_advisory_xact_lock(int, int)`. */
export const fragrancePoolLockKeys = (
  userId: string,
  perfumeId: string
): [number, number] => {
  const digest = createHash("sha256")
    .update(userId)
    .update("\0")
    .update(perfumeId)
    .digest()
  return [digest.readInt32BE(0), digest.readInt32BE(4)]
}

export const acquireFragrancePoolLock = async (
  tx: FragrancePoolTx,
  userId: string,
  perfumeId: string
): Promise<void> => {
  const [k1, k2] = fragrancePoolLockKeys(userId, perfumeId)
  // Prisma parameterizes JS numbers as bigint; Postgres two-arg advisory lock is int4.
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(CAST(${k1} AS INTEGER), CAST(${k2} AS INTEGER))
  `
}

type LockedInventoryRow = {
  id: string
  perfumeId: string
  amount: string | null
  available: string | null
  pausedAvailable: string | null
}

type LockedSplitRow = {
  id: string
  totalMl: number
  status: DecantSplitStatus
  sourceUserPerfumeId: string | null
}

/**
 * Serialize all allocation writers for (userId, perfumeId):
 * transaction-scoped advisory lock, then row locks on inventory + relevant splits.
 * Provider: PostgreSQL (`pg_advisory_xact_lock` + `FOR UPDATE`).
 */
export const loadFragrancePoolUnderLock = async (
  tx: FragrancePoolTx,
  userId: string,
  perfumeId: string
): Promise<FragrancePoolSnapshot> => {
  await acquireFragrancePoolLock(tx, userId, perfumeId)

  const rows = await tx.$queryRaw<LockedInventoryRow[]>`
    SELECT id, "perfumeId", amount, available, "pausedAvailable"
    FROM "UserPerfume"
    WHERE "userId" = ${userId} AND "perfumeId" = ${perfumeId}
    FOR UPDATE
  `

  const splits = await tx.$queryRaw<LockedSplitRow[]>`
    SELECT id, "totalMl", status, "sourceUserPerfumeId"
    FROM "DecantSplit"
    WHERE "hostUserId" = ${userId}
      AND "perfumeId" = ${perfumeId}
      AND status IN ('open', 'filling', 'shipped', 'completed')
    FOR UPDATE
  `

  return {
    rows: rows.map(r => ({
      id: r.id,
      perfumeId: r.perfumeId,
      amount: r.amount,
      available: r.available,
      pausedAvailable: r.pausedAvailable,
    })),
    reservedSplitMl: sumReservingSplitMl(splits),
    consumedCompletedSplitMl: sumConsumedCompletedSplitMl(splits),
    splits,
  }
}

export const budgetFromFragrancePool = (
  pool: FragrancePoolSnapshot,
  excludeListingId?: string | null
): PooledFragranceAllocation =>
  computePooledFragranceAllocation({
    rows: pool.rows,
    reservedSplitMl: pool.reservedSplitMl,
    consumedCompletedSplitMl: pool.consumedCompletedSplitMl,
    excludeListingId,
  })

const isRetryablePoolTxError = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2034: write conflict / deadlock; P2024: timed out fetching connection from pool
    return error.code === "P2034" || error.code === "P2024"
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes("deadlock") ||
      msg.includes("could not serialize") ||
      msg.includes("40001") ||
      msg.includes("40p01")
    )
  }
  return false
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Run work under a fragrance-pool lock with bounded retries on transient conflicts.
 * Side effects that must not duplicate (alerts) belong **outside** this helper.
 */
export const withFragrancePoolTransaction = async <T>(
  userId: string,
  perfumeId: string,
  fn: (tx: FragrancePoolTx, pool: FragrancePoolSnapshot) => Promise<T>
): Promise<T> => {
  let lastError: unknown

  for (let attempt = 0; attempt < POOL_TX_MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async tx => {
          const pool = await loadFragrancePoolUnderLock(tx, userId, perfumeId)
          return fn(tx, pool)
        },
        {
          maxWait: POOL_TX_MAX_WAIT_MS,
          timeout: POOL_TX_TIMEOUT_MS,
        }
      )
    } catch (error) {
      lastError = error
      if (
        isRetryablePoolTxError(error) &&
        attempt < POOL_TX_MAX_ATTEMPTS - 1
      ) {
        await sleep(25 * (attempt + 1) ** 2)
        continue
      }
      break
    }
  }

  if (isRetryablePoolTxError(lastError)) {
    throw new AllocationValidationError(
      LISTING_ALLOCATION_ERROR_CODES.conflictRetryExhausted
    )
  }
  throw lastError
}

export const commitmentsExceedOwned = (
  budget: PooledFragranceAllocation
): boolean => {
  if (budget.ownership === "unknown") {
    return (
      budget.activeDestashMl +
        budget.reservedSplitMl +
        budget.consumedCompletedSplitMl >
      0
    )
  }
  const committed =
    budget.activeDestashMl +
    budget.reservedSplitMl +
    budget.consumedCompletedSplitMl
  return committed > budget.knownOwnedMl + 0.05
}

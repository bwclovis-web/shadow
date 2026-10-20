import type { DecantSplitStatus } from "@prisma/client"

import { parseMl, type UserInventoryRow } from "@/lib/user-inventory"

/**
 * One decimal place for display / stored allocation rounding.
 * Comparison tolerance is half of that step so 1-decimal values compare stably.
 */
export const ML_DECIMAL_PLACES = 1
export const ML_COMPARISON_TOLERANCE = 0.05

/** Splits that reserve pourable ml until completed or cancelled. */
export const ACTIVE_DECANT_SPLIT_STATUSES: DecantSplitStatus[] = [
  "open",
  "filling",
  "shipped",
]

/**
 * Explicit reservation / consumption treatment per split status.
 *
 * - reserves: counts as `reservedSplitMl` (cannot allocate elsewhere).
 * - released_unpoured: cancelled before pour; ml returns to the pool.
 * - released_poured_unaccounted: completed; reservation clears but juice was poured.
 *   Callers must pass that volume as `consumedCompletedSplitMl` until owned rows are
 *   reduced (see docs/destash-improvements.md — completed-split accounting).
 */
export type SplitMlAccounting =
  | "reserves"
  | "released_unpoured"
  | "released_poured_unaccounted"

export const SPLIT_STATUS_ML_ACCOUNTING: Record<
  DecantSplitStatus,
  SplitMlAccounting
> = {
  open: "reserves",
  filling: "reserves",
  shipped: "reserves",
  cancelled: "released_unpoured",
  completed: "released_poured_unaccounted",
}

export const isSplitStatusReservingMl = (status: DecantSplitStatus): boolean =>
  SPLIT_STATUS_ML_ACCOUNTING[status] === "reserves"

export const isSplitStatusConsumedPouredMl = (
  status: DecantSplitStatus
): boolean => SPLIT_STATUS_ML_ACCOUNTING[status] === "released_poured_unaccounted"

/**
 * Destash listing treatment for allocation:
 * - active (`available` > 0): counts as active destash ml
 * - paused (`available` ≤ 0 and `pausedAvailable` > 0): does **not** count;
 *   volume is back in the pool until resume re-checks budget
 * - cleared / never listed: does not count
 */
export type DestashListingTreatment = "active" | "paused" | "inactive"

export const getDestashListingTreatment = (
  row: UserInventoryRow
): DestashListingTreatment => {
  const availableMl = parseMl(row.available)
  if (availableMl > 0) return "active"
  if (parseMl(row.pausedAvailable) > 0) return "paused"
  return "inactive"
}

export const roundMl = (ml: number): number => {
  if (!Number.isFinite(ml)) return ml
  const factor = 10 ** ML_DECIMAL_PLACES
  return Math.round(ml * factor) / factor
}

/** Float slack so values like 10 vs 10.05 are not rejected by binary rounding. */
const ML_FLOAT_SLACK = 1e-9

export const volumesWithinTolerance = (a: number, b: number): boolean =>
  Math.abs(a - b) <= ML_COMPARISON_TOLERANCE + ML_FLOAT_SLACK

export const mlFitsWithinBudget = (
  requestedMl: number,
  availableToAllocateMl: number
): boolean =>
  requestedMl <= availableToAllocateMl + ML_COMPARISON_TOLERANCE + ML_FLOAT_SLACK

/** Lenient sum used by legacy callers; treats unparseable as 0 (not for new policy). */
export const sumOwnedMlForPerfume = (rows: UserInventoryRow[]): number =>
  rows.reduce((sum, row) => sum + parseMl(row.amount), 0)

/** Lenient sum of all `available` fields; prefer `sumActiveDestashMlForPerfume`. */
export const sumListedMlForPerfume = (rows: UserInventoryRow[]): number =>
  rows.reduce((sum, row) => sum + parseMl(row.available), 0)

export const computePourableMlBudget = (params: {
  ownedMl: number
  listedMl: number
  reservedMl: number
}): {
  ownedMl: number
  listedMl: number
  reservedMl: number
  remainingPourableMl: number
} => {
  const { ownedMl, listedMl, reservedMl } = params
  const remainingPourableMl = Math.max(0, ownedMl - listedMl - reservedMl)
  return { ownedMl, listedMl, reservedMl, remainingPourableMl }
}

// ---------------------------------------------------------------------------
// Stored ownership classification (read-only; never rewrites DB values)
// ---------------------------------------------------------------------------

export type OwnedAmountUnknownReason =
  | "legacy_token"
  | "malformed"
  | "negative"
  | "non_finite"

export type OwnedAmountClassification =
  | { status: "known"; ml: number }
  | {
      status: "unknown"
      raw: string | null | undefined
      reason: OwnedAmountUnknownReason
    }

const LEGACY_OWNED_TOKENS = new Set(["full", "partial", "decant", "sample", "bottle"])

/**
 * Classify a stored `UserPerfume.amount` without mutating it.
 * Accepts optional trailing `ml` only so existing numeric strings with units still count
 * as known; tokens like `full` are unknown (never treated as unlimited).
 */
export const classifyStoredOwnedAmount = (
  amount?: string | null
): OwnedAmountClassification => {
  if (amount == null) {
    return { status: "known", ml: 0 }
  }

  const trimmed = amount.trim()
  if (trimmed === "") {
    return { status: "known", ml: 0 }
  }

  const lower = trimmed.toLowerCase()
  if (LEGACY_OWNED_TOKENS.has(lower)) {
    return { status: "unknown", raw: amount, reason: "legacy_token" }
  }

  // Stored: optional whitespace + number + optional "ml"
  const match = /^([+-]?\d+(?:\.\d+)?)\s*(ml)?$/i.exec(trimmed)
  if (!match) {
    return { status: "unknown", raw: amount, reason: "malformed" }
  }

  const ml = Number(match[1])
  if (!Number.isFinite(ml)) {
    return { status: "unknown", raw: amount, reason: "non_finite" }
  }
  if (ml < 0) {
    return { status: "unknown", raw: amount, reason: "negative" }
  }

  return { status: "known", ml: roundMl(ml) }
}

export type StrictMlParseFailureReason =
  | "empty"
  | "malformed"
  | "negative"
  | "non_finite"

export type StrictMlParseResult =
  | { ok: true; ml: number }
  | { ok: false; reason: StrictMlParseFailureReason }

/**
 * Strict validation for **new** volume inputs (allocation / split totals).
 * Digits + optional fractional part only — no units, no legacy tokens.
 */
export const parseStrictAllocationMl = (raw: unknown): StrictMlParseResult => {
  if (raw == null) {
    return { ok: false, reason: "empty" }
  }

  const trimmed = String(raw).trim()
  if (trimmed === "") {
    return { ok: false, reason: "empty" }
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, reason: "malformed" }
  }

  const ml = Number(trimmed)
  if (!Number.isFinite(ml)) {
    return { ok: false, reason: "non_finite" }
  }
  if (ml < 0) {
    return { ok: false, reason: "negative" }
  }

  return { ok: true, ml: roundMl(ml) }
}

export const sumKnownOwnedMlForPerfume = (
  rows: UserInventoryRow[]
): {
  knownOwnedMl: number
  unknownOwnedRowIds: string[]
  ownership: "known" | "unknown" | "none"
} => {
  let knownOwnedMl = 0
  const unknownOwnedRowIds: string[] = []

  for (const row of rows) {
    const classified = classifyStoredOwnedAmount(row.amount)
    if (classified.status === "unknown") {
      unknownOwnedRowIds.push(row.id)
      continue
    }
    knownOwnedMl += classified.ml
  }

  knownOwnedMl = roundMl(knownOwnedMl)

  if (unknownOwnedRowIds.length > 0) {
    return { knownOwnedMl, unknownOwnedRowIds, ownership: "unknown" }
  }
  if (knownOwnedMl <= 0) {
    return { knownOwnedMl: 0, unknownOwnedRowIds, ownership: "none" }
  }
  return { knownOwnedMl, unknownOwnedRowIds, ownership: "known" }
}

/**
 * Active destash ml only (`available` > 0). Paused listings are excluded.
 * When editing, pass `excludeListingId` so the row’s current allocation is
 * removed before the replacement volume is applied.
 */
export const sumActiveDestashMlForPerfume = (
  rows: UserInventoryRow[],
  excludeListingId?: string | null
): number => {
  let sum = 0
  for (const row of rows) {
    if (excludeListingId && row.id === excludeListingId) continue
    if (getDestashListingTreatment(row) !== "active") continue
    sum += parseMl(row.available)
  }
  return roundMl(sum)
}

export type PooledFragranceAllocation = {
  /** Caps always use perfume-pooled volume, never invented per-bottle ledgers. */
  scope: "pooled_fragrance"
  knownOwnedMl: number
  ownership: "known" | "unknown" | "none"
  unknownOwnedRowIds: string[]
  activeDestashMl: number
  reservedSplitMl: number
  /** Completed-split poured ml that must stay consumed after reservation release. */
  consumedCompletedSplitMl: number
  /**
   * knownOwned − activeDestash − reserved − consumedCompleted (floored at 0).
   * Only meaningful for allocation when `mayAllocate` is true.
   */
  availableToAllocateMl: number
  mayAllocate: boolean
}

/**
 * Authoritative pooled allocation budget.
 *
 * availableToAllocate =
 *   known owned ml − active destash ml − active split reservations
 *   − completed-split consumed ml
 */
export const computePooledFragranceAllocation = (params: {
  rows: UserInventoryRow[]
  reservedSplitMl: number
  /** Sum of `totalMl` for host splits in `completed` for this perfume. */
  consumedCompletedSplitMl?: number
  /** Listing row being edited — its current `available` is excluded from active destash. */
  excludeListingId?: string | null
}): PooledFragranceAllocation => {
  const reservedSplitMl = roundMl(Math.max(0, params.reservedSplitMl))
  const consumedCompletedSplitMl = roundMl(
    Math.max(0, params.consumedCompletedSplitMl ?? 0)
  )
  const owned = sumKnownOwnedMlForPerfume(params.rows)
  const activeDestashMl = sumActiveDestashMlForPerfume(
    params.rows,
    params.excludeListingId
  )

  const rawAvailable =
    owned.knownOwnedMl -
    activeDestashMl -
    reservedSplitMl -
    consumedCompletedSplitMl
  const availableToAllocateMl = roundMl(Math.max(0, rawAvailable))
  const mayAllocate = owned.ownership === "known"

  return {
    scope: "pooled_fragrance",
    knownOwnedMl: owned.knownOwnedMl,
    ownership: owned.ownership,
    unknownOwnedRowIds: owned.unknownOwnedRowIds,
    activeDestashMl,
    reservedSplitMl,
    consumedCompletedSplitMl,
    availableToAllocateMl: mayAllocate ? availableToAllocateMl : 0,
    mayAllocate,
  }
}

export type AllocationAcceptResult =
  | { ok: true; ml: number }
  | {
      ok: false
      reason:
        | "invalid_volume"
        | "ownership_unknown"
        | "no_owned_volume"
        | "exceeds_available"
      parseReason?: StrictMlParseFailureReason
    }

/** Validate a proposed new allocation against a pooled budget. */
export const canAcceptAllocationMl = (
  budget: PooledFragranceAllocation,
  proposedRaw: unknown
): AllocationAcceptResult => {
  const parsed = parseStrictAllocationMl(proposedRaw)
  if (!parsed.ok) {
    return { ok: false, reason: "invalid_volume", parseReason: parsed.reason }
  }

  // Pause / clear (0 ml) does not consume pourable volume.
  if (parsed.ml === 0) {
    return { ok: true, ml: 0 }
  }

  if (budget.ownership === "unknown") {
    return { ok: false, reason: "ownership_unknown" }
  }
  if (budget.ownership === "none" || !budget.mayAllocate) {
    return { ok: false, reason: "no_owned_volume" }
  }

  if (!mlFitsWithinBudget(parsed.ml, budget.availableToAllocateMl)) {
    return { ok: false, reason: "exceeds_available" }
  }

  return { ok: true, ml: parsed.ml }
}

/**
 * Informational source-bottle attribution only.
 * Never use as an allocation ceiling — caps remain pooled_fragrance.
 */
export type SourceBottleAttribution = {
  scope: "source_bottle_attribution"
  bottleId: string
  perfumeId: string
  owned: OwnedAmountClassification
  activeDestashOnRowMl: number
  note: "Informational only; allocation caps use pooled fragrance volume."
}

export const getSourceBottleAttribution = (
  rows: UserInventoryRow[],
  bottleId: string
): SourceBottleAttribution | null => {
  const row = rows.find(r => r.id === bottleId)
  if (!row) return null

  return {
    scope: "source_bottle_attribution",
    bottleId: row.id,
    perfumeId: row.perfumeId,
    owned: classifyStoredOwnedAmount(row.amount),
    activeDestashOnRowMl:
      getDestashListingTreatment(row) === "active" ? parseMl(row.available) : 0,
    note: "Informational only; allocation caps use pooled fragrance volume.",
  }
}

/** Sum `totalMl` for splits whose status reserves pourable ml. */
export const sumReservingSplitMl = (
  splits: Array<{ totalMl: number; status: DecantSplitStatus }>
): number =>
  roundMl(
    splits
      .filter(s => isSplitStatusReservingMl(s.status))
      .reduce((sum, s) => sum + (Number.isFinite(s.totalMl) ? s.totalMl : 0), 0)
  )

/** Sum `totalMl` for completed splits (poured consumption ledger input). */
export const sumConsumedCompletedSplitMl = (
  splits: Array<{ totalMl: number; status: DecantSplitStatus }>
): number =>
  roundMl(
    splits
      .filter(s => isSplitStatusConsumedPouredMl(s.status))
      .reduce((sum, s) => sum + (Number.isFinite(s.totalMl) ? s.totalMl : 0), 0)
  )

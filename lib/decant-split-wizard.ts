import {
  ML_COMPARISON_TOLERANCE,
  ML_DECIMAL_PLACES,
  mlFitsWithinBudget,
  parseStrictAllocationMl,
  roundMl,
  volumesWithinTolerance,
} from "@/lib/decant-split-ml"
import type { PourableMlBudgetForClient } from "@/types/decant-split"

/** Server requires ≥1 slot; wizard UI caps at 24 (existing product limit). */
export const DECANT_SPLIT_MIN_SLOT_COUNT = 1
export const DECANT_SPLIT_MAX_SLOT_COUNT = 24

export type SplitWizardBudgetStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unknown"
  | "none"
  | "error"

export type SplitWizardValidationReason =
  | "budget_loading"
  | "budget_error"
  | "budget_unavailable"
  | "ownership_unknown"
  | "no_owned_volume"
  | "invalid_total"
  | "total_not_positive"
  | "exceeds_available"
  | "invalid_slot_count"
  | "slot_count_out_of_range"
  | "invalid_slot_ml"
  | "slot_ml_not_positive"
  | "slot_total_mismatch"

export type SplitWizardParsed = {
  totalMl: number
  slotCount: number
  slotMl: number
  slotSum: number
  slots: number[]
}

export type SplitWizardValidationResult =
  | { ok: true; parsed: SplitWizardParsed }
  | { ok: false; reason: SplitWizardValidationReason }

export const splitWizardBudgetStatus = (
  budget: PourableMlBudgetForClient | null,
  fetchError: boolean,
  loading: boolean
): SplitWizardBudgetStatus => {
  if (loading) return "loading"
  if (fetchError) return "error"
  if (!budget) return "loading"
  if (budget.ownership === "unknown") return "unknown"
  if (budget.ownership === "none") return "none"
  return "ready"
}

export const formatSplitMlDisplay = (ml: number): string =>
  roundMl(ml).toFixed(ML_DECIMAL_PLACES)

/** Integer slot count within product/server-aligned bounds (1–24). */
export const parseSplitSlotCount = (
  raw: string
):
  | { ok: true; count: number }
  | { ok: false; reason: "invalid_slot_count" | "slot_count_out_of_range" } => {
  const trimmed = String(raw).trim()
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, reason: "invalid_slot_count" }
  }
  const count = Number(trimmed)
  if (!Number.isInteger(count)) {
    return { ok: false, reason: "invalid_slot_count" }
  }
  if (
    count < DECANT_SPLIT_MIN_SLOT_COUNT ||
    count > DECANT_SPLIT_MAX_SLOT_COUNT
  ) {
    return { ok: false, reason: "slot_count_out_of_range" }
  }
  return { ok: true, count }
}

export const parsePositiveSlotMl = (
  raw: string
):
  | { ok: true; ml: number }
  | { ok: false; reason: "invalid_slot_ml" | "slot_ml_not_positive" } => {
  const parsed = parseStrictAllocationMl(raw)
  if (!parsed.ok) {
    return { ok: false, reason: "invalid_slot_ml" }
  }
  if (parsed.ml <= 0) {
    return { ok: false, reason: "slot_ml_not_positive" }
  }
  return { ok: true, ml: parsed.ml }
}

export const parsePositiveTotalMl = (
  raw: string
):
  | { ok: true; ml: number }
  | { ok: false; reason: "invalid_total" | "total_not_positive" } => {
  const parsed = parseStrictAllocationMl(raw)
  if (!parsed.ok) {
    return { ok: false, reason: "invalid_total" }
  }
  if (parsed.ml <= 0) {
    return { ok: false, reason: "total_not_positive" }
  }
  return { ok: true, ml: parsed.ml }
}

export const remainingAfterProposed = (
  remainingPourableMl: number,
  proposedTotalMl: number
): number => roundMl(Math.max(0, remainingPourableMl - proposedTotalMl))

export const validateSplitWizardStep1 = (params: {
  totalMlRaw: string
  budget: PourableMlBudgetForClient | null
  budgetStatus: SplitWizardBudgetStatus
}): SplitWizardValidationResult => {
  const { totalMlRaw, budget, budgetStatus } = params

  if (budgetStatus === "loading") {
    return { ok: false, reason: "budget_loading" }
  }
  if (budgetStatus === "error") {
    return { ok: false, reason: "budget_error" }
  }
  if (budgetStatus === "unknown") {
    return { ok: false, reason: "ownership_unknown" }
  }
  if (budgetStatus === "none" || !budget?.mayAllocate) {
    return { ok: false, reason: "no_owned_volume" }
  }
  if (!budget) {
    return { ok: false, reason: "budget_unavailable" }
  }

  const total = parsePositiveTotalMl(totalMlRaw)
  if (!total.ok) return { ok: false, reason: total.reason }

  if (!mlFitsWithinBudget(total.ml, budget.remainingPourableMl)) {
    return { ok: false, reason: "exceeds_available" }
  }

  return {
    ok: true,
    parsed: {
      totalMl: total.ml,
      slotCount: 0,
      slotMl: 0,
      slotSum: 0,
      slots: [],
    },
  }
}

export const validateSplitWizardStep2 = (params: {
  totalMlRaw: string
  slotCountRaw: string
  slotMlRaw: string
  budget: PourableMlBudgetForClient | null
  budgetStatus: SplitWizardBudgetStatus
}): SplitWizardValidationResult => {
  const step1 = validateSplitWizardStep1(params)
  if (!step1.ok) return step1

  const slotCount = parseSplitSlotCount(params.slotCountRaw)
  if (!slotCount.ok) return { ok: false, reason: slotCount.reason }

  const slotMl = parsePositiveSlotMl(params.slotMlRaw)
  if (!slotMl.ok) return { ok: false, reason: slotMl.reason }

  const slotSum = roundMl(slotCount.count * slotMl.ml)
  if (!volumesWithinTolerance(slotSum, step1.parsed.totalMl)) {
    return { ok: false, reason: "slot_total_mismatch" }
  }

  const slots = Array.from({ length: slotCount.count }, () => slotMl.ml)

  return {
    ok: true,
    parsed: {
      totalMl: step1.parsed.totalMl,
      slotCount: slotCount.count,
      slotMl: slotMl.ml,
      slotSum,
      slots,
    },
  }
}

/** Full draft check for final submit (same rules as step 2 + budget fit). */
export const validateSplitWizardDraft = validateSplitWizardStep2

export const isBudgetConflictErrorCode = (errorCode: string | undefined): boolean =>
  errorCode === "exceedsAvailable" ||
  errorCode === "conflictRetryExhausted" ||
  errorCode === "ownershipUnknown" ||
  errorCode === "noOwnedVolume"

/** Returns false when a submit is already in flight (double-click guard). */
export const tryAcquireSubmitLock = (lock: { current: boolean }): boolean => {
  if (lock.current) return false
  lock.current = true
  return true
}

export const releaseSubmitLock = (lock: { current: boolean }): void => {
  lock.current = false
}

export { ML_COMPARISON_TOLERANCE, ML_DECIMAL_PLACES, roundMl, volumesWithinTolerance }

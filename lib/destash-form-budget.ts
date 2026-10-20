import {
  ML_COMPARISON_TOLERANCE,
  ML_DECIMAL_PLACES,
  mlFitsWithinBudget,
  parseStrictAllocationMl,
  roundMl,
} from "@/lib/decant-split-ml"
import type { PourableMlBudgetForClient } from "@/types/decant-split"
import { parseMl } from "@/lib/user-inventory"

export { ML_COMPARISON_TOLERANCE, ML_DECIMAL_PLACES, roundMl }

export type DestashBudgetStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unknown"
  | "none"
  | "error"

export const editCreditMl = (
  isEditing: boolean,
  currentListedMl: number
): number => (isEditing ? Math.max(0, currentListedMl) : 0)

/** Max ml the form may allocate for create/edit from an authoritative budget. */
export const computeFormMaxAvailableMl = (params: {
  budget: PourableMlBudgetForClient | null
  isEditing: boolean
  currentListedMl: number
}): number | null => {
  const { budget, isEditing, currentListedMl } = params
  if (!budget) return null
  if (budget.ownership === "unknown" || budget.ownership === "none") {
    // Edits may still shrink/pause using credit of the current listing only.
    if (isEditing && currentListedMl > 0) {
      return roundMl(currentListedMl)
    }
    return null
  }
  if (!budget.mayAllocate && !isEditing) return null

  const credit = editCreditMl(isEditing, currentListedMl)
  return roundMl(Math.max(0, budget.remainingPourableMl + credit))
}

export const validateDestashAmountAgainstBudget = (params: {
  amountRaw: string
  maxAvailableMl: number | null
  budgetStatus: DestashBudgetStatus
  isCreating: boolean
  requirePositiveForCreate: boolean
}): { ok: true; ml: number } | { ok: false; reason: string } => {
  const {
    amountRaw,
    maxAvailableMl,
    budgetStatus,
    isCreating,
    requirePositiveForCreate,
  } = params

  if (budgetStatus === "loading") {
    return { ok: false, reason: "budget_loading" }
  }
  if (budgetStatus === "error") {
    return { ok: false, reason: "budget_error" }
  }
  if (budgetStatus === "unknown") {
    return { ok: false, reason: "ownership_unknown" }
  }
  if (budgetStatus === "none" && isCreating) {
    return { ok: false, reason: "no_owned_volume" }
  }

  const parsed = parseStrictAllocationMl(amountRaw)
  if (!parsed.ok) {
    return { ok: false, reason: "invalid_volume" }
  }

  if (requirePositiveForCreate && isCreating && parsed.ml <= 0) {
    return { ok: false, reason: "positive_required" }
  }

  if (maxAvailableMl == null && parsed.ml > 0) {
    return { ok: false, reason: "budget_unavailable" }
  }

  if (
    maxAvailableMl != null &&
    parsed.ml > 0 &&
    !mlFitsWithinBudget(parsed.ml, maxAvailableMl)
  ) {
    return { ok: false, reason: "exceeds_available" }
  }

  return { ok: true, ml: parsed.ml }
}

export const budgetStatusFromPayload = (
  budget: PourableMlBudgetForClient | null,
  fetchError: boolean
): DestashBudgetStatus => {
  if (fetchError) return "error"
  if (!budget) return "loading"
  if (budget.ownership === "unknown") return "unknown"
  if (budget.ownership === "none") return "none"
  return "ready"
}

export const formatMlDisplay = (ml: number): string =>
  roundMl(ml).toFixed(ML_DECIMAL_PLACES)

export const currentListedFromRow = (available?: string | null): number =>
  parseMl(available)

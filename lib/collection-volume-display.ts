import { classifyStoredOwnedAmount } from "@/lib/decant-split-ml"
import { formatMlDisplay } from "@/lib/destash-form-budget"
import { totalListedMlForPerfume, type UserInventoryRow } from "@/lib/user-inventory"

/** Same decimal policy as destash budget UI. */
export { formatMlDisplay }

export type CollectionOwnedDisplay =
  | { kind: "known"; ml: number; labelMl: string }
  | { kind: "unknown" }

/**
 * Bottle-owned volume for Collection cards.
 * Unknown / non-numeric stored amounts never become a fabricated number.
 */
export const getCollectionOwnedDisplay = (
  amount?: string | null
): CollectionOwnedDisplay => {
  const classified = classifyStoredOwnedAmount(amount)
  if (classified.status === "unknown") {
    return { kind: "unknown" }
  }
  return {
    kind: "known",
    ml: classified.ml,
    labelMl: formatMlDisplay(classified.ml),
  }
}

/**
 * Fragrance-pooled active listed ml (all rows for the perfume).
 * Not bottle-scoped allocation — callers must label it as fragrance-level.
 */
export const getFragranceListedMl = (
  perfumeId: string,
  allRows: UserInventoryRow[]
): { ml: number; labelMl: string } => {
  const ml = totalListedMlForPerfume(perfumeId, allRows)
  return { ml, labelMl: formatMlDisplay(ml) }
}

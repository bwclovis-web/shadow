/**
 * Fill % only when remaining volume and capacity are both valid numbers.
 * Never infer from condition, rating, or ambiguous quantity strings.
 */
export const resolveOfferFillPercent = (offer: {
  mlRemaining: number | null | undefined
  amount: string | null | undefined
}): number | null => {
  if (offer.mlRemaining == null || !Number.isFinite(offer.mlRemaining)) {
    return null
  }
  if (offer.mlRemaining < 0) return null

  const raw = String(offer.amount ?? "").trim()
  if (!raw) return null
  const capacity = Number.parseFloat(raw.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(capacity) || capacity <= 0) return null

  const pct = (offer.mlRemaining / capacity) * 100
  if (!Number.isFinite(pct) || pct < 0) return null
  return Math.min(100, Math.round(pct))
}

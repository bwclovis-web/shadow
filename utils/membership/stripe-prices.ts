import type { MembershipTier } from "@prisma/client"

/**
 * Checkout-facing tier keys (URL/query). DB stores Member as MembershipTier.free.
 */
export type CheckoutTierKey = "member" | "premium" | "collector"

export const CHECKOUT_TIER_KEYS: CheckoutTierKey[] = [
  "member",
  "premium",
  "collector",
]

export const ANNUAL_PRICES_USD: Record<CheckoutTierKey, number> = {
  member: 5,
  premium: 7,
  collector: 10,
}

export const checkoutTierToMembershipTier = (
  tier: CheckoutTierKey
): MembershipTier => {
  if (tier === "member") return "free"
  return tier
}

export const membershipTierToCheckoutTier = (
  tier: MembershipTier
): CheckoutTierKey => {
  if (tier === "free") return "member"
  return tier
}

export const parseCheckoutTier = (
  raw: string | null | undefined
): CheckoutTierKey => {
  const value = (raw ?? "").trim().toLowerCase()
  if (value === "premium" || value === "collector" || value === "member") {
    return value
  }
  if (value === "free") return "member"
  return "member"
}

/**
 * Map Stripe metadata membership_tier to DB MembershipTier.
 * Accepts member|free|premium|collector.
 */
export const membershipTierFromStripeMetadata = (
  meta: Record<string, string> | null | undefined
): MembershipTier => {
  const raw = (meta?.membership_tier || meta?.tier || "").toLowerCase()
  if (raw === "collector") return "collector"
  if (raw === "premium") return "premium"
  if (raw === "member" || raw === "free") return "free"
  return "premium"
}

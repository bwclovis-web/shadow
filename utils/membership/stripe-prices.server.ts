import type { CheckoutTierKey } from "@/utils/membership/stripe-prices"

export {
  ANNUAL_PRICES_USD,
  CHECKOUT_TIER_KEYS,
  checkoutTierToMembershipTier,
  membershipTierFromStripeMetadata,
  membershipTierToCheckoutTier,
  parseCheckoutTier,
  type CheckoutTierKey,
} from "@/utils/membership/stripe-prices"

/**
 * Resolve Stripe Price ID for a checkout tier.
 * Prefers STRIPE_PRICE_ID_MEMBER / _PREMIUM / _COLLECTOR.
 * Falls back to legacy STRIPE_PRICE_ID for premium only during migration.
 */
export const tierToPriceId = (tier: CheckoutTierKey): string => {
  const envKey =
    tier === "member"
      ? "STRIPE_PRICE_ID_MEMBER"
      : tier === "premium"
        ? "STRIPE_PRICE_ID_PREMIUM"
        : "STRIPE_PRICE_ID_COLLECTOR"

  const dedicated = process.env[envKey]?.trim()
  if (dedicated) return dedicated

  if (tier === "premium") {
    const legacy = process.env.STRIPE_PRICE_ID?.trim()
    if (legacy) return legacy
  }

  throw new Error(
    `${envKey} is required for ${tier} checkout. Create an annual Stripe Price and set it in the environment.`
  )
}

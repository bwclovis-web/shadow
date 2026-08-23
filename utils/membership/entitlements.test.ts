import { describe, expect, it } from "vitest"
import {
  COLLECTOR_ENTITLEMENTS,
  FREE_ENTITLEMENTS,
  MEMBERSHIP_BENEFITS,
  PREMIUM_ENTITLEMENTS,
} from "@/utils/membership/benefits"
import {
  canParticipate,
  resolveMembershipTier,
} from "@/utils/membership/entitlements.server"
import { featureFlags } from "@/utils/feature-flags"
import {
  membershipTierFromStripeMetadata,
  parseCheckoutTier,
} from "@/utils/membership/stripe-prices"

describe("digital membership entitlements", () => {
  it("keeps catalog/quiz/collection on Member (free) tier", () => {
    expect(FREE_ENTITLEMENTS).toContain("basic_catalog")
    expect(FREE_ENTITLEMENTS).toContain("basic_quiz")
    expect(FREE_ENTITLEMENTS).toContain("basic_collection")
  })

  it("keeps recommendation explanations ungated", () => {
    expect(FREE_ENTITLEMENTS).toContain("recommendation_explanations")
  })

  it("gates saved searches and digests to premium+", () => {
    expect(PREMIUM_ENTITLEMENTS).toContain("saved_searches")
    expect(PREMIUM_ENTITLEMENTS).toContain("personalized_digests")
    expect(FREE_ENTITLEMENTS).not.toContain("saved_searches")
  })

  it("adds collector-only digital benefits without sales flows", () => {
    expect(COLLECTOR_ENTITLEMENTS).toContain("export_history")
    expect(COLLECTOR_ENTITLEMENTS).toContain("early_editorial_access")
    const collectorBullets = MEMBERSHIP_BENEFITS.collector.bullets.join(" ")
    expect(collectorBullets).not.toMatch(/checkout|payout|shipping|escrow/)
  })

  it("uses translation keys for tier pricing metadata", () => {
    expect(MEMBERSHIP_BENEFITS.free.translationKey).toBe("member")
    expect(MEMBERSHIP_BENEFITS.free.priceUsd).toBe(5)
    expect(MEMBERSHIP_BENEFITS.premium.priceUsd).toBe(7)
    expect(MEMBERSHIP_BENEFITS.collector.priceUsd).toBe(10)
    expect(MEMBERSHIP_BENEFITS.collector.bullets).toContain("enhancedProfile")
  })
})

describe("resolveMembershipTier", () => {
  it("does not auto-upgrade paid Member (free) to Premium", () => {
    expect(
      resolveMembershipTier({
        membershipTier: "free",
        subscriptionStatus: "paid",
      })
    ).toBe("free")
  })

  it("returns premium and collector when set explicitly", () => {
    expect(
      resolveMembershipTier({
        membershipTier: "premium",
        subscriptionStatus: "paid",
      })
    ).toBe("premium")
    expect(
      resolveMembershipTier({
        membershipTier: "collector",
        subscriptionStatus: "paid",
      })
    ).toBe("collector")
  })
})

describe("canParticipate", () => {
  it("allows paid subscribers and early adopters", () => {
    expect(
      canParticipate({ subscriptionStatus: "paid", isEarlyAdopter: false })
    ).toBe(true)
    expect(
      canParticipate({ subscriptionStatus: "free", isEarlyAdopter: true })
    ).toBe(true)
  })

  it("blocks unpaid non-early-adopters", () => {
    expect(
      canParticipate({ subscriptionStatus: "free", isEarlyAdopter: false })
    ).toBe(false)
    expect(
      canParticipate({ subscriptionStatus: "cancelled", isEarlyAdopter: false })
    ).toBe(false)
  })
})

describe("stripe checkout tier helpers", () => {
  it("parses checkout tier query values", () => {
    expect(parseCheckoutTier("member")).toBe("member")
    expect(parseCheckoutTier("premium")).toBe("premium")
    expect(parseCheckoutTier("collector")).toBe("collector")
    expect(parseCheckoutTier("free")).toBe("member")
    expect(parseCheckoutTier(null)).toBe("member")
  })

  it("maps Stripe metadata to membership tiers", () => {
    expect(
      membershipTierFromStripeMetadata({ membership_tier: "member" })
    ).toBe("free")
    expect(
      membershipTierFromStripeMetadata({ membership_tier: "premium" })
    ).toBe("premium")
    expect(
      membershipTierFromStripeMetadata({ membership_tier: "collector" })
    ).toBe("collector")
  })
})

describe("feature flags", () => {
  it("exposes roadmap flags", () => {
    expect(typeof featureFlags.recommendationFeedback).toBe("boolean")
    expect(typeof featureFlags.durableScraperJobs).toBe("boolean")
  })
})

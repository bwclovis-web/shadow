import { describe, expect, it } from "vitest"
import {
  COLLECTOR_ENTITLEMENTS,
  FREE_ENTITLEMENTS,
  MEMBERSHIP_BENEFITS,
  PREMIUM_ENTITLEMENTS,
} from "@/utils/membership/benefits"
import { featureFlags } from "@/utils/feature-flags"

describe("digital membership entitlements", () => {
  it("keeps catalog/quiz/collection free", () => {
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
    const allBullets = Object.values(MEMBERSHIP_BENEFITS).flatMap(b => b.bullets)
    expect(allBullets.join(" ").toLowerCase()).not.toMatch(/checkout|payout|shipping|escrow/)
  })
})

describe("feature flags", () => {
  it("exposes roadmap flags", () => {
    expect(typeof featureFlags.recommendationFeedback).toBe("boolean")
    expect(typeof featureFlags.durableScraperJobs).toBe("boolean")
  })
})

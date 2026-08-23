import { describe, expect, it } from "vitest"
import { isFeatureEnabled, featureFlags } from "@/utils/feature-flags"
import { docsMentionNoSales } from "./quality-gates.helpers"

describe("quality gates docs", () => {
  it("feature flags default safely", () => {
    expect(isFeatureEnabled("recommendationFeedback")).toBe(
      featureFlags.recommendationFeedback
    )
  })

  it("roadmap docs forbid marketplace sales framing", () => {
    expect(docsMentionNoSales()).toBe(true)
  })
})

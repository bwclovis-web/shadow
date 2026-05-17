import { describe, expect, it } from "vitest"

import {
  budgetTierToPriceRange,
  listingConcentrationMatches,
  listingPriceInRange,
  perfumeHouseTierMatches,
  scoreListingPreferenceAlignment,
  signalsFromScentProfileFields,
} from "./scent-profile-preferences"

describe("scent-profile-preferences", () => {
  it("maps budget tiers to price ranges", () => {
    expect(budgetTierToPriceRange("50to100")).toEqual({ min: 50, max: 100 })
    expect(budgetTierToPriceRange("noPreference")).toBeNull()
  })

  it("parses profile fields into ranking signals", () => {
    const signals = signalsFromScentProfileFields({
      preferredPriceRange: { min: 100, max: 200 },
      preferredConcentration: "edp",
      preferredHouseTier: "niche",
    })
    expect(signals.priceRange).toEqual({ min: 100, max: 200 })
    expect(signals.concentration).toBe("edp")
    expect(signals.houseTier).toBe("niche")
  })

  it("scores listing alignment from price, concentration, and house", () => {
    const signals = signalsFromScentProfileFields({
      preferredPriceRange: { min: 50, max: 100 },
      preferredConcentration: "edp",
      preferredHouseTier: "niche",
    })

    expect(listingPriceInRange("$75", signals.priceRange)).toBe(true)
    expect(listingConcentrationMatches("eauDeParfum", signals.concentration)).toBe(
      true
    )
    expect(perfumeHouseTierMatches("niche", signals.houseTier)).toBe(true)

    const high = scoreListingPreferenceAlignment(
      {
        price: "$80",
        type: "eauDeParfum",
        perfumeHouseType: "niche",
      },
      signals
    )
    const low = scoreListingPreferenceAlignment(
      {
        price: "$250",
        type: "eauDeToilette",
        perfumeHouseType: "designer",
      },
      signals
    )
    expect(high).toBeGreaterThan(low)
  })
})

import type { HouseType, PerfumeType } from "@prisma/client"

import {
  isPreferredPriceRangeUsable,
  parsePreferredPriceRange,
  type PreferredPriceRange,
} from "@/services/recommendations/note-similarity"

/** Quiz budget tiers → numeric listing price bounds (USD, off-platform hints). */
export const QUIZ_BUDGET_TIERS = [
  "under50",
  "50to100",
  "100to200",
  "200plus",
  "noPreference",
] as const

export type QuizBudgetTierId = (typeof QUIZ_BUDGET_TIERS)[number]

export const QUIZ_CONCENTRATION_PREFERENCES = [
  "edt",
  "edp",
  "parfum",
  "noPreference",
] as const

export type QuizConcentrationPreferenceId =
  (typeof QUIZ_CONCENTRATION_PREFERENCES)[number]

export const QUIZ_HOUSE_TIER_PREFERENCES = [
  "designer",
  "niche",
  "indie",
  "all",
] as const

export type QuizHouseTierPreferenceId = (typeof QUIZ_HOUSE_TIER_PREFERENCES)[number]

export const BUDGET_TIER_TO_PRICE_RANGE: Record<
  Exclude<QuizBudgetTierId, "noPreference">,
  { min: number | null; max: number | null }
> = {
  under50: { min: null, max: 50 },
  "50to100": { min: 50, max: 100 },
  "100to200": { min: 100, max: 200 },
  "200plus": { min: 200, max: null },
}

const EDT_TYPES: PerfumeType[] = ["eauDeToilette", "eauDeCologne"]
const EDP_TYPES: PerfumeType[] = ["eauDeParfum"]
const PARFUM_TYPES: PerfumeType[] = [
  "parfum",
  "extraitDeParfum",
  "extraitOil",
]

export const parseQuizBudgetTier = (
  value: string | null | undefined
): QuizBudgetTierId | null => {
  if (!value) return null
  return (QUIZ_BUDGET_TIERS as readonly string[]).includes(value)
    ? (value as QuizBudgetTierId)
    : null
}

export const parseQuizConcentrationPreference = (
  value: string | null | undefined
): QuizConcentrationPreferenceId | null => {
  if (!value) return null
  return (QUIZ_CONCENTRATION_PREFERENCES as readonly string[]).includes(value)
    ? (value as QuizConcentrationPreferenceId)
    : null
}

export const parseQuizHouseTierPreference = (
  value: string | null | undefined
): QuizHouseTierPreferenceId | null => {
  if (!value) return null
  return (QUIZ_HOUSE_TIER_PREFERENCES as readonly string[]).includes(value)
    ? (value as QuizHouseTierPreferenceId)
    : null
}

export const budgetTierToPriceRange = (
  tier: QuizBudgetTierId | null | undefined
): PreferredPriceRange | null => {
  if (!tier || tier === "noPreference") return null
  return BUDGET_TIER_TO_PRICE_RANGE[tier]
}

export const perfumeTypesForConcentrationPreference = (
  pref: QuizConcentrationPreferenceId | null | undefined
): PerfumeType[] | null => {
  if (!pref || pref === "noPreference") return null
  if (pref === "edt") return EDT_TYPES
  if (pref === "edp") return EDP_TYPES
  return PARFUM_TYPES
}

export const houseTypesForTierPreference = (
  pref: QuizHouseTierPreferenceId | null | undefined
): HouseType[] | null => {
  if (!pref || pref === "all") return null
  return [pref as HouseType]
}

export type ScentProfilePreferenceSignals = {
  priceRange: PreferredPriceRange | null
  concentration: QuizConcentrationPreferenceId | null
  houseTier: QuizHouseTierPreferenceId | null
}

export const signalsFromScentProfileFields = (profile: {
  preferredPriceRange: unknown
  preferredConcentration: string | null
  preferredHouseTier: string | null
}): ScentProfilePreferenceSignals => ({
  priceRange: parsePreferredPriceRange(profile.preferredPriceRange),
  concentration: parseQuizConcentrationPreference(profile.preferredConcentration),
  houseTier: parseQuizHouseTierPreference(profile.preferredHouseTier),
})

const parseListingPrice = (price: string | null | undefined): number | null => {
  if (price == null) return null
  const trimmed = price.trim()
  if (!trimmed) return null
  const numeric = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ""))
  return Number.isFinite(numeric) ? numeric : null
}

export const listingPriceInRange = (
  price: string | null | undefined,
  range: PreferredPriceRange | null
): boolean => {
  if (!isPreferredPriceRangeUsable(range) || !range) return false
  const value = parseListingPrice(price)
  if (value == null) return false
  if (range.min != null && value < range.min) return false
  if (range.max != null && value > range.max) return false
  return true
}

export const listingConcentrationMatches = (
  listingType: PerfumeType | string | null | undefined,
  pref: QuizConcentrationPreferenceId | null
): boolean => {
  const allowed = perfumeTypesForConcentrationPreference(pref)
  if (!allowed || !listingType) return false
  return allowed.includes(listingType as PerfumeType)
}

export const perfumeHouseTierMatches = (
  houseType: HouseType | string | null | undefined,
  pref: QuizHouseTierPreferenceId | null
): boolean => {
  const allowed = houseTypesForTierPreference(pref)
  if (!allowed || !houseType) return false
  return allowed.includes(houseType as HouseType)
}

export type ListingPreferenceScoreInput = {
  price: string | null
  type: PerfumeType | string | null
  perfumeHouseType?: HouseType | string | null
}

/** Higher scores surface first when ranking exchange / wishlist listings. */
export const scoreListingPreferenceAlignment = (
  listing: ListingPreferenceScoreInput,
  signals: ScentProfilePreferenceSignals
): number => {
  let score = 0
  if (
    isPreferredPriceRangeUsable(signals.priceRange) &&
    listingPriceInRange(listing.price, signals.priceRange)
  ) {
    score += 2
  }
  if (listingConcentrationMatches(listing.type, signals.concentration)) {
    score += 1
  }
  if (perfumeHouseTierMatches(listing.perfumeHouseType, signals.houseTier)) {
    score += 1
  }
  return score
}

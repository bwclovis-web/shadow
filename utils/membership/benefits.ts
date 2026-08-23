export type DigitalEntitlement =
  | "basic_catalog"
  | "basic_collection"
  | "basic_quiz"
  | "advanced_taste_graph"
  | "unlimited_comparisons"
  | "saved_searches"
  | "instant_alerts"
  | "collection_analytics"
  | "seasonal_planning"
  | "recommendation_explanations"
  | "personalized_digests"
  | "private_collection_analytics"
  | "export_history"
  | "advanced_organization"
  | "early_editorial_access"
  | "enhanced_profile"

export type MembershipTierKey = "member" | "premium" | "collector"

export type MembershipBenefitBulletKey =
  | "browseCatalog"
  | "basicCollection"
  | "scentQuiz"
  | "recommendationExplanations"
  | "advancedTasteGraph"
  | "unlimitedComparisons"
  | "savedSearchesAlerts"
  | "collectionAnalyticsPlanning"
  | "personalizedDigests"
  | "everythingInPremium"
  | "privateAnalyticsExport"
  | "advancedOrganization"
  | "earlyEditorialEvents"
  | "enhancedProfile"

/** DB tier key → i18n tier key (Member stored as MembershipTier.free). */
export const membershipTierToTranslationKey = (
  tier: "free" | "premium" | "collector"
): MembershipTierKey => (tier === "free" ? "member" : tier)

export const MEMBERSHIP_BENEFITS = {
  free: {
    translationKey: "member" as const,
    priceUsd: 5,
    pricePeriod: "year" as const,
    bullets: [
      "browseCatalog",
      "basicCollection",
      "scentQuiz",
      "recommendationExplanations",
    ] as const satisfies readonly MembershipBenefitBulletKey[],
  },
  premium: {
    translationKey: "premium" as const,
    priceUsd: 7,
    pricePeriod: "year" as const,
    bullets: [
      "advancedTasteGraph",
      "unlimitedComparisons",
      "savedSearchesAlerts",
      "collectionAnalyticsPlanning",
      "personalizedDigests",
    ] as const satisfies readonly MembershipBenefitBulletKey[],
  },
  collector: {
    translationKey: "collector" as const,
    priceUsd: 10,
    pricePeriod: "year" as const,
    bullets: [
      "everythingInPremium",
      "privateAnalyticsExport",
      "advancedOrganization",
      "earlyEditorialEvents",
      "enhancedProfile",
    ] as const satisfies readonly MembershipBenefitBulletKey[],
  },
} as const

export const FREE_ENTITLEMENTS: DigitalEntitlement[] = [
  "basic_catalog",
  "basic_collection",
  "basic_quiz",
  // Explanations are shown to everyone; entitlement kept for marketing honesty
  "recommendation_explanations",
]

export const PREMIUM_ENTITLEMENTS: DigitalEntitlement[] = [
  ...FREE_ENTITLEMENTS,
  "advanced_taste_graph",
  "unlimited_comparisons",
  "saved_searches",
  "instant_alerts",
  "collection_analytics",
  "seasonal_planning",
  "personalized_digests",
]

export const COLLECTOR_ENTITLEMENTS: DigitalEntitlement[] = [
  ...PREMIUM_ENTITLEMENTS,
  "private_collection_analytics",
  "export_history",
  "advanced_organization",
  "early_editorial_access",
  "enhanced_profile",
]

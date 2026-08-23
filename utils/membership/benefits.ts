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

export const MEMBERSHIP_BENEFITS = {
  free: {
    label: "Free",
    bullets: [
      "Browse the full catalog",
      "Basic collection management",
      "Scent quiz",
      "Recommendation explanations (always included)",
    ],
  },
  premium: {
    label: "Premium",
    bullets: [
      "Advanced taste graph",
      "Unlimited comparisons",
      "Saved searches & instant match alerts",
      "Collection analytics & seasonal planning",
      "Personalized weekly digests",
    ],
  },
  collector: {
    label: "Collector",
    bullets: [
      "Everything in Premium",
      "Private collection analytics & export",
      "Advanced organization tools",
      "Early editorial & community events",
      "Enhanced profile customization",
    ],
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

/**
 * Feature flags for incremental roadmap releases.
 * Override with env FEATURE_<NAME>=true|false
 */

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === "") return fallback
  return value === "1" || value.toLowerCase() === "true"
}

export const featureFlags = {
  recommendationFeedback: parseBool(
    process.env.FEATURE_RECOMMENDATION_FEEDBACK,
    true
  ),
  savedSearches: parseBool(process.env.FEATURE_SAVED_SEARCHES, true),
  samplingQueue: parseBool(process.env.FEATURE_SAMPLING_QUEUE, true),
  personalizedDigests: parseBool(process.env.FEATURE_PERSONALIZED_DIGESTS, true),
  communityShelves: parseBool(process.env.FEATURE_COMMUNITY_SHELVES, true),
  durableScraperJobs: parseBool(process.env.FEATURE_DURABLE_SCRAPER_JOBS, true),
} as const

export type FeatureFlagName = keyof typeof featureFlags

export const isFeatureEnabled = (name: FeatureFlagName): boolean =>
  featureFlags[name]

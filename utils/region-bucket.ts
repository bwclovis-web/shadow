import {
  EXCHANGE_REGION_BUCKETS,
  type ExchangeRegionBucket,
} from "@/utils/discovery-filters"

const normalize = (raw: string): string => raw.trim().toLowerCase()

/** Aliases aligned with {@link buildUserRegionWhereForExchangeBucket}. */
const REGION_ALIASES: ReadonlyArray<{ bucket: ExchangeRegionBucket; values: readonly string[] }> =
  [
    {
      bucket: "US",
      values: ["united states", "us", "usa", "u.s.", "u.s.a."],
    },
    {
      bucket: "UK",
      values: ["united kingdom", "uk", "gb", "great britain"],
    },
    {
      bucket: "AU",
      values: ["australia", "au"],
    },
    {
      bucket: "EU",
      values: ["eu", "europe", "european union"],
    },
    {
      bucket: "other",
      values: ["other"],
    },
  ]

/**
 * Maps a user's free-text `region` to an exchange bucket for match explanations.
 */
export const resolveExchangeRegionBucket = (
  region: string | null | undefined
): ExchangeRegionBucket | null => {
  if (region == null) return null
  const trimmed = region.trim()
  if (!trimmed) return null

  const lower = normalize(trimmed)
  for (const { bucket, values } of REGION_ALIASES) {
    if (values.includes(lower)) return bucket
  }

  const upper = trimmed.toUpperCase()
  if ((EXCHANGE_REGION_BUCKETS as readonly string[]).includes(upper)) {
    return upper as ExchangeRegionBucket
  }

  return null
}

export const regionsShareExchangeBucket = (
  a: string | null | undefined,
  b: string | null | undefined
): boolean => {
  const bucketA = resolveExchangeRegionBucket(a)
  const bucketB = resolveExchangeRegionBucket(b)
  return bucketA != null && bucketB != null && bucketA === bucketB
}

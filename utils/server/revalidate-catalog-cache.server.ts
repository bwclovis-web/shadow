import { revalidateTag } from "next/cache"

/** Next.js 16+ requires a cache life profile; `"max"` expires tagged entries promptly. */
const REVALIDATE_PROFILE = "max" as const

/** Must match `tags` on perfume `unstable_cache` entries in `models/perfume.server.ts`. */
export function revalidatePerfumeDataCache() {
  revalidateTag("perfume", REVALIDATE_PROFILE)
}

/** Must match `tags` on house `unstable_cache` entries in `models/house.server.ts`. */
export function revalidateHouseDataCache() {
  revalidateTag("house", REVALIDATE_PROFILE)
}

export const perfumeCommunityCacheTag = (perfumeId: string) =>
  `perfume-community-${perfumeId}`

/**
 * Ratings, approved reviews, and season votes shown on the perfume page.
 * Expires immediately so the writer sees their own change on the next load.
 * Called from model writes that also run in scripts/tests, where Next has no
 * cache store and `revalidateTag` throws; the time-based revalidate covers those.
 */
export const revalidatePerfumeCommunityCache = (perfumeId: string) => {
  try {
    revalidateTag(perfumeCommunityCacheTag(perfumeId), { expire: 0 })
  } catch {
    // No Next.js request context.
  }
}

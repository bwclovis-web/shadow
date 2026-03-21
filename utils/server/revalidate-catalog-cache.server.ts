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

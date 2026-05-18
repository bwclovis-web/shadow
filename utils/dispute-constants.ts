import type { DisputeCategory } from "@prisma/client"

/** Shared dispute categories — safe to import from client components. */
export const DISPUTE_CATEGORIES: DisputeCategory[] = [
  "noShip",
  "fakeItem",
  "notAsDescribed",
  "scam",
  "other",
]

import { unstable_cache } from "next/cache"

import { prisma } from "@/lib/db"

const CATALOG_STATS_REVALIDATE_SECONDS = 3600

export type CatalogStats = {
  users: number
  houses: number
  perfumes: number
}

const fetchCatalogStats = async (): Promise<CatalogStats> => {
  const [users, houses, perfumes] = await Promise.all([
    prisma.user.count(),
    prisma.perfumeHouse.count(),
    prisma.perfume.count(),
  ])

  return { users, houses, perfumes }
}

export const getCatalogStats = (): Promise<CatalogStats> =>
  unstable_cache(fetchCatalogStats, ["catalog-stats"], {
    revalidate: CATALOG_STATS_REVALIDATE_SECONDS,
    tags: ["catalog-stats"],
  })()

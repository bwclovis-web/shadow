import { getBottleEntries, type UserInventoryRow } from "@/lib/user-inventory"

export type CollectionCountStats = {
  bottleCount: number
  houseCount: number
}

type RowWithHouse = UserInventoryRow & {
  perfume?: { perfumeHouse?: { id: string } | null } | null
}

/** Bottle and house counts from in-memory collection rows (client-safe). */
export const computeCollectionCounts = (rows: RowWithHouse[]): CollectionCountStats => {
  const bottles = getBottleEntries(rows)
  const perfumeIds = new Set(bottles.map((b) => b.perfumeId))
  const houseIds = new Set<string>()
  for (const b of bottles) {
    const houseId = b.perfume?.perfumeHouse?.id
    if (houseId) houseIds.add(houseId)
  }
  return {
    bottleCount: perfumeIds.size,
    houseCount: houseIds.size,
  }
}

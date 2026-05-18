import type { DecantFormat } from "@prisma/client"

import { EXCHANGE_SAMPLE_MAX_ML } from "@/utils/exchange-constants"

export type ListingKind = "decant" | "sample" | "full" | "partial"

export type InventoryListingStatus = "notTrading" | "listed" | "partiallyListed"

export type UserInventoryRow = {
  id: string
  perfumeId: string
  amount?: string | null
  available?: string | null
  pausedAvailable?: string | null
  decantFormat?: DecantFormat | null
}

export const parseMl = (value?: string | null): number => {
  const n = parseFloat((value ?? "").replace(/[^0-9.]/g, "") || "0")
  return Number.isFinite(n) ? n : 0
}

export const isCollectionBottle = (row: UserInventoryRow): boolean =>
  parseMl(row.amount) > 0

export const isActiveListing = (row: UserInventoryRow): boolean =>
  parseMl(row.available) > 0

export const getListingKind = (row: UserInventoryRow): ListingKind | null => {
  const availableMl = parseMl(row.available)
  if (availableMl <= 0) return null

  if (row.decantFormat != null) return "decant"

  const amountMl = parseMl(row.amount)
  if (availableMl > 0 && availableMl <= EXCHANGE_SAMPLE_MAX_ML && amountMl <= 0) {
    return "sample"
  }
  if (amountMl > 0 && availableMl >= amountMl) return "full"
  return "partial"
}

export const getBottleEntries = <T extends UserInventoryRow>(list: T[]): T[] =>
  list.filter(isCollectionBottle)

export const getActiveListings = <T extends UserInventoryRow>(list: T[]): T[] =>
  list.filter(isActiveListing)

export const isPausedListing = (row: UserInventoryRow): boolean =>
  parseMl(row.available) <= 0 && parseMl(row.pausedAvailable) > 0

export const getPausedListings = <T extends UserInventoryRow>(list: T[]): T[] =>
  list.filter(isPausedListing)

export const getResumeListingMl = (row: UserInventoryRow): number =>
  parseMl(row.pausedAvailable)

/** Listing kind chips for a paused row (uses stored ml before pause). */
export const getPausedListingKind = (row: UserInventoryRow): ListingKind | null =>
  getListingKind({
    ...row,
    available: row.pausedAvailable ?? "0",
  })

export const groupBottlesByPerfumeId = <T extends UserInventoryRow>(
  rows: T[]
): Map<string, T[]> => {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const list = map.get(row.perfumeId)
    if (list) list.push(row)
    else map.set(row.perfumeId, [row])
  }
  return map
}

export const totalListedMlForPerfume = (
  perfumeId: string,
  allRows: UserInventoryRow[]
): number =>
  allRows
    .filter((r) => r.perfumeId === perfumeId)
    .reduce((sum, r) => sum + parseMl(r.available), 0)

export const getInventoryListingStatus = (
  bottle: UserInventoryRow,
  allRows: UserInventoryRow[]
): InventoryListingStatus => {
  const totalListed = totalListedMlForPerfume(bottle.perfumeId, allRows)
  if (totalListed <= 0) return "notTrading"

  const bottleListed = parseMl(bottle.available)
  const bottleAmount = parseMl(bottle.amount)
  if (bottleListed > 0 && bottleAmount > 0 && bottleListed < bottleAmount) {
    return "partiallyListed"
  }
  return "listed"
}

import type { DecantSplitStatus } from "@prisma/client"

import { parseMl, type UserInventoryRow } from "@/lib/user-inventory"

/** Splits that reserve pourable ml until completed or cancelled. */
export const ACTIVE_DECANT_SPLIT_STATUSES: DecantSplitStatus[] = [
  "open",
  "filling",
  "shipped",
]

export const sumOwnedMlForPerfume = (rows: UserInventoryRow[]): number =>
  rows.reduce((sum, row) => sum + parseMl(row.amount), 0)

export const sumListedMlForPerfume = (rows: UserInventoryRow[]): number =>
  rows.reduce((sum, row) => sum + parseMl(row.available), 0)

export const computePourableMlBudget = (params: {
  ownedMl: number
  listedMl: number
  reservedMl: number
}): {
  ownedMl: number
  listedMl: number
  reservedMl: number
  remainingPourableMl: number
} => {
  const { ownedMl, listedMl, reservedMl } = params
  const remainingPourableMl = Math.max(0, ownedMl - listedMl - reservedMl)
  return { ownedMl, listedMl, reservedMl, remainingPourableMl }
}

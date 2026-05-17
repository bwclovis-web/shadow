import { Prisma } from "@prisma/client"

import type { PerfumeDiscoveryFilters } from "@/utils/discovery-filters"
import {
  EXCHANGE_BOTTLE_TYPES,
  type ExchangeBottleType,
  type ExchangeRegionBucket,
} from "@/utils/discovery-filters"
import { prisma } from "@/lib/db"

/** Max ml for classifying a listing as a sample (exchange bottle-type filter). */
export const EXCHANGE_SAMPLE_MAX_ML = 10

const parseMlSql = (column: string) =>
  `(NULLIF(REGEXP_REPLACE(TRIM(${column}), '[^0-9.]', '', 'g'), ''))::numeric`

/** SQL expression classifying a UserPerfume row into an exchange bottle type. */
export const exchangeBottleTypeCaseSql = `CASE
  WHEN up."decantFormat" IS NOT NULL THEN 'decant'
  WHEN ${parseMlSql("up.available")} > 0 AND ${parseMlSql("up.available")} <= ${EXCHANGE_SAMPLE_MAX_ML} THEN 'sample'
  WHEN ${parseMlSql("up.amount")} > 0 AND ${parseMlSql("up.available")} >= ${parseMlSql("up.amount")} THEN 'full'
  ELSE 'partial'
END`

export const hasExchangeListingFilters = (
  discovery: PerfumeDiscoveryFilters | undefined
): boolean =>
  Boolean(
    discovery &&
      (discovery.tradePreferences.length > 0 ||
        discovery.bottleTypes.length > 0 ||
        discovery.conditions.length > 0 ||
        discovery.region != null ||
        discovery.hasPhotos)
  )

const tradePreferenceWhere = (
  pref: PerfumeDiscoveryFilters["tradePreferences"][number]
): Prisma.UserPerfumeWhereInput => {
  switch (pref) {
    case "cash":
      return { tradeOnly: false, tradePreference: "cash" }
    case "trade":
      return { OR: [{ tradeOnly: true }, { tradePreference: "trade" }] }
    case "both":
      return { tradeOnly: false, tradePreference: "both" }
    default:
      return { tradePreference: pref }
  }
}

export const buildUserRegionWhereForExchangeBucket = (
  bucket: ExchangeRegionBucket
): Prisma.UserWhereInput => {
  switch (bucket) {
    case "US":
      return {
        OR: [
          { region: "United States" },
          { region: "US" },
          { region: { equals: "us", mode: "insensitive" } },
        ],
      }
    case "UK":
      return {
        OR: [
          { region: "United Kingdom" },
          { region: "UK" },
          { region: "GB" },
          { region: { equals: "uk", mode: "insensitive" } },
        ],
      }
    case "AU":
      return {
        OR: [
          { region: "Australia" },
          { region: "AU" },
          { region: { equals: "au", mode: "insensitive" } },
        ],
      }
    case "EU":
      return {
        OR: [
          { region: { equals: "EU", mode: "insensitive" } },
          { region: "Europe" },
          { region: { equals: "eu", mode: "insensitive" } },
        ],
      }
    case "other":
      return {
        OR: [
          { region: { equals: "other", mode: "insensitive" } },
          { region: "Other" },
        ],
      }
    default:
      return { region: bucket }
  }
}

/**
 * Prisma `where` for in-stock listings matching trade, condition, photos, and region filters.
 * Bottle type uses {@link fetchUserPerfumeIdsMatchingBottleTypes} when needed.
 */
export const buildExchangeListingUserPerfumeWhere = (
  discovery: PerfumeDiscoveryFilters | undefined
): Prisma.UserPerfumeWhereInput | undefined => {
  if (!discovery) return undefined

  const parts: Prisma.UserPerfumeWhereInput[] = []

  if (discovery.tradePreferences.length > 0) {
    parts.push({
      OR: discovery.tradePreferences.map(tradePreferenceWhere),
    })
  }

  if (discovery.conditions.length > 0) {
    parts.push({ condition: { in: discovery.conditions } })
  }

  if (discovery.hasPhotos) {
    parts.push({ NOT: { images: { equals: [] } } })
  }

  if (discovery.region) {
    parts.push({
      user: buildUserRegionWhereForExchangeBucket(discovery.region),
    })
  }

  if (parts.length === 0) return undefined
  return parts.length === 1 ? parts[0]! : { AND: parts }
}

export const mergeUserPerfumeListingWhere = (
  base: Prisma.UserPerfumeWhereInput,
  extra: Prisma.UserPerfumeWhereInput | undefined,
  bottleTypeIds?: string[]
): Prisma.UserPerfumeWhereInput => {
  const andParts: Prisma.UserPerfumeWhereInput[] = [base]
  if (extra) andParts.push(extra)
  if (bottleTypeIds && bottleTypeIds.length > 0) {
    andParts.push({ id: { in: bottleTypeIds } })
  }
  return andParts.length === 1 ? andParts[0]! : { AND: andParts }
}

export const fetchUserPerfumeIdsMatchingBottleTypes = async (
  bottleTypes: ExchangeBottleType[]
): Promise<string[]> => {
  if (bottleTypes.length === 0) return []

  const allowed = bottleTypes.filter(t =>
    (EXCHANGE_BOTTLE_TYPES as readonly string[]).includes(t)
  )
  if (allowed.length === 0) return []

  const typeList = Prisma.join(
    allowed.map(t => Prisma.sql`${t}`),
    ", "
  )

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT up.id AS id
    FROM "UserPerfume" up
    WHERE up."available" <> '0'
      AND (${Prisma.raw(exchangeBottleTypeCaseSql)}) IN (${typeList})
  `
  return rows.map(r => r.id)
}

export const fetchPerfumeIdsWithMatchingListings = async (
  discovery: PerfumeDiscoveryFilters
): Promise<string[] | null> => {
  const listingWhere = buildExchangeListingUserPerfumeWhere(discovery)
  const needsBottleSql = discovery.bottleTypes.length > 0

  if (!listingWhere && !needsBottleSql) return null

  let bottleIds: string[] | undefined
  if (needsBottleSql) {
    bottleIds = await fetchUserPerfumeIdsMatchingBottleTypes(discovery.bottleTypes)
    if (bottleIds.length === 0) return []
  }

  const userPerfumeWhere = mergeUserPerfumeListingWhere(
    { available: { not: "0" } },
    listingWhere,
    bottleIds
  )

  const rows = await prisma.userPerfume.findMany({
    where: userPerfumeWhere,
    select: { perfumeId: true },
    distinct: ["perfumeId"],
  })
  return rows.map(r => r.perfumeId)
}

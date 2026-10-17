import { unstable_cache } from "next/cache"

import { prisma } from "@/lib/db"
import {
  availableListingWhere,
  NEW_LISTINGS_WEEK_REVALIDATE_SECONDS,
} from "@/models/activity-feed.server"
import type { HomeListing } from "@/types/home-listing"
import { getTraderDisplayName } from "@/utils/user"

export const HOME_LATEST_LISTINGS_LIMIT = 4

const homeListingSelect = {
  id: true,
  createdAt: true,
  images: true,
  available: true,
  type: true,
  condition: true,
  decantFormat: true,
  tradePreference: true,
  tradeOnly: true,
  perfume: {
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      perfumeHouse: { select: { name: true } },
    },
  },
  user: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarImage: true,
    },
  },
} as const

export const getHomeLatestListings = async (
  limit = HOME_LATEST_LISTINGS_LIMIT
): Promise<HomeListing[]> => {
  const rows = await prisma.userPerfume.findMany({
    where: availableListingWhere,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: homeListingSelect,
  })

  return rows.map(row => ({
    id: row.id,
    createdAt: row.createdAt,
    images: row.images,
    availableMl: row.available,
    type: row.type,
    condition: row.condition,
    decantFormat: row.decantFormat,
    tradePreference: row.tradePreference,
    tradeOnly: row.tradeOnly,
    perfume: {
      id: row.perfume.id,
      name: row.perfume.name,
      slug: row.perfume.slug,
      image: row.perfume.image,
      houseName: row.perfume.perfumeHouse?.name ?? null,
    },
    trader: {
      id: row.user.id,
      displayName: getTraderDisplayName({
        username: row.user.username,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
      }),
      avatarImage: row.user.avatarImage,
    },
  }))
}

/** Same result for every viewer; shares the Exchange new-listings revalidate window and tag. */
export const getCachedHomeLatestListings = async (
  limit = HOME_LATEST_LISTINGS_LIMIT
): Promise<HomeListing[]> => {
  const listings = await unstable_cache(
    () => getHomeLatestListings(limit),
    ["home-latest-listings", String(limit)],
    {
      revalidate: NEW_LISTINGS_WEEK_REVALIDATE_SECONDS,
      tags: ["exchange-new-week"],
    }
  )()
  // unstable_cache stores JSON, so Date fields come back as strings.
  return listings.map(listing => ({
    ...listing,
    createdAt: new Date(listing.createdAt),
  }))
}

import type { WishlistBottlePreference } from "@prisma/client"

import { prisma } from "@/lib/db"
import { updateScentProfileFromBehavior } from "@/models/scent-profile.server"

export const addToWishlist = async (
  userId: string,
  perfumeId: string,
  isPublic: boolean = false,
  bottlePreference: WishlistBottlePreference = "any"
) => {
  // Check if item already exists in wishlist
  const existing = await prisma.userPerfumeWishlist.findFirst({
    where: {
      userId,
      perfumeId,
    },
  })

  if (existing) {
    return { success: false, error: "Perfume already in wishlist" }
  }

  const wishlistItem = await prisma.userPerfumeWishlist.create({
    data: {
      userId,
      perfumeId,
      isPublic,
      bottlePreference,
    },
  })

  try {
    await updateScentProfileFromBehavior(userId, {
      type: "wishlist",
      perfumeId,
    })
  } catch (error) {
    console.error("Error updating scent profile from behavior:", error)
    // Don't fail the operation if scent profile update fails
  }

  return { success: true, data: wishlistItem }
}

export const removeFromWishlist = async (userId: string, perfumeId: string) => {
  const deleted = await prisma.userPerfumeWishlist.deleteMany({
    where: {
      userId,
      perfumeId,
    },
  })

  return { success: true, data: deleted }
}

export const updateWishlistVisibility = async (
  userId: string,
  perfumeId: string,
  isPublic: boolean
) => {
  const updated = await prisma.userPerfumeWishlist.updateMany({
    where: {
      userId,
      perfumeId,
    },
    data: {
      isPublic,
    },
  })

  // Do not update scent profile here: visibility is a privacy toggle, not a
  // new preference signal. Only addToWishlist should feed the scent profile.
  return { success: true, data: updated }
}

export const updateWishlistBottlePreference = async (
  userId: string,
  perfumeId: string,
  bottlePreference: WishlistBottlePreference
) => {
  const updated = await prisma.userPerfumeWishlist.updateMany({
    where: {
      userId,
      perfumeId,
    },
    data: {
      bottlePreference,
    },
  })

  return { success: true, data: updated }
}

export const isInWishlist = async (userId: string, perfumeId: string) => {
  const count = await prisma.userPerfumeWishlist.count({
    where: { userId, perfumeId },
  })
  return count > 0
}

export type PublicWishlistItem = {
  id: string
  perfumeId: string
  isPublic: boolean
  bottlePreference: WishlistBottlePreference
  createdAt: Date
  perfume: {
    id: string
    name: string
    slug: string
    image: string | null
    perfumeHouse: { id: string; name: string; slug: string } | null
  }
}

export const getPublicWishlistForUser = async (
  userId: string
): Promise<PublicWishlistItem[]> => {
  return prisma.userPerfumeWishlist.findMany({
    where: {
      userId,
      isPublic: true,
    },
    select: {
      id: true,
      perfumeId: true,
      isPublic: true,
      bottlePreference: true,
      createdAt: true,
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          perfumeHouse: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

export const getUserWishlist = async (userId: string) => {
  const wishlist = await prisma.userPerfumeWishlist.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      userId: true,
      perfumeId: true,
      isPublic: true,
      bottlePreference: true,
      createdAt: true,
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          perfumeHouse: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const perfumeIds = wishlist.map(item => item.perfumeId)
  const availablePerfumes =
    perfumeIds.length === 0
      ? []
      : await prisma.userPerfume.findMany({
          where: {
            perfumeId: { in: perfumeIds },
            available: { not: "0" },
          },
          select: {
            id: true,
            perfumeId: true,
            available: true,
            userId: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        })

  type AvailableItem = (typeof availablePerfumes)[number]
  const availableMap = new Map<string, AvailableItem[]>()
  for (const up of availablePerfumes) {
    const list = availableMap.get(up.perfumeId)
    if (list) list.push(up)
    else availableMap.set(up.perfumeId, [up])
  }

  // Combine wishlist items with available user perfumes
  return wishlist.map(item => ({
    ...item,
    perfume: {
      ...item.perfume,
      userPerfume: availableMap.get(item.perfumeId) || [],
    },
  }))
}

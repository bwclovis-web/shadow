import { prisma } from "~/db.server"
import { updateScentProfileFromBehavior } from "~/models/scent-profile.server"

export const addToWishlist = async (
  userId: string,
  perfumeId: string,
  isPublic: boolean = false
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

export const isInWishlist = async (userId: string, perfumeId: string) => {
  const item = await prisma.userPerfumeWishlist.findFirst({
    where: {
      userId,
      perfumeId,
    },
  })

  return !!item
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

  // Fetch available perfumes with user info for all wishlist items
  const perfumeIds = wishlist.map(item => item.perfumeId)
  const availablePerfumes = await prisma.userPerfume.findMany({
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
          email: true,
        },
      },
    },
  })

  // Group available perfumes by perfumeId
  const availableMap = new Map<string, typeof availablePerfumes>()
  availablePerfumes.forEach(up => {
    if (!availableMap.has(up.perfumeId)) {
      availableMap.set(up.perfumeId, [])
    }
    availableMap.get(up.perfumeId)!.push(up)
  })

  // Combine wishlist items with available user perfumes
  return wishlist.map(item => ({
    ...item,
    perfume: {
      ...item.perfume,
      userPerfume: availableMap.get(item.perfumeId) || [],
    },
  }))
}

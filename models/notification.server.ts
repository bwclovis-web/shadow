import { prisma } from "~/db.server"

const checkItemNeedsNotification = async (wishlistItem: any) => {
  if (wishlistItem.perfume.userPerfume.length === 0) {
    return false
  }

  const existingNotification = await prisma.wishlistNotification.findFirst({
    where: {
      userId: wishlistItem.userId,
      perfumeId: wishlistItem.perfumeId,
    },
  })

  return !existingNotification
}

export const checkAndNotifyWishlistAvailability = async () => {
  // Find all wishlist items where the perfume has become available
  const wishlistItemsWithAvailability = await prisma.userPerfumeWishlist.findMany({
    include: {
      user: true,
      perfume: {
        include: {
          userPerfume: {
            where: {
              available: {
                not: "0",
              },
            },
            include: {
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
          },
        },
      },
    },
  })

  // Filter to only items that have availability and haven't been notified yet
  const itemsToNotify = []

  for (const wishlistItem of wishlistItemsWithAvailability) {
    const needsNotification = await checkItemNeedsNotification(wishlistItem)
    if (needsNotification) {
      itemsToNotify.push(wishlistItem)
    }
  }

  return itemsToNotify
}

export async function markAsNotified(userId: string, perfumeId: string) {
  return await prisma.wishlistNotification.create({
    data: {
      userId,
      perfumeId,
    },
  })
}

export async function getWishlistNotifications(userId: string) {
  return await prisma.wishlistNotification.findMany({
    where: {
      userId,
    },
    include: {
      perfume: {
        include: {
          perfumeHouse: true,
        },
      },
    },
    orderBy: {
      notifiedAt: "desc",
    },
  })
}

export async function clearNotification(userId: string, perfumeId: string) {
  return await prisma.wishlistNotification.deleteMany({
    where: {
      userId,
      perfumeId,
    },
  })
}

import { prisma } from "@/lib/db"
import { createUserAlert } from "@/models/user-alerts.server"

const STALE_DAYS = 30
const MAX_NUDGES_PER_USER = 3

/**
 * CF-062: Re-engage collectors whose wishlist items have sat without a match.
 * Uses existing wishlist_available alerts + digest card — no new noun.
 */
export const getStaleWishlistItemsForUser = async (userId: string) => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - STALE_DAYS)

  const items = await prisma.userPerfumeWishlist.findMany({
    where: {
      userId,
      createdAt: { lte: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_NUDGES_PER_USER,
    select: {
      id: true,
      perfumeId: true,
      createdAt: true,
      perfume: { select: { id: true, name: true, slug: true } },
    },
  })

  return items.map(item => ({
    wishlistItemId: item.id,
    perfumeId: item.perfumeId,
    perfumeName: item.perfume.name,
    perfumeSlug: item.perfume.slug,
    addedAt: item.createdAt.toISOString(),
  }))
}

export const createWishlistReengagementAlerts = async (userId: string) => {
  const stale = await getStaleWishlistItemsForUser(userId)
  if (stale.length === 0) return 0

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  let created = 0
  for (const item of stale) {
    const recent = await prisma.userAlert.findFirst({
      where: {
        userId,
        perfumeId: item.perfumeId,
        alertType: "wishlist_available",
        createdAt: { gte: weekAgo },
        isDismissed: false,
      },
      select: { id: true },
    })
    if (recent) continue

    const alert = await createUserAlert(
      userId,
      item.perfumeId,
      "wishlist_available",
      `Still hunting for ${item.perfumeName}?`,
      "No recent listing match — check The Archive or The Exchange, or keep this bottle on your wishlist.",
      {
        kind: "reengagement",
        perfumeSlug: item.perfumeSlug,
        targetUrl: `/perfume/${item.perfumeSlug}`,
      }
    )
    if (alert) created += 1
  }
  return created
}

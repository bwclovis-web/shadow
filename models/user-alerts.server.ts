import { Prisma, type PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { AlertType, UserAlertPreferences } from "@/types/database"

type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

const ALERT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

const defaultAlertPreferences = {
  wishlistAlertsEnabled: true,
  decantAlertsEnabled: true,
  emailWishlistAlerts: false,
  emailDecantAlerts: false,
  maxAlerts: 10,
} as const

/**
 * Get user's active alerts (not dismissed, ordered by newest first)
 */
export const getUserAlerts = async (userId: string, limit: number = 10) =>
  prisma.userAlert.findMany({
    where: {
      userId,
      isDismissed: false,
    },
    include: {
      User: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      Perfume: {
        include: {
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
    take: limit,
  })

/**
 * Get user's alert preferences, creating default preferences if none exist (single query via upsert)
 */
export const getUserAlertPreferences = async (userId: string): Promise<UserAlertPreferences> =>
  prisma.userAlertPreferences.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...defaultAlertPreferences,
    },
  }) as unknown as Promise<UserAlertPreferences>

/**
 * Update user's alert preferences
 */
export const updateUserAlertPreferences = async (
  userId: string,
  preferences: Partial<Omit<UserAlertPreferences, "id" | "userId" | "user">>
) =>
  prisma.userAlertPreferences.upsert({
    where: { userId },
    update: preferences,
    create: {
      userId,
      wishlistAlertsEnabled: preferences.wishlistAlertsEnabled ?? true,
      decantAlertsEnabled: preferences.decantAlertsEnabled ?? true,
      emailWishlistAlerts: preferences.emailWishlistAlerts ?? false,
      emailDecantAlerts: preferences.emailDecantAlerts ?? false,
      maxAlerts: preferences.maxAlerts ?? 10,
    },
  })

/**
 * Mark an alert as read
 */
export const markAlertAsRead = async (alertId: string, userId: string) =>
  prisma.userAlert.updateMany({
    where: {
      id: alertId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })

/**
 * Dismiss an alert (remove it from view)
 */
export const dismissAlert = async (alertId: string, userId: string) =>
  prisma.userAlert.updateMany({
    where: {
      id: alertId,
      userId,
    },
    data: {
      isDismissed: true,
      dismissedAt: new Date(),
    },
  })

/**
 * Dismiss all alerts for a user
 */
export const dismissAllAlerts = async (userId: string) =>
  prisma.userAlert.updateMany({
    where: {
      userId,
      isDismissed: false,
    },
    data: {
      isDismissed: true,
      dismissedAt: new Date(),
    },
  })

/**
 * Create a new user alert. Pass existing preferences to avoid an extra DB round-trip when the caller already has them.
 * For new_trader_message alerts, pass perfumeId: null.
 */
export const createUserAlert = async (
  userId: string,
  perfumeId: string | null,
  alertType: AlertType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
  existingPreferences?: Omit<UserAlertPreferences, "user"> | null
) => {
  const preferences =
    existingPreferences ?? (await getUserAlertPreferences(userId))

  if (alertType === "wishlist_available" && !preferences.wishlistAlertsEnabled) return null
  if (alertType === "decant_interest" && !preferences.decantAlertsEnabled) return null

  return prisma.$transaction(async tx => {
    const currentAlertCount = await tx.userAlert.count({
      where: { userId, isDismissed: false },
    })

    if (currentAlertCount >= preferences.maxAlerts) {
      const oldestAlerts = await tx.userAlert.findMany({
        where: { userId, isDismissed: false },
        orderBy: { createdAt: "asc" },
        take: currentAlertCount - preferences.maxAlerts + 1,
        select: { id: true },
      })
      await tx.userAlert.updateMany({
        where: { id: { in: oldestAlerts.map((a: { id: string }) => a.id) } },
        data: { isDismissed: true, dismissedAt: new Date() },
      })
    }

    return tx.userAlert.create({
      data: {
        userId,
        perfumeId: perfumeId ?? undefined,
        alertType,
        title,
        message,
        metadata: metadata as Prisma.InputJsonValue,
      },
      include: {
        Perfume: {
          include: {
            perfumeHouse: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    })
  })
}

/**
 * Get count of unread alerts for a user
 */
export const getUnreadAlertCount = async (userId: string): Promise<number> =>
  prisma.userAlert.count({
    where: {
      userId,
      isRead: false,
      isDismissed: false,
    },
  })

/**
 * Check if user should receive wishlist availability alerts
 * Only alerts users with PUBLIC wishlists
 * @param perfumeId - The perfume that became available
 * @param decantingUserId - Optional: The user who made the perfume available (to exclude from notifications)
 */
export const checkWishlistAvailabilityAlerts = async (
  perfumeId: string,
  decantingUserId?: string
) => {
  const wishlistUsers = await prisma.userPerfumeWishlist.findMany({
    where: {
      perfumeId,
      isPublic: true,
      // Exclude the user who just decanted
      ...(decantingUserId && { userId: { not: decantingUserId } }),
    },
    include: {
      user: {
        include: {
          alertPreferences: true,
        },
      },
      perfume: {
        include: {
          perfumeHouse: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  const availableTraders = await prisma.userPerfume.findMany({
    where: {
      perfumeId,
      available: { not: "0" },
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
  })

  const since = new Date(Date.now() - ALERT_DEDUPE_WINDOW_MS)
  const existingAlertUserIds = new Set(
    (
      await prisma.userAlert.findMany({
        where: {
          userId: { in: wishlistUsers.map((w: { userId: string }) => w.userId) },
          perfumeId,
          alertType: "wishlist_available",
          isDismissed: false,
          createdAt: { gte: since },
        },
        select: { userId: true },
      })
    ).map((a: { userId: string }) => a.userId)
  )

  const alertsToCreate: Array<{
    userId: string
    perfumeId: string
    alertType: AlertType
    title: string
    message: string
    metadata: Record<string, unknown>
    preferences?: Omit<UserAlertPreferences, "user"> | null
  }> = []

  for (const wishlistItem of wishlistUsers) {
    const preferences = wishlistItem.user.alertPreferences
    if (preferences?.wishlistAlertsEnabled === false) continue
    if (existingAlertUserIds.has(wishlistItem.userId)) continue
    existingAlertUserIds.add(wishlistItem.userId)

    const title = `${wishlistItem.perfume.name} is now available!`
    const message = `${wishlistItem.perfume.name} by ${wishlistItem.perfume.perfumeHouse?.name} is now available on the trading post from ${availableTraders.length} trader(s).`
    alertsToCreate.push({
      userId: wishlistItem.userId,
      perfumeId,
      alertType: "wishlist_available" as AlertType,
      title,
      message,
      preferences,
      metadata: {
        availableTraders: availableTraders.map((trader: { user: { id: string; firstName: string | null; lastName: string | null; username: string | null; email: string } }) => ({
          userId: trader.user.id,
          displayName:
            trader.user.username ||
            (trader.user.firstName && trader.user.lastName
              ? `${trader.user.firstName} ${trader.user.lastName}`.trim()
              : null) ||
            trader.user.email ||
            "Unknown Trader",
          email: trader.user.email,
        })),
      },
    })
  }

  const createdAlerts = []
  for (const alertData of alertsToCreate) {
    const alert = await createUserAlert(
      alertData.userId,
      alertData.perfumeId,
      alertData.alertType,
      alertData.title,
      alertData.message,
      alertData.metadata,
      alertData.preferences
    )
    if (alert) {
      createdAlerts.push(alert)
    }
  }

  return createdAlerts
}

/**
 * Check if user should receive decant interest alerts
 * Only sends alerts when the wishlist item is PUBLIC
 */
export const checkDecantInterestAlerts = async (
  perfumeId: string,
  interestedUserId: string,
  isPublicWishlist: boolean = false
) => {
  if (!isPublicWishlist) return []

  const decanters = await prisma.userPerfume.findMany({
    where: {
      perfumeId,
      available: {
        not: "0",
      },
      userId: {
        not: interestedUserId, // Don't alert the interested user about themselves
      },
    },
    include: {
      user: {
        include: {
          alertPreferences: true,
        },
      },
      perfume: {
        include: {
          perfumeHouse: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  // Get the interested user's info
  const interestedUser = await prisma.user.findUnique({
    where: { id: interestedUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
    },
  })

  if (!interestedUser) return []

  const since = new Date(Date.now() - ALERT_DEDUPE_WINDOW_MS)
  const existingDecanterIds = new Set(
    (
      await prisma.userAlert.findMany({
        where: {
          userId: { in: decanters.map((d: { userId: string }) => d.userId) },
          perfumeId,
          alertType: "decant_interest",
          isDismissed: false,
          metadata: { path: ["interestedUserId"], equals: interestedUserId },
          createdAt: { gte: since },
        },
        select: { userId: true },
      })
    ).map((a: { userId: string }) => a.userId)
  )

  const alertsToCreate: Array<{
    userId: string
    perfumeId: string
    alertType: AlertType
    title: string
    message: string
    metadata: Record<string, unknown>
    preferences?: Omit<UserAlertPreferences, "user"> | null
  }> = []

  for (const decanter of decanters) {
    const preferences = decanter.user.alertPreferences
    if (preferences?.decantAlertsEnabled === false) continue
    if (existingDecanterIds.has(decanter.userId)) continue
    existingDecanterIds.add(decanter.userId)

    const interestedUserName =
      interestedUser.username ||
      (interestedUser.firstName && interestedUser.lastName
        ? `${interestedUser.firstName} ${interestedUser.lastName}`.trim()
        : null) ||
      interestedUser.email ||
      "Unknown User"

    const title = `Someone wants your ${decanter.perfume.name}!`
    const message = `${interestedUserName} added ${decanter.perfume.name} by ${decanter.perfume.perfumeHouse?.name} to their wishlist. They might be interested in trading with you!`
    alertsToCreate.push({
      userId: decanter.userId,
      perfumeId,
      alertType: "decant_interest" as AlertType,
      title,
      message,
      preferences,
      metadata: {
        interestedUserId,
        interestedUserName,
        interestedUserEmail: interestedUser.email,
      },
    })
  }

  const createdAlerts = []
  for (const alertData of alertsToCreate) {
    const alert = await createUserAlert(
      alertData.userId,
      alertData.perfumeId,
      alertData.alertType,
      alertData.title,
      alertData.message,
      alertData.metadata,
      alertData.preferences
    )
    if (alert) {
      createdAlerts.push(alert)
    }
  }

  return createdAlerts
}

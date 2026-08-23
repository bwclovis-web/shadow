import type { Prisma, SavedSearchAlertFrequency } from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  createUserAlert,
  dispatchPushForUserAlert,
  getUserAlertPreferences,
} from "@/models/user-alerts.server"
import type { UserAlertPreferences } from "@/types/database"
import { sendSavedSearchAlertEmail } from "@/utils/alert-email.server"
import { requireEntitlement } from "@/utils/membership/entitlements.server"

export type SavedSearchQuery = {
  perfumeName?: string
  houseName?: string
  notes?: string[]
  noteIds?: string[]
  houseId?: string
  perfumeId?: string
  /** Free-text query (Archive `q` or Exchange search) */
  q?: string
  source?: "archive" | "exchange"
  alertOnNewListing?: boolean
  alertOnEditorial?: boolean
}

const SNOOZE_DAYS = 7

const buildTargetUrl = (payloadObj: Record<string, unknown>) => {
  const payloadKind =
    typeof payloadObj.kind === "string" ? payloadObj.kind : undefined
  const perfumeSlug =
    typeof payloadObj.perfumeSlug === "string" ? payloadObj.perfumeSlug : undefined
  if (payloadKind === "exchange_listing") return "/the-exchange"
  if (perfumeSlug) return `/perfume/${perfumeSlug}`
  return "/the-archive"
}

export const createSavedSearch = async (params: {
  userId: string
  name: string
  query: SavedSearchQuery
  alertEnabled?: boolean
}) => {
  return prisma.savedSearch.create({
    data: {
      userId: params.userId,
      name: params.name.trim().slice(0, 120),
      query: params.query as Prisma.InputJsonValue,
      alertEnabled: params.alertEnabled ?? true,
    },
  })
}

export const listSavedSearches = async (userId: string) => {
  return prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      alertEnabled: true,
      snoozedUntil: true,
      lastMatchedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export const deleteSavedSearch = async (userId: string, id: string) => {
  return prisma.savedSearch.deleteMany({
    where: { id, userId },
  })
}

export const setSavedSearchAlertEnabled = async (
  userId: string,
  id: string,
  alertEnabled: boolean
) => {
  return prisma.savedSearch.updateMany({
    where: { id, userId },
    data: { alertEnabled },
  })
}

export const snoozeSavedSearch = async (userId: string, id: string) => {
  const snoozedUntil = new Date()
  snoozedUntil.setDate(snoozedUntil.getDate() + SNOOZE_DAYS)
  return prisma.savedSearch.updateMany({
    where: { id, userId },
    data: { snoozedUntil },
  })
}

export const clearSavedSearchSnooze = async (userId: string, id: string) => {
  return prisma.savedSearch.updateMany({
    where: { id, userId },
    data: { snoozedUntil: null },
  })
}

export const isSavedSearchSnoozed = (snoozedUntil: Date | null | undefined) =>
  Boolean(snoozedUntil && snoozedUntil.getTime() > Date.now())

/**
 * Recent saved-search match rows for daily digest (Premium users on daily frequency).
 */
export const listRecentSavedSearchMatchesForDigest = async (
  userId: string,
  since: Date
) => {
  return prisma.savedSearchAlert.findMany({
    where: {
      createdAt: { gte: since },
      savedSearch: { userId },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      message: true,
      payload: true,
      createdAt: true,
      savedSearch: { select: { name: true } },
    },
  })
}

/**
 * Create an in-app alert for a matching saved search (Premium feature gate applied by caller).
 */
export const notifySavedSearchMatch = async (params: {
  userId: string
  savedSearchId: string
  title: string
  message: string
  payload?: Prisma.InputJsonValue
  preferences?: UserAlertPreferences | null
  delivery?: SavedSearchAlertFrequency
}) => {
  const preferences =
    params.preferences ?? (await getUserAlertPreferences(params.userId))

  if (preferences.savedSearchAlertsEnabled === false) {
    return null
  }

  const delivery =
    params.delivery ??
    preferences.savedSearchAlertFrequency ??
    "instant"

  const payloadObj =
    params.payload && typeof params.payload === "object" && !Array.isArray(params.payload)
      ? (params.payload as Record<string, unknown>)
      : {}

  const metadata = {
    ...payloadObj,
    savedSearchId: params.savedSearchId,
    kind: "saved_search_match",
    targetUrl: buildTargetUrl(payloadObj),
  }

  await prisma.savedSearchAlert.create({
    data: {
      savedSearchId: params.savedSearchId,
      title: params.title,
      message: params.message,
      payload: params.payload,
    },
  })

  await prisma.savedSearch.update({
    where: { id: params.savedSearchId },
    data: { lastMatchedAt: new Date() },
  })

  if (delivery === "daily") {
    return null
  }

  const instantEntitlement = await requireEntitlement(
    params.userId,
    "instant_alerts"
  )
  if (!instantEntitlement.ok) {
    return null
  }

  const alert = await createUserAlert(
    params.userId,
    null,
    "saved_search_match",
    params.title,
    params.message,
    metadata,
    preferences
  )

  if (alert) {
    dispatchPushForUserAlert({
      userId: params.userId,
      alertType: "saved_search_match",
      title: params.title,
      message: params.message,
      metadata,
    })

    const perfumeSlug =
      typeof payloadObj.perfumeSlug === "string" ? payloadObj.perfumeSlug : undefined
    if (perfumeSlug) {
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          profileSlug: true,
        },
      })
      if (user) {
        void sendSavedSearchAlertEmail({
          user,
          preferences,
          title: params.title,
          message: params.message,
          targetUrl: metadata.targetUrl as string,
        }).catch(err => {
          console.error("[email] Failed to send saved search alert email:", err)
        })
      }
    }
  }

  return alert
}

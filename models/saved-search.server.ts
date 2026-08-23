import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { createUserAlert } from "@/models/user-alerts.server"

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
    include: {
      alerts: {
        where: { isRead: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
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

/**
 * Create an in-app alert for a matching saved search (Premium feature gate applied by caller).
 */
export const notifySavedSearchMatch = async (params: {
  userId: string
  savedSearchId: string
  title: string
  message: string
  payload?: Prisma.InputJsonValue
}) => {
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

  const payloadObj =
    params.payload && typeof params.payload === "object" && !Array.isArray(params.payload)
      ? (params.payload as Record<string, unknown>)
      : {}
  const payloadKind =
    typeof payloadObj.kind === "string" ? payloadObj.kind : undefined
  const perfumeSlug =
    typeof payloadObj.perfumeSlug === "string" ? payloadObj.perfumeSlug : undefined

  await createUserAlert(
    params.userId,
    null,
    "followed_activity",
    params.title,
    params.message,
    {
      savedSearchId: params.savedSearchId,
      kind: "saved_search_match",
      targetUrl:
        payloadKind === "exchange_listing"
          ? "/the-exchange"
          : perfumeSlug
            ? `/perfume/${perfumeSlug}`
            : "/the-archive",
      ...payloadObj,
    }
  )
}

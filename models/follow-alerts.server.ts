import {
  createUserAlert,
  dispatchPushForUserAlert,
  getUserAlertPreferences,
} from "@/models/user-alerts.server"
import {
  getFollowersForHouse,
  getFollowersForPerfume,
  getFollowersOfUser,
} from "@/models/user-follow.server"
import { prisma } from "@/lib/db"
import { getUserDisplayName } from "@/utils/user"

export type FollowActivityKind = "listing" | "trade_completed" | "review"

const notifyFollowers = async (
  followerIds: string[],
  actorUserId: string,
  kind: FollowActivityKind,
  title: string,
  message: string,
  metadata: Record<string, unknown>
) => {
  const uniqueFollowers = [...new Set(followerIds)].filter(id => id !== actorUserId)
  if (uniqueFollowers.length === 0) return

  await Promise.all(
    uniqueFollowers.map(async followerId => {
      const preferences = await getUserAlertPreferences(followerId)
      const alert = await createUserAlert(
        followerId,
        (metadata.perfumeId as string) ?? null,
        "followed_activity",
        title,
        message,
        { kind, ...metadata },
        preferences
      )
      if (alert) {
        dispatchPushForUserAlert({
          userId: followerId,
          alertType: "followed_activity",
          title,
          message,
          metadata: { kind, ...metadata },
        })
      }
    })
  )
}

export const notifyFollowersOfNewListing = async (params: {
  actorUserId: string
  userPerfumeId: string
  perfumeId: string
  perfumeName: string
  houseId?: string | null
}) => {
  const { actorUserId, userPerfumeId, perfumeId, perfumeName, houseId } = params

  const [userFollowers, houseFollowers, perfumeFollowers, actor] = await Promise.all([
    getFollowersOfUser(actorUserId),
    houseId ? getFollowersForHouse(houseId) : Promise.resolve([]),
    getFollowersForPerfume(perfumeId),
    prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        email: true,
      },
    }),
  ])

  const actorName = actor ? getUserDisplayName(actor) : "A trader you follow"
  const title = `${actorName} listed ${perfumeName}`
  const message = "View on the exchange"

  await notifyFollowers(
    [...userFollowers, ...houseFollowers, ...perfumeFollowers],
    actorUserId,
    "listing",
    title,
    message,
    {
      userPerfumeId,
      perfumeId,
      targetUrl: `/the-exchange`,
      actorUserId,
    }
  )
}

export const notifyFollowersOfCompletedTrade = async (params: {
  tradeId: string
  initiatorId: string
  counterpartyId: string
  perfumeLabel: string
}) => {
  const { tradeId, initiatorId, counterpartyId, perfumeLabel } = params

  const [initiatorFollowers, counterpartyFollowers, initiator, counterparty] =
    await Promise.all([
      getFollowersOfUser(initiatorId),
      getFollowersOfUser(counterpartyId),
      prisma.user.findUnique({
        where: { id: initiatorId },
        select: { id: true, firstName: true, lastName: true, username: true, email: true },
      }),
      prisma.user.findUnique({
        where: { id: counterpartyId },
        select: { id: true, firstName: true, lastName: true, username: true, email: true },
      }),
    ])

  const initiatorName = initiator ? getUserDisplayName(initiator) : "A trader"
  const counterpartyName = counterparty ? getUserDisplayName(counterparty) : "a trader"

  await notifyFollowers(
    initiatorFollowers,
    initiatorId,
    "trade_completed",
    `${initiatorName} completed a trade`,
    `Regarding ${perfumeLabel}`,
    { tradeId, targetUrl: `/trader-profile/${initiatorId}`, actorUserId: initiatorId }
  )

  await notifyFollowers(
    counterpartyFollowers,
    counterpartyId,
    "trade_completed",
    `${counterpartyName} completed a trade`,
    `Regarding ${perfumeLabel}`,
    { tradeId, targetUrl: `/trader-profile/${counterpartyId}`, actorUserId: counterpartyId }
  )
}

export const notifyFollowersOfReview = async (params: {
  traderId: string
  reviewerId: string
  rating: number
}) => {
  const { traderId, reviewerId, rating } = params

  const [traderFollowers, reviewerFollowers, trader, reviewer] = await Promise.all([
    getFollowersOfUser(traderId),
    getFollowersOfUser(reviewerId),
    prisma.user.findUnique({
      where: { id: traderId },
      select: { id: true, firstName: true, lastName: true, username: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: reviewerId },
      select: { id: true, firstName: true, lastName: true, username: true, email: true },
    }),
  ])

  const traderName = trader ? getUserDisplayName(trader) : "A trader"
  const reviewerName = reviewer ? getUserDisplayName(reviewer) : "A reviewer"

  await notifyFollowers(
    traderFollowers,
    reviewerId,
    "review",
    `New review for ${traderName}`,
    `${reviewerName} left a ${rating}-star review`,
    { traderId, targetUrl: `/trader-profile/${traderId}#reviews`, actorUserId: reviewerId }
  )

  if (traderId !== reviewerId) {
    await notifyFollowers(
      reviewerFollowers,
      reviewerId,
      "review",
      `${reviewerName} wrote a review`,
      `Rated ${traderName} ${rating} stars`,
      { traderId, targetUrl: `/trader-profile/${traderId}#reviews`, actorUserId: reviewerId }
    )
  }
}

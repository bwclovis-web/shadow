import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"

import {
  getUnreadAlertCount,
  getUserAlertPreferences,
  getUserAlerts,
} from "@/models/user-alerts.server"
import {
  getPersonalizedRecommendations,
  DEFAULT_RECOMMENDATIONS_LIMIT,
} from "@/services/recommendations"
import type { UserAlert } from "@/types/database"
import type { SessionUser } from "@/utils/session-from-request.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

import ProfileClient from "./ProfileClient"

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("profile")
  return {
    title: t("heading"),
    description: t("subheading"),
  }
}

export default async function ProfilePage({ params }: Props): Promise<React.ReactElement> {
  const { userSlug } = await params
  const { user } = await requireOwnedProfileSession(userSlug)

  let alerts: Awaited<ReturnType<typeof getUserAlerts>> = []
  let preferences: Awaited<ReturnType<typeof getUserAlertPreferences>> | null = null
  let unreadCount = 0
  let recommendedPerfumes: Awaited<ReturnType<typeof getPersonalizedRecommendations>> = []

  try {
    const [alertsResult, preferencesResult, unreadResult, recommendedResult] =
      await Promise.all([
        getUserAlerts(user.id),
        getUserAlertPreferences(user.id),
        getUnreadAlertCount(user.id),
        getPersonalizedRecommendations(user.id, DEFAULT_RECOMMENDATIONS_LIMIT).catch(
          () => [] as Awaited<ReturnType<typeof getPersonalizedRecommendations>>
        ),
      ])
    alerts = alertsResult
    preferences = preferencesResult
    unreadCount = unreadResult
    recommendedPerfumes = recommendedResult
  } catch {
    // UserAlert tables may not exist yet; recommendations already fallback to [] on reject
  }

  return (
    <ProfileClient
      user={user as SessionUser}
      alerts={alerts as UserAlert[]}
      preferences={preferences}
      unreadCount={unreadCount}
      recommendedPerfumes={recommendedPerfumes}
      bannerImage={publicAssetUrl("/images/new/profile.webp")}
    />
  )
}

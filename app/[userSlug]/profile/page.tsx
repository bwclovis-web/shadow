import type { Metadata } from "next"
import type React from "react"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

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
import type { SafeUser } from "@/types"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getProfileSlug } from "@/utils/user"

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
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const slug = getProfileSlug(session.user)
  if (slug !== userSlug) {
    redirect(`/${slug}/profile`)
  }

  const user = session.user

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
      user={user as SafeUser}
      alerts={alerts as UserAlert[]}
      preferences={preferences}
      unreadCount={unreadCount}
      recommendedPerfumes={recommendedPerfumes}
    />
  )
}

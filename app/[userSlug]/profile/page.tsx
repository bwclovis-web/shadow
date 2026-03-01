import type { Metadata } from "next"
import type React from "react"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import {
  getUnreadAlertCount,
  getUserAlertPreferences,
  getUserAlerts,
} from "@/models/user-alerts.server"
import { rulesRecommendationService } from "@/services/recommendations"
import type { UserAlert } from "@/types/database"
import type { SafeUser } from "@/types"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getProfileSlug } from "@/utils/user"

import ProfileClient from "./ProfileClient"

export const ROUTE_PATH = "/[userSlug]/profile"

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

const getCookieHeader = async (): Promise<string> => {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
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

  try {
    const [alertsResult, preferencesResult, unreadResult] = await Promise.all([
      getUserAlerts(user.id),
      getUserAlertPreferences(user.id),
      getUnreadAlertCount(user.id),
    ])
    alerts = alertsResult
    preferences = preferencesResult
    unreadCount = unreadResult
  } catch {
    // UserAlert tables may not exist yet
  }

  let recommendedPerfumes: Awaited<
    ReturnType<typeof rulesRecommendationService.getPersonalizedForUser>
  > = []
  try {
    recommendedPerfumes =
      await rulesRecommendationService.getPersonalizedForUser(user.id, 6)
  } catch {
    // Recommendations optional
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

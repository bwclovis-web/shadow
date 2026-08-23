import { NextRequest, NextResponse } from "next/server"
import {
  getUserAlertPreferences,
  updateUserAlertPreferences,
} from "@/models/user-alerts.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"

const defaultPreferences = {
  wishlistAlertsEnabled: true,
  decantAlertsEnabled: true,
  emailWishlistAlerts: false,
  emailDecantAlerts: false,
  emailTradeAlerts: false,
  emailSecurityAlerts: true,
  securityAlertsEnabled: true,
  followAlertsEnabled: true,
  emailFollowAlerts: false,
  emailSubmissionAlerts: false,
  pushEnabled: false,
  pushTradeAlerts: true,
  pushMessageAlerts: true,
  pushFollowAlerts: true,
  pushSubmissionAlerts: true,
  savedSearchAlertsEnabled: true,
  emailSavedSearchAlerts: false,
  pushSavedSearchAlerts: true,
  savedSearchAlertFrequency: "instant" as const,
  maxAlerts: 10,
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params
  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status ?? 401 })
  }
  if (userId !== authResult.user!.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  try {
    const preferences = await getUserAlertPreferences(userId)
    return NextResponse.json(preferences ?? { userId, ...defaultPreferences })
  } catch (error) {
    console.warn("UserAlertPreferences table not available:", error)
    return NextResponse.json({ userId, ...defaultPreferences })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  return updatePreferences(request, context)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  return updatePreferences(request, context)
}

async function updatePreferences(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireCSRF(request)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }
  const { userId } = await context.params
  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status ?? 401 })
  }
  if (userId !== authResult.user!.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const preferences: Record<string, unknown> = {}
  if (typeof body.wishlistAlertsEnabled === "boolean") preferences.wishlistAlertsEnabled = body.wishlistAlertsEnabled
  if (typeof body.decantAlertsEnabled === "boolean") preferences.decantAlertsEnabled = body.decantAlertsEnabled
  if (typeof body.emailWishlistAlerts === "boolean") preferences.emailWishlistAlerts = body.emailWishlistAlerts
  if (typeof body.emailDecantAlerts === "boolean") preferences.emailDecantAlerts = body.emailDecantAlerts
  if (typeof body.emailTradeAlerts === "boolean") preferences.emailTradeAlerts = body.emailTradeAlerts
  if (typeof body.emailSecurityAlerts === "boolean") preferences.emailSecurityAlerts = body.emailSecurityAlerts
  if (typeof body.securityAlertsEnabled === "boolean") preferences.securityAlertsEnabled = body.securityAlertsEnabled
  if (typeof body.followAlertsEnabled === "boolean") preferences.followAlertsEnabled = body.followAlertsEnabled
  if (typeof body.emailFollowAlerts === "boolean") preferences.emailFollowAlerts = body.emailFollowAlerts
  if (typeof body.maxAlerts === "number" && body.maxAlerts >= 1 && body.maxAlerts <= 100) preferences.maxAlerts = body.maxAlerts
  if (typeof body.pushEnabled === "boolean") preferences.pushEnabled = body.pushEnabled
  if (typeof body.pushTradeAlerts === "boolean") preferences.pushTradeAlerts = body.pushTradeAlerts
  if (typeof body.pushMessageAlerts === "boolean") preferences.pushMessageAlerts = body.pushMessageAlerts
  if (typeof body.pushFollowAlerts === "boolean") preferences.pushFollowAlerts = body.pushFollowAlerts
  if (typeof body.pushSubmissionAlerts === "boolean") preferences.pushSubmissionAlerts = body.pushSubmissionAlerts
  if (typeof body.emailSubmissionAlerts === "boolean") preferences.emailSubmissionAlerts = body.emailSubmissionAlerts
  if (typeof body.savedSearchAlertsEnabled === "boolean") preferences.savedSearchAlertsEnabled = body.savedSearchAlertsEnabled
  if (typeof body.emailSavedSearchAlerts === "boolean") preferences.emailSavedSearchAlerts = body.emailSavedSearchAlerts
  if (typeof body.pushSavedSearchAlerts === "boolean") preferences.pushSavedSearchAlerts = body.pushSavedSearchAlerts
  if (body.savedSearchAlertFrequency === "instant" || body.savedSearchAlertFrequency === "daily") {
    preferences.savedSearchAlertFrequency = body.savedSearchAlertFrequency
  }

  try {
    const updated = await updateUserAlertPreferences(userId, preferences)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("UserAlertPreferences update failed:", error)
    return NextResponse.json({
      id: "fallback",
      userId,
      ...defaultPreferences,
      ...preferences,
    })
  }
}

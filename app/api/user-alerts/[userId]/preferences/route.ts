import { NextRequest, NextResponse } from "next/server"
import {
  getUserAlertPreferences,
  updateUserAlertPreferences,
} from "@/models/user-alerts.server"
import { authenticateUser } from "@/utils/server/auth.server"

const defaultPreferences = {
  wishlistAlertsEnabled: true,
  decantAlertsEnabled: true,
  emailWishlistAlerts: false,
  emailDecantAlerts: false,
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
  if (typeof body.maxAlerts === "number" && body.maxAlerts >= 1 && body.maxAlerts <= 100) preferences.maxAlerts = body.maxAlerts

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

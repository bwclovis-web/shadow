import webpush from "web-push"

import {
  deletePushSubscriptionByEndpoint,
  getPushSubscriptionsForUser,
} from "@/models/push-subscription.server"
import { isUserActiveInConversation } from "@/models/conversation-presence.server"
import { getUserAlertPreferences } from "@/models/user-alerts.server"
import type { AlertType } from "@/types/database"
import { getAppBaseUrl } from "@/utils/email.server"
import { ensureVapidConfigured } from "@/utils/push-vapid.server"

const TRADE_PUSH_ALERT_TYPES: AlertType[] = [
  "trade_accepted",
  "trade_shipped",
  "trade_completed",
]

const MESSAGE_PUSH_ALERT_TYPES: AlertType[] = ["new_trader_message"]

const FOLLOW_PUSH_ALERT_TYPES: AlertType[] = ["followed_activity"]

export type PushAlertPayload = {
  title: string
  body: string
  url: string
  tag?: string
  alertType: AlertType
}

const buildNotificationUrl = (
  alertType: AlertType,
  metadata?: Record<string, unknown>
): string => {
  const base = getAppBaseUrl()
  const senderId =
    typeof metadata?.senderId === "string"
      ? metadata.senderId
      : typeof metadata?.actorUserId === "string"
        ? metadata.actorUserId
        : null

  if (alertType.startsWith("trade_") && typeof metadata?.tradeId === "string") {
    if (senderId) return `${base}/messages/${senderId}`
    return `${base}/profile/trades`
  }

  if (alertType === "new_trader_message" && senderId) {
    return `${base}/messages/${senderId}`
  }

  if (alertType === "followed_activity" && typeof metadata?.targetUrl === "string") {
    const path = metadata.targetUrl.startsWith("/") ? metadata.targetUrl : `/${metadata.targetUrl}`
    return `${base}${path}`
  }

  return `${base}/profile`
}

export const buildPushAlertPayload = (
  alertType: AlertType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): PushAlertPayload => ({
  title,
  body: message,
  url: buildNotificationUrl(alertType, metadata),
  tag: `${alertType}-${String(metadata?.tradeId ?? metadata?.messageId ?? Date.now())}`,
  alertType,
})

const shouldSendPushForAlert = async (
  userId: string,
  alertType: AlertType,
  metadata?: Record<string, unknown>
): Promise<boolean> => {
  const preferences = await getUserAlertPreferences(userId)
  if (!preferences.pushEnabled) return false

  if (TRADE_PUSH_ALERT_TYPES.includes(alertType)) {
    return preferences.pushTradeAlerts
  }

  if (MESSAGE_PUSH_ALERT_TYPES.includes(alertType)) {
    if (!preferences.pushMessageAlerts) return false
    const senderId =
      typeof metadata?.senderId === "string" ? metadata.senderId : null
    if (senderId && (await isUserActiveInConversation(userId, senderId))) {
      return false
    }
    return true
  }

  if (FOLLOW_PUSH_ALERT_TYPES.includes(alertType)) {
    return preferences.pushFollowAlerts
  }

  return false
}

export const sendPushForUserAlert = async (options: {
  userId: string
  alertType: AlertType
  title: string
  message: string
  metadata?: Record<string, unknown>
}): Promise<void> => {
  const { userId, alertType, title, message, metadata } = options

  if (
    !TRADE_PUSH_ALERT_TYPES.includes(alertType) &&
    !MESSAGE_PUSH_ALERT_TYPES.includes(alertType) &&
    !FOLLOW_PUSH_ALERT_TYPES.includes(alertType)
  ) {
    return
  }

  if (!(await shouldSendPushForAlert(userId, alertType, metadata))) return
  if (!ensureVapidConfigured()) return

  const subscriptions = await getPushSubscriptionsForUser(userId)
  if (subscriptions.length === 0) return

  const payload = buildPushAlertPayload(alertType, title, message, metadata)
  const body = JSON.stringify(payload)

  await Promise.all(
    subscriptions.map(async subscription => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          body
        )
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? (error as { statusCode: number }).statusCode
            : null
        if (statusCode === 404 || statusCode === 410) {
          await deletePushSubscriptionByEndpoint(subscription.endpoint)
        } else {
          console.error("[push] Failed to send notification:", error)
        }
      }
    })
  )
}

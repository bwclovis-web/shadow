import { getUnreadDirectMessageCount } from "@/models/contactMessage.server"
import {
  getUnreadAlertCounts,
  getUserAlerts,
} from "@/models/user-alerts.server"

export type NavBadgeBootstrap = {
  alerts: Awaited<ReturnType<typeof getUserAlerts>>
  unreadCount: number
  tradeUnreadCount: number
  directMessageUnreadCount: number
}

/** Nav chrome badges: one alerts list + one alert-count aggregation + DM count. */
export const getNavBadgeBootstrap = async (
  userId: string,
  alertLimit = 10
): Promise<NavBadgeBootstrap> => {
  const [alerts, alertCounts, directMessageUnreadCount] = await Promise.all([
    getUserAlerts(userId, alertLimit),
    getUnreadAlertCounts(userId),
    getUnreadDirectMessageCount(userId),
  ])
  return {
    alerts: alerts ?? [],
    unreadCount: alertCounts.unreadCount,
    tradeUnreadCount: alertCounts.tradeUnreadCount,
    directMessageUnreadCount,
  }
}

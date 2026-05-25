"use client"

import { useTranslations } from "next-intl"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import {
  BsBell,
  BsBoxArrowUpRight,
  BsCheck,
  BsClock,
  BsHeartFill,
  BsShieldExclamation,
  BsX,
} from "react-icons/bs"
import { getProfilePathForUser } from "@/utils/user"

import { Button } from "@/components/Atoms/Button/Button"
import type { UserAlert } from "@/types/database"

interface AlertItemProps {
  alert: UserAlert
  onMarkAsRead: () => void
  onDismiss: () => void
  compact?: boolean
  isLeaving?: boolean
  isReadTransitioning?: boolean
}

type AvailableTrader = {
  userId: string
  displayName?: string
  email?: string
}

const getAlertIconClassName = (alertType: UserAlert["alertType"]) => {
  switch (alertType as string) {
    case "wishlist_available":
      return "text-green-600"
    case "decant_interest":
      return "text-blue-600"
    case "pending_submission_approval":
      return "text-yellow-600"
    case "new_trader_message":
      return "text-indigo-600"
    case "trade_received":
    case "trade_accepted":
    case "trade_shipped":
    case "trade_completed":
    case "trade_cancelled":
      return "text-noir-gold"
    case "suspicious_login":
      return "text-orange-600"
    case "followed_activity":
      return "text-noir-gold-500"
    case "split_slot_claimed":
    case "split_shipped":
    case "split_completed":
    case "split_cancelled":
      return "text-noir-gold"
    default:
      return "text-gray-600"
  }
}

const perfumeLink = (slug: string) => `/perfume/${slug}`
const exchangesLink = (otherUserId: string) => `/exchanges/${otherUserId}`
const isTradeAlert = (alertType: string) => alertType.startsWith("trade_")

type AlertTranslator = ReturnType<typeof useTranslations>

const getWishlistAlertMessage = (
  alert: UserAlert,
  traders: AvailableTrader[],
  t: AlertTranslator,
) => {
  const perfumeName =
    alert.Perfume?.name ?? alert.title.replace(/ is now available!?$/, "")
  const houseName = alert.Perfume?.perfumeHouse?.name
  const perfumeLabel = houseName ? `${perfumeName} by ${houseName}` : perfumeName

  if (traders.length > 0) {
    return t("messages.wishlistAvailableWithCollectors", {
      perfumeLabel,
      count: traders.length,
    })
  }

  return t("messages.wishlistAvailable", { perfumeLabel })
}

const alertLink = (alert: UserAlert) => {
  if ((alert.alertType as string) === "suspicious_login") {
    return `${getProfilePathForUser(alert.User)}/security`
  }
  if ((alert.alertType as string) === "pending_submission_approval") return "/admin/pending-submission"
  const senderId = alert.metadata?.senderId as string | undefined
  if ((alert.alertType as string) === "new_trader_message" && senderId) {
    return exchangesLink(senderId)
  }
  if (isTradeAlert(alert.alertType as string) && senderId) {
    return exchangesLink(senderId)
  }
  if ((alert.alertType as string) === "followed_activity") {
    const targetUrl = alert.metadata?.targetUrl as string | undefined
    if (targetUrl) return targetUrl.startsWith("/") ? targetUrl : `/${targetUrl}`
    return "/the-exchange"
  }
  if ((alert.alertType as string).startsWith("split_")) {
    const splitId = alert.metadata?.splitId as string | undefined
    if (splitId) return `/splits/${splitId}`
  }
  if (alert.Perfume) return perfumeLink(alert.Perfume.slug)
  return "/exchanges"
}

const AlertIcon = ({ alertType }: { alertType: UserAlert["alertType"] }) => {
  const cn = `h-4 w-4 ${getAlertIconClassName(alertType)}`
  if (alertType === "wishlist_available")
    return <BsHeartFill className={cn}  />
  if ((alertType as string) === "suspicious_login")
    return <BsShieldExclamation className={cn} />
  return <BsBell className={cn} />
}

const alertTypeKey = (alertType: UserAlert["alertType"]) => {
  const key = alertType as string
  const known = [
    "wishlist_available",
    "decant_interest",
    "pending_submission_approval",
    "new_trader_message",
    "trade_received",
    "trade_accepted",
    "trade_shipped",
    "trade_completed",
    "trade_cancelled",
    "suspicious_login",
    "followed_activity",
    "split_slot_claimed",
    "split_shipped",
    "split_completed",
    "split_cancelled",
  ] as const
  return known.includes(key as (typeof known)[number]) ? key : "default"
}

export const AlertItem = ({
  alert,
  onMarkAsRead,
  onDismiss,
  compact = false,
  isLeaving = false,
  isReadTransitioning = false,
}: AlertItemProps) => {
  const t = useTranslations("alerts")
  const typeKey = alertTypeKey(alert.alertType)

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date()
    const dateObj = typeof date === "string" ? new Date(date) : date
    const diffInMinutes = Math.floor(
      (now.getTime() - dateObj.getTime()) / (1000 * 60)
    )
    if (diffInMinutes < 1) return t("timeAgo.justNow")
    if (diffInMinutes < 60) return t("timeAgo.minutes", { count: diffInMinutes })
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return t("timeAgo.hours", { count: diffInHours })
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return t("timeAgo.days", { count: diffInDays })
    return dateObj.toLocaleDateString()
  }

  const typeLabel = t(`types.${typeKey}` as "types.wishlist_available")
  const wishlistTraders =
    alert.alertType === "wishlist_available"
      ? ((alert.metadata as { availableTraders?: AvailableTrader[] } | null)
          ?.availableTraders ?? [])
      : []
  const alertMessage =
    alert.alertType === "wishlist_available"
      ? getWishlistAlertMessage(alert, wishlistTraders, t)
      : alert.message

  const actionLabel = (() => {
    if (alert.alertType === "pending_submission_approval") {
      return t("actions.reviewSubmission")
    }
    if (alert.alertType === "new_trader_message") return t("actions.viewMessage")
    if (isTradeAlert(alert.alertType as string)) return t("actions.viewTrade")
    if ((alert.alertType as string) === "suspicious_login") {
      return t("actions.viewSecurity")
    }
    if ((alert.alertType as string) === "followed_activity") {
      return t("actions.viewFollowedActivity")
    }
    return t("actions.viewPerfume")
  })()

  if (compact) {
    return (
      <div
        className={`flex items-start gap-3 overflow-hidden rounded-md px-3 transition-[opacity,transform,max-height,padding,background-color,box-shadow] duration-300 ease-out ${
          !alert.isRead ? "bg-noir-gold-500/20 shadow-sm shadow-noir-gold/10" : ""
        } ${
          isReadTransitioning ? "bg-noir-gold-500/10 shadow-sm shadow-noir-gold/20" : ""
        } ${
          isLeaving
            ? "max-h-0 py-0 opacity-0 -translate-y-2 scale-[0.98]"
            : "max-h-40 py-3 opacity-100 translate-y-0 scale-100"
        }`}
      >
        <div className="shrink-0 mt-0.5">
          <AlertIcon alertType={alert.alertType} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  !alert.isRead ? "text-noir-gold-500" : "text-noir-gold-100"
                } transition-colors duration-300`}
              >
                {alert.title}
              </p>
              <p
                className={`text-xs ${
                  !alert.isRead ? "text-noir-gold-100" : "text-noir-gold-500"
                } mt-1 line-clamp-2 transition-colors duration-300`}
              >
                {alertMessage}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs text-noir-gold-500 transition-colors duration-300"
                  suppressHydrationWarning
                >
                  {formatTimeAgo(alert.createdAt)}
                </span>
                <PrefetchLink
                  href={alertLink(alert)}
                  prefetch={false}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {actionLabel}{" "}
                  <BsBoxArrowUpRight className="h-3 w-3" />
                </PrefetchLink>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!alert.isRead && (
                <Button
                  variant="icon"
                  size="sm"
                  onClick={onMarkAsRead}
                  className="p-1 h-6 w-6"
                  title={t("actions.markRead")}
                >
                  <BsCheck className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="icon"
                size="sm"
                onClick={onDismiss}
                className="p-1 h-6 w-6 text-gray-400 hover:text-red-600"
                title={t("actions.dismiss")}
              >
                <BsX className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group overflow-hidden rounded-lg border transition-[background-color,border-color,box-shadow,opacity,transform,max-height,padding] duration-300 ease-out ${
        !alert.isRead
          ? "border-noir-blue bg-noir-gold/20 shadow-sm"
          : "border-gray-200 bg-noir-dark"
      } ${isReadTransitioning ? "ring-1 ring-noir-gold/30" : ""} ${
        isLeaving
          ? "max-h-0 p-0 opacity-0 -translate-y-2 scale-[0.98] border-transparent"
          : "max-h-[32rem] p-4 opacity-100 translate-y-0 scale-100"
      } hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-1">
          <AlertIcon alertType={alert.alertType} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-noir-gold uppercase tracking-wide">
                  {typeLabel}
                </span>
                <span
                  className="text-xs text-gray-400 flex items-center gap-1"
                  suppressHydrationWarning
                >
                  <BsClock className="h-3 w-3" />
                  {formatTimeAgo(alert.createdAt)}
                </span>
              </div>

              <h4
                className={`font-semibold ${
                  !alert.isRead ? "text-noir-gold" : "text-noir-gold-100"
                } transition-colors duration-300`}
              >
                {alert.title}
              </h4>

              <p className="text-sm text-noir-gold-500 mt-1 mb-3 transition-colors duration-300">
                {alertMessage}
              </p>

              {alert.alertType !== "pending_submission_approval" && alert.Perfume && (
                <div className={`flex items-center gap-1 text-sm ${!alert.isRead ? "text-noir-gold-100" : "text-noir-gold-500"}`}>
                  <span>{t("actions.perfumeLabel")}</span>
                  <PrefetchLink
                    href={perfumeLink(alert.Perfume.slug)}
                    prefetch={false}
                    className="font-medium text-noir-blue/80 hover:text-noir-blue flex items-center gap-1"
                  >
                    {alert.Perfume.name}
                    {alert.Perfume.perfumeHouse && (
                      <span className={`text-noir-gold-500 ${!alert.isRead ? "text-noir-gold-100" : "text-noir-gold-500"}`}>
                        by {alert.Perfume.perfumeHouse.name}
                      </span>
                    )}
                    <BsBoxArrowUpRight className="h-3 w-3 ml-2" />
                  </PrefetchLink>
                </div>
              )}

              {alert.metadata && (
                <div className="mt-3 text-sm">
                  {alert.alertType === "wishlist_available" && (() => {
                    if (!wishlistTraders.length) return null
                    return (
                      <div>
                        <span className={`font-medium ${!alert.isRead ? "text-noir-gold-100" : "text-noir-gold-500"}`}>
                          {t("actions.availableFrom")}
                        </span>
                      <ul className="flex gap-2 mt-2">
                          {wishlistTraders.map(
                            (
                              trader: AvailableTrader,
                              index: number
                            ) => (
                              <li key={trader.userId ?? index} className="after:content-[''] flex after:border-r after:border-noir-gold-500/20 after:px-2 after:mr-2 last:after:hidden">
                              <PrefetchLink
                                href={`/trader-profile/${trader.userId}`}
                                prefetch={false}
                                className="block text-noir-blue/80 hover:text-noir-blue"
                              >
                                {trader.displayName ??
                                  trader.email ??
                                  t("actions.unknownTrader")}
                              </PrefetchLink>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )
                  })()}

                  {alert.alertType === "decant_interest" && (
                    <div>
                      <span className="font-medium text-gray-700">
                        {t("actions.interestedUser")}
                      </span>
                      <span className="ml-2 text-blue-600">
                        {(alert.metadata as { interestedUserName?: string; interestedUserEmail?: string })
                          ?.interestedUserName ??
                          (alert.metadata as { interestedUserEmail?: string })
                            ?.interestedUserEmail ??
                          t("actions.unknownUser")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {!alert.isRead && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onMarkAsRead}
                  className="flex items-center gap-2"
                >
                  <BsCheck className="h-4 w-4" />
                  {t("actions.markRead")}
                </Button>
              )}

              <Button
                variant="icon"
                size="sm"
                onClick={onDismiss}
                className="flex items-center gap-2 text-gray-400 hover:text-red-600"
                title={t("actions.dismiss")}
              >
                <BsX className="h-4 w-4" />
                {t("actions.dismiss")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

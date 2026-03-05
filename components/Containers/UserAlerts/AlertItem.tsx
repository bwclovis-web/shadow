import { Link } from "next-view-transitions"
import {
  BsBell,
  BsBoxArrowUpRight,
  BsCheck,
  BsClock,
  BsHeartFill,
  BsX,
} from "react-icons/bs"

import { Button } from "@/components/Atoms/Button/Button"
import type { UserAlert } from "@/types/database"

interface AlertItemProps {
  alert: UserAlert
  onMarkAsRead: () => void
  onDismiss: () => void
  compact?: boolean
}

const getAlertIconClassName = (alertType: UserAlert["alertType"]) => {
  switch (alertType) {
    case "wishlist_available":
      return "text-green-600"
    case "decant_interest":
      return "text-blue-600"
    case "pending_submission_approval":
      return "text-yellow-600"
    case "new_trader_message":
      return "text-indigo-600"
    default:
      return "text-gray-600"
  }
}

const getAlertTypeLabel = (alertType: UserAlert["alertType"]) => {
  switch (alertType) {
    case "wishlist_available":
      return "Wishlist Alert"
    case "decant_interest":
      return "Interest Alert"
    case "pending_submission_approval":
      return "Pending Submission"
    case "new_trader_message":
      return "Message"
    default:
      return "Alert"
  }
}

const formatTimeAgo = (date: Date | string) => {
  const now = new Date()
  const dateObj = typeof date === "string" ? new Date(date) : date
  const diffInMinutes = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`
  return dateObj.toLocaleDateString("en-US")
}

const perfumeLink = (slug: string) => `/perfume/${slug}`
const messagesLink = (otherUserId: string) => `/messages/${otherUserId}`
const alertLink = (alert: UserAlert) => {
  if (alert.alertType === "pending_submission_approval") return "/admin/pending-submission"
  if (alert.alertType === "new_trader_message" && alert.metadata?.senderId)
    return messagesLink(alert.metadata.senderId as string)
  if (alert.Perfume) return perfumeLink(alert.Perfume.slug)
  return "/messages"
}
const linkText = (alertType: UserAlert["alertType"]) => {
  if (alertType === "pending_submission_approval") return "Review submission"
  if (alertType === "new_trader_message") return "View message"
  return "View perfume"
}

const AlertIcon = ({ alertType }: { alertType: UserAlert["alertType"] }) => {
  const cn = `h-4 w-4 ${getAlertIconClassName(alertType)}`
  if (alertType === "wishlist_available")
    return <BsHeartFill className={cn} />
  return <BsBell className={cn} />
}

export const AlertItem = ({
  alert,
  onMarkAsRead,
  onDismiss,
  compact = false,
}: AlertItemProps) => {
  if (compact) {
    return (
      <div
        className={`flex items-start gap-3 ${!alert.isRead ? "bg-blue-50" : ""}`}
      >
        <div className="shrink-0 mt-0.5">
          <AlertIcon alertType={alert.alertType} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  !alert.isRead ? "text-gray-900" : "text-gray-700"
                }`}
              >
                {alert.title}
              </p>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {alert.message}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500" suppressHydrationWarning>
                  {formatTimeAgo(alert.createdAt)}
                </span>
                <Link
                  href={alertLink(alert)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {linkText(alert.alertType)}{" "}
                  <BsBoxArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!alert.isRead && (
                <Button
                  variant="icon"
                  size="sm"
                  onClick={onMarkAsRead}
                  className="p-1 h-6 w-6"
                  title="Mark as read"
                >
                  <BsCheck className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="icon"
                size="sm"
                onClick={onDismiss}
                className="p-1 h-6 w-6 text-gray-400 hover:text-red-600"
                title="Dismiss"
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
      className={`group p-4 rounded-lg border transition-all duration-200 ${
        !alert.isRead
          ? "border-blue-200 bg-blue-50 shadow-sm"
          : "border-gray-200 bg-white"
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
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {getAlertTypeLabel(alert.alertType)}
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
                  !alert.isRead ? "text-gray-900" : "text-gray-700"
                }`}
              >
                {alert.title}
              </h4>

              <p className="text-sm text-gray-600 mt-1 mb-3">{alert.message}</p>

              {alert.alertType !== "pending_submission_approval" && alert.Perfume && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Perfume:</span>
                  <Link
                    href={perfumeLink(alert.Perfume.slug)}
                    className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {alert.Perfume.name}
                    {alert.Perfume.perfumeHouse && (
                      <span className="text-gray-500">
                        by {alert.Perfume.perfumeHouse.name}
                      </span>
                    )}
                    <BsBoxArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {alert.metadata && (
                <div className="mt-3 text-sm">
                  {alert.alertType === "wishlist_available" &&
                    alert.metadata.availableTraders && (
                      <div>
                        <span className="font-medium text-gray-700">
                          Available from:
                        </span>
                        <div className="mt-1 space-y-1">
                          {alert.metadata.availableTraders.map(
                            (trader: {
                              userId: string
                              displayName?: string
                              email?: string
                            },
                            index: number) => (
                              <Link
                                key={trader.userId ?? index}
                                href={`/trader-profile/${trader.userId}`}
                                className="block text-blue-600 hover:text-blue-800"
                              >
                                {trader.displayName ??
                                  trader.email ??
                                  "Unknown Trader"}
                              </Link>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {alert.alertType === "decant_interest" && (
                    <div>
                      <span className="font-medium text-gray-700">
                        Interested user:
                      </span>
                      <span className="ml-2 text-blue-600">
                        {alert.metadata?.interestedUserName ??
                          alert.metadata?.interestedUserEmail ??
                          "Unknown User"}
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
                  Mark Read
                </Button>
              )}

              <Button
                variant="icon"
                size="sm"
                onClick={onDismiss}
                className="flex items-center gap-2 text-gray-400 hover:text-red-600"
              >
                <BsX className="h-4 w-4" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlertItem

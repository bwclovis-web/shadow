"use client"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { useDirectMessageUnreadCount } from "@/components/Molecules/DirectMessageUnread/DirectMessageUnreadProvider"
import { useUserAlertsContext } from "@/components/Molecules/UserAlertsProvider/UserAlertsProvider"
import { SIGN_IN } from "@/constants/routes"
import { getProfilePathForUser } from "@/utils/user"
import { styleMerge } from "@/utils/styleUtils"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { type FC, type HTMLProps } from "react"
import { BsBell } from "react-icons/bs"
import { FaExchangeAlt, FaUser } from "react-icons/fa"
import { MdMail } from "react-icons/md"

const EXCHANGE_PATH = "/the-exchange"
const MESSAGES_PATH = "/messages"

interface MobileBottomNavigationProps extends HTMLProps<HTMLDivElement> {
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
}

const navItemClass = (active: boolean) =>
  styleMerge(
    "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 mobile-touch-target transition-colors duration-200 min-h-[52px]",
    active ? "text-noir-light" : "text-noir-gold hover:text-noir-light"
  )

const Badge = ({ count }: { count: number }) => {
  if (count <= 0) return null
  return (
    <span className="absolute right-[calc(50%-22px)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  )
}

const MobileBottomNavigation: FC<MobileBottomNavigationProps> = ({
  className,
  user,
}) => {
  const t = useTranslations("navigation.mobileBottom")
  const pathname = usePathname()
  const messageUnread = useDirectMessageUnreadCount()
  const alertsCtx = useUserAlertsContext()
  const alertUnread = alertsCtx?.unreadCount ?? 0

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const profileHref = user?.id
    ? getProfilePathForUser({
        id: user.id,
        username: user.username ?? null,
      })
    : SIGN_IN

  const alertsHref = user?.id ? `${profileHref}#user-alerts` : SIGN_IN

  return (
    <div
      className={styleMerge(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-noir-dark/95 backdrop-blur-md border-t border-noir-light/20 mobile-safe-bottom",
        className
      )}
      data-testid="mobile-bottom-navigation"
    >
      <nav className="flex items-stretch justify-around max-w-lg mx-auto">
        <PrefetchLink
          href={EXCHANGE_PATH}
          className={navItemClass(isActive(EXCHANGE_PATH))}
          aria-current={isActive(EXCHANGE_PATH) ? "page" : undefined}
        >
          <FaExchangeAlt size={22} aria-hidden />
          <span className="text-[11px] font-medium leading-tight">{t("exchange")}</span>
        </PrefetchLink>

        <PrefetchLink
          href={user?.id ? MESSAGES_PATH : SIGN_IN}
          className={navItemClass(user?.id ? isActive(MESSAGES_PATH) : isActive(SIGN_IN, true))}
          aria-current={user?.id && isActive(MESSAGES_PATH) ? "page" : undefined}
        >
          <MdMail size={24} aria-hidden />
          <Badge count={messageUnread} />
          <span className="text-[11px] font-medium leading-tight">{t("messages")}</span>
        </PrefetchLink>

        <PrefetchLink
          href={profileHref}
          className={navItemClass(
            user?.id ? isActive(profileHref) : isActive(SIGN_IN, true)
          )}
          aria-current={
            user?.id && isActive(profileHref) && !pathname.includes("#")
              ? "page"
              : undefined
          }
        >
          <FaUser size={20} aria-hidden />
          <span className="text-[11px] font-medium leading-tight">
            {user?.id ? t("profile") : t("signIn")}
          </span>
        </PrefetchLink>

        <PrefetchLink
          href={alertsHref}
          className={navItemClass(false)}
        >
          <BsBell size={20} aria-hidden />
          <Badge count={alertUnread} />
          <span className="text-[11px] font-medium leading-tight">{t("alerts")}</span>
        </PrefetchLink>
      </nav>
    </div>
  )
}

export default MobileBottomNavigation

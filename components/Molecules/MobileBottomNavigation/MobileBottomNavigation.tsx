"use client"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { useDirectMessageUnreadCount } from "@/components/Molecules/UserAlertsProvider/UserAlertsProvider"
import { useUserAlertsContext } from "@/components/Molecules/UserAlertsProvider/UserAlertsProvider"
import {
  SIGN_IN,
  THE_ARCHIVE_PATH,
  THE_COLLECTORS_GUIDE_PATH,
} from "@/constants/routes"
import { getProfilePathForUser } from "@/utils/user"
import { styleMerge } from "@/utils/styleUtils"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { type FC, type HTMLProps, useEffect, useRef, useState } from "react"
import { BsBell, BsBook, BsCollection } from "react-icons/bs"
import { FaExchangeAlt, FaUser } from "react-icons/fa"
import { MdMail } from "react-icons/md"

const EXCHANGE_PATH = "/the-exchange"
const EXCHANGES_PATH = "/exchanges"

interface MobileBottomNavigationProps extends HTMLProps<HTMLDivElement> {
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
}

const navItemClass = (active: boolean) =>
  styleMerge(
    "relative mx-1 my-1 flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 mobile-touch-target transition-[transform,color,background-color,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none active:scale-[0.97]",
    active
      ? "border border-noir-gold/35 bg-noir-gold/[0.12] text-noir-light shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      : "border border-transparent text-noir-gold hover:bg-white/[0.04] hover:text-noir-light"
  )

const ActiveBar = ({ active }: { active: boolean }) => (
  <span
    aria-hidden
    className={styleMerge(
      "pointer-events-none absolute inset-x-4 top-1 h-px rounded-full bg-noir-gold/40 transition-opacity duration-200",
      active ? "opacity-100" : "opacity-0"
    )}
  />
)

const Badge = ({
  count,
  animate = false,
}: {
  count: number
  animate?: boolean
}) => {
  if (count <= 0) return null
  return (
    <span
      className={styleMerge(
        "absolute right-[calc(50%-24px)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white",
        animate && "motion-safe:animate-badge-pop"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

const MobileBottomNavigation: FC<MobileBottomNavigationProps> = ({
  className,
  user,
}) => {
  const t = useTranslations("navigation")
  const tBottom = useTranslations("navigation.mobileBottom")
  const pathname = usePathname()
  const messageUnread = useDirectMessageUnreadCount()
  const alertsCtx = useUserAlertsContext()
  const alertUnread = alertsCtx?.unreadCount ?? 0
  const [hash, setHash] = useState("")
  const [animateMessageBadge, setAnimateMessageBadge] = useState(false)
  const [animateAlertBadge, setAnimateAlertBadge] = useState(false)
  const previousMessageUnreadRef = useRef(messageUnread)
  const previousAlertUnreadRef = useRef(alertUnread)
  const isSignedIn = Boolean(user?.id)

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
  const isAlertsActive =
    Boolean(user?.id) && pathname === profileHref && hash === "#user-alerts"

  useEffect(() => {
    const updateHash = () => {
      setHash(window.location.hash)
    }

    updateHash()
    window.addEventListener("hashchange", updateHash)

    return () => {
      window.removeEventListener("hashchange", updateHash)
    }
  }, [])

  useEffect(() => {
    if (messageUnread > previousMessageUnreadRef.current) {
      setAnimateMessageBadge(true)
      const timeoutId = window.setTimeout(() => {
        setAnimateMessageBadge(false)
      }, 650)

      previousMessageUnreadRef.current = messageUnread

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    previousMessageUnreadRef.current = messageUnread
  }, [messageUnread])

  useEffect(() => {
    if (alertUnread > previousAlertUnreadRef.current) {
      setAnimateAlertBadge(true)
      const timeoutId = window.setTimeout(() => {
        setAnimateAlertBadge(false)
      }, 650)

      previousAlertUnreadRef.current = alertUnread

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    previousAlertUnreadRef.current = alertUnread
  }, [alertUnread])

  return (
    <div
      className={styleMerge(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-noir-dark/95 backdrop-blur-md border-t border-noir-light/20 mobile-safe-bottom",
        className
      )}
      data-testid="mobile-bottom-navigation"
    >
      <nav
        className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-1"
        aria-label={t("aria.mobileBottom")}
      >
        <PrefetchLink
          href={EXCHANGE_PATH}
          className={navItemClass(isActive(EXCHANGE_PATH))}
          aria-current={isActive(EXCHANGE_PATH) ? "page" : undefined}
        >
          <FaExchangeAlt size={22} aria-hidden focusable={false} />
          <ActiveBar active={isActive(EXCHANGE_PATH)} />
          <span className="text-[11px] font-medium leading-tight">
            {tBottom("exchange")}
          </span>
        </PrefetchLink>

        {isSignedIn ? (
          <PrefetchLink
            href={EXCHANGES_PATH}
            className={navItemClass(isActive(EXCHANGES_PATH))}
            aria-current={isActive(EXCHANGES_PATH) ? "page" : undefined}
          >
            <MdMail size={24} aria-hidden focusable={false} />
            <Badge count={messageUnread} animate={animateMessageBadge} />
            <ActiveBar active={isActive(EXCHANGES_PATH)} />
            <span className="text-[11px] font-medium leading-tight">
              {tBottom("messages")}
            </span>
          </PrefetchLink>
        ) : (
          <PrefetchLink
            href={THE_ARCHIVE_PATH}
            className={navItemClass(isActive(THE_ARCHIVE_PATH))}
            aria-current={isActive(THE_ARCHIVE_PATH) ? "page" : undefined}
          >
            <BsCollection size={22} aria-hidden focusable={false} />
            <ActiveBar active={isActive(THE_ARCHIVE_PATH)} />
            <span className="text-[11px] font-medium leading-tight">
              {tBottom("archive")}
            </span>
          </PrefetchLink>
        )}

        {isSignedIn ? (
          <PrefetchLink
            href={profileHref}
            className={navItemClass(
              isActive(profileHref) && !isAlertsActive
            )}
            aria-current={
              isActive(profileHref) && !isAlertsActive ? "page" : undefined
            }
          >
            <FaUser size={20} aria-hidden focusable={false} />
            <ActiveBar active={isActive(profileHref) && !isAlertsActive} />
            <span className="text-[11px] font-medium leading-tight">
              {tBottom("profile")}
            </span>
          </PrefetchLink>
        ) : (
          <PrefetchLink
            href={THE_COLLECTORS_GUIDE_PATH}
            className={navItemClass(isActive(THE_COLLECTORS_GUIDE_PATH))}
            aria-current={
              isActive(THE_COLLECTORS_GUIDE_PATH) ? "page" : undefined
            }
          >
            <BsBook size={20} aria-hidden focusable={false} />
            <ActiveBar active={isActive(THE_COLLECTORS_GUIDE_PATH)} />
            <span className="text-[11px] font-medium leading-tight">
              {tBottom("guide")}
            </span>
          </PrefetchLink>
        )}

        {isSignedIn ? (
          <PrefetchLink
            href={alertsHref}
            className={navItemClass(isAlertsActive)}
            aria-current={isAlertsActive ? "page" : undefined}
          >
            <BsBell size={20} aria-hidden focusable={false} />
            <Badge count={alertUnread} animate={animateAlertBadge} />
            <ActiveBar active={isAlertsActive} />
            <span className="text-[11px] font-medium leading-tight">
              {tBottom("alerts")}
            </span>
          </PrefetchLink>
        ) : (
          <PrefetchLink
            href={SIGN_IN}
            className={navItemClass(isActive(SIGN_IN, true))}
            aria-current={isActive(SIGN_IN, true) ? "page" : undefined}
          >
            <FaUser size={20} aria-hidden focusable={false} />
            <ActiveBar active={isActive(SIGN_IN, true)} />
            <span className="text-[11px] font-medium leading-tight">
              {tBottom("signIn")}
            </span>
          </PrefetchLink>
        )}
      </nav>
    </div>
  )
}

export default MobileBottomNavigation

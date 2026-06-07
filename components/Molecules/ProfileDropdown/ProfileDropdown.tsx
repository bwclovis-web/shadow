"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "next-view-transitions"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { FaChevronDown } from "react-icons/fa"

import {
  useDirectMessageUnreadCount,
  useTradeAlertUnreadCount,
} from "@/components/Molecules/UserAlertsProvider/UserAlertsProvider"
import {
  getNavigationDropdownStyles,
  type NavigationDropdownVariant,
} from "@/components/Molecules/NavigationDropdown/navigation-dropdown-styles"
import { getProfileNavigation } from "@/data/navigation"
import { styleMerge } from "@/utils/styleUtils"

interface ProfileDropdownProps {
  className?: string
  variant?: NavigationDropdownVariant
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
  onNavClick?: () => void
}

const PROFILE_MENU_ID = "profile-menu"

const ProfileDropdown = ({
  className,
  variant = "desktop",
  user,
  onNavClick,
}: ProfileDropdownProps) => {
  const pathname = usePathname()
  const tNav = useTranslations("navigation")
  const tProfile = useTranslations("profile")
  const directMessageUnread = useDirectMessageUnreadCount()
  const tradeAlertUnread = useTradeAlertUnreadCount()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { baseClasses, dropdownClasses, linkClasses, activeLinkClasses } =
    getNavigationDropdownStyles(variant)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleNavClick = () => {
    setIsOpen(false)
    onNavClick?.()
  }

  if (!user?.id) {
    return null
  }

  const profileItems = getProfileNavigation({
    id: user.id,
    username: user.username ?? null,
  })

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")

  const isMenuActive = profileItems.some((item) => isActive(item.path))

  return (
    <div
      ref={dropdownRef}
      className={styleMerge("relative", className)}
      data-cy="ProfileDropdown"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={styleMerge(
          baseClasses,
          "flex items-center gap-2 cursor-pointer",
          (isOpen || isMenuActive) &&
            "text-noir-light bg-noir-black/30 border-noir-light/90",
          variant === "desktop" && isMenuActive && "rounded-full"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={PROFILE_MENU_ID}
      >
        {tNav("profile")}
        <FaChevronDown
          className={styleMerge(
            "transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          size={12}
          aria-hidden
          focusable={false}
        />
      </button>

      <div
        id={PROFILE_MENU_ID}
        className={dropdownClasses}
        hidden={!isOpen}
      >
          <ul className="py-2">
            {profileItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.path}
                  onClick={handleNavClick}
                  className={styleMerge(
                    linkClasses,
                    isActive(item.path) && activeLinkClasses
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    {tProfile("navigation." + item.key)}
                    {item.key === "exchanges" && directMessageUnread > 0 ? (
                      <span className="shrink-0 rounded-full bg-blue-600 text-white text-xs font-medium px-2 py-0.5 min-w-[1.25rem] text-center tabular-nums">
                        {directMessageUnread > 9 ? "9+" : directMessageUnread}
                      </span>
                    ) : null}
                    {item.key === "exchanges" && tradeAlertUnread > 0 ? (
                      <span
                        className="shrink-0 rounded-full bg-noir-gold text-noir-black text-xs font-semibold px-2 py-0.5 min-w-[1.25rem] text-center tabular-nums"
                        title={tNav("tradeAlertsUnread", {
                          count: tradeAlertUnread,
                        })}
                      >
                        {tradeAlertUnread > 9 ? "9+" : tradeAlertUnread}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
      </div>
    </div>
  )
}

export default ProfileDropdown

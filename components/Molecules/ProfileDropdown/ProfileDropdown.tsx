"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "next-view-transitions"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { FaChevronDown } from "react-icons/fa"

import { getProfileNavigation } from "@/data/navigation"
import {
  getNavigationDropdownStyles,
  type NavigationDropdownVariant,
} from "@/components/Molecules/NavigationDropdown/navigation-dropdown-styles"
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
                  {tProfile("navigation." + item.key)}
                </Link>
              </li>
            ))}
          </ul>
      </div>
    </div>
  )
}

export default ProfileDropdown

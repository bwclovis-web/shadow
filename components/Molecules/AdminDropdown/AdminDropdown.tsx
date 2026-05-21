"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "next-view-transitions"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { FaChevronDown } from "react-icons/fa"

import { adminNavigation } from "@/data/navigation"
import {
  getNavigationDropdownStyles,
  type NavigationDropdownVariant,
} from "@/components/Molecules/NavigationDropdown/navigation-dropdown-styles"
import { styleMerge } from "@/utils/styleUtils"

interface AdminDropdownProps {
  className?: string
  variant?: NavigationDropdownVariant
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
  onNavClick?: () => void
}

const ADMIN_MENU_ID = "admin-menu"

const AdminDropdown = ({
  className,
  variant = "desktop",
  user,
  onNavClick,
}: AdminDropdownProps) => {
  const pathname = usePathname()
  const tNav = useTranslations("navigation")
  const tAdmin = useTranslations("admin")
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isAdmin = user?.role === "admin" || user?.role === "editor"

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

  if (!isAdmin) {
    return null
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")

  const menuPaths = adminNavigation.map((item) => item.path)
  const isMenuActive = menuPaths.some((path) => isActive(path))

  return (
    <div
      ref={dropdownRef}
      className={styleMerge("relative", className)}
      data-cy="AdminDropdown"
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
        aria-controls={ADMIN_MENU_ID}
      >
        {tNav("admin")}
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
        id={ADMIN_MENU_ID}
        className={dropdownClasses}
        hidden={!isOpen}
      >
          <ul className="py-2">
            {adminNavigation.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.path}
                  onClick={handleNavClick}
                  className={styleMerge(
                    linkClasses,
                    isActive(item.path) && activeLinkClasses
                  )}
                >
                  {tAdmin("navigation." + item.key)}
                </Link>
              </li>
            ))}
          </ul>
      </div>
    </div>
  )
}

export default AdminDropdown

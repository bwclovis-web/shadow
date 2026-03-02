"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "next-view-transitions"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { FaChevronDown } from "react-icons/fa"

import { adminNavigation, getProfileNavigation } from "@/data/navigation"
import { styleMerge } from "@/utils/styleUtils"

interface AdminDropdownProps {
  className?: string
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
  onNavClick?: () => void
}

const AdminDropdown = ({
  className,
  user,
  onNavClick,
}: AdminDropdownProps) => {
  const pathname = usePathname()
  const tNav = useTranslations("navigation")
  const tAdmin = useTranslations("admin")
  const tProfile = useTranslations("profile")
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isAdmin = user?.role === "admin" || user?.role === "editor"

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

  if (!user) {
    return null
  }

  const baseClasses =
    "block text-noir-gold hover:text-noir-light font-semibold text-lg py-4 px-4 border border-transparent transition-colors duration-400 rounded-lg mobile-touch-target hover:bg-noir-black/30 w-full text-left"
  const dropdownClasses =
    "absolute top-full left-0 w-full bg-noir-dark border border-noir-light/20 rounded-lg shadow-lg z-50"
  const linkClasses =
    "block text-noir-gold hover:text-noir-light font-semibold text-base py-3 px-4 transition-colors duration-400 hover:bg-noir-black/30"
  const activeLinkClasses =
    "text-noir-dark text-shadow-none bg-noir-gold/80 border-2 border-noir-gold"

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

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
          "flex items-center gap-2",
          isOpen && "text-noir-light bg-noir-black/30 border-noir-light/90"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {tNav("admin")}
        <FaChevronDown
          className={styleMerge("transition-transform duration-200", isOpen && "rotate-180")}
          size={12}
        />
      </button>

      {isOpen && (
        <div className={dropdownClasses}>
          <ul className="py-2">
            {isAdmin &&
              adminNavigation.map((item: (typeof adminNavigation)[number]) => (
                <li key={`admin-${item.id}`}>
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

            {isAdmin && (
              <li
                className="border-t border-noir-light/20 my-2"
                aria-hidden="true"
              />
            )}

            {user?.id &&
              getProfileNavigation({
                id: user.id,
                username: user.username ?? null,
              }).map((item: { id: string; path: string; key: string }) => (
                <li key={`profile-${item.id}`}>
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
      )}
    </div>
  )
}

export default AdminDropdown

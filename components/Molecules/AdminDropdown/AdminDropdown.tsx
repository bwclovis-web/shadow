import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { FaChevronDown } from "react-icons/fa"
import { NavLink } from "react-router"

import { adminNavigation, profileNavigation } from "~/data/navigation"
import { styleMerge } from "~/utils/styleUtils"

interface AdminDropdownProps {
  className?: string
  user?: {
    id?: string
    role?: string
  } | null
  onNavClick?: () => void
}

const AdminDropdown = ({
  className,
  user,
  onNavClick,
}: AdminDropdownProps) => {
  const { t, ready } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [isClientReady, setIsClientReady] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isAdmin = user?.role === "admin" || user?.role === "editor"

  useEffect(() => {
    setIsClientReady(true)
  }, [])

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

  // Don't render if no user
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

  return (
    <div ref={dropdownRef} className={`relative ${className || ""}`} data-cy="AdminDropdown">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styleMerge(
          baseClasses,
          "flex items-center gap-2",
          isOpen && "text-noir-light bg-noir-black/30 border-noir-light/90"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {ready && isClientReady ? t("navigation.admin") : "Admin"}
        <FaChevronDown
          className={`transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          size={12}
        />
      </button>

      {isOpen && (
        <div className={dropdownClasses}>
          <ul className="py-2">
            {/* Admin-only navigation - only show for admins/editors */}
            {isAdmin &&
              adminNavigation.map(item => (
                <li key={`admin-${item.id}`}>
                  <NavLink
                    to={item.path}
                    onClick={handleNavClick}
                    viewTransition
                    className={({ isActive }) =>
                      styleMerge(
                        linkClasses,
                        isActive && activeLinkClasses
                      )
                    }
                  >
                    {ready && isClientReady
                      ? t("admin.navigation." + item.key)
                      : item.label}
                  </NavLink>
                </li>
              ))}

            {/* Divider between admin and profile links if both exist */}
            {isAdmin && (
              <li className="border-t border-noir-light/20 my-2" aria-hidden="true" />
            )}

            {/* Profile navigation - show for all authenticated users */}
            {profileNavigation.map(item => (
              <li key={`profile-${item.id}`}>
                <NavLink
                  to={item.path}
                  onClick={handleNavClick}
                  viewTransition
                  className={({ isActive }) =>
                    styleMerge(
                      linkClasses,
                      isActive && activeLinkClasses
                    )
                  }
                >
                  {ready && isClientReady
                    ? t("profile.navigation." + item.key)
                    : item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default AdminDropdown

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { mainNavigation } from "@/data/navigation"
import { styleMerge } from "@/utils/styleUtils"

import AboutDropdown from "../../AboutDropdown/AboutDropdown"
import AdminDropdown from "../../AdminDropdown/AdminDropdown"

interface NavigationLinksProps {
  user?: {
    id?: string
    role?: string
  } | null
  onNavClick: () => void
}

const NavigationLinks = ({
  user,
  onNavClick,
}: NavigationLinksProps) => {
  const t = useTranslations("navigation")
  const pathname = usePathname()

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/")

  return (
    <nav className="flex-1 px-4 pb-4">
      <ul className="space-y-2">
        <li>
          <AboutDropdown variant="mobile" onNavClick={onNavClick} />
        </li>
        {mainNavigation.map(item => (
          <li key={item.id}>
            <Link
              href={item.path}
              onClick={onNavClick}
              className={styleMerge(
                "block text-noir-gold hover:text-noir-light font-semibold text-lg py-4 px-4 border border-transparent transition-colors duration-400 rounded-lg mobile-touch-target hover:bg-noir-black/30",
                isActive(item.path) &&
                  "text-noir-light bg-noir-black/30 border-noir-light/90"
              )}
            >
              {t(item.key)}
            </Link>
          </li>
        ))}

        {/* Admin dropdown - shown for all authenticated users (links filtered by role inside) */}
        {user && (
          <li>
            <AdminDropdown user={user} onNavClick={onNavClick} />
          </li>
        )}
      </ul>
    </nav>
  )
}

export default NavigationLinks

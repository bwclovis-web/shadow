"use client"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { SIGN_IN } from "@/constants/routes"
import { mainNavigation } from "@/data/navigation"
import { getProfilePathForUser } from "@/utils/user"
import { styleMerge } from "@/utils/styleUtils"
import { usePathname } from "next/navigation"
import { type FC, type HTMLProps } from "react"
import { AiFillHome } from "react-icons/ai"
import { FaBars, FaHeart, FaUser } from "react-icons/fa"
import { LuSearch } from "react-icons/lu"

interface MobileBottomNavigationProps extends HTMLProps<HTMLDivElement> {
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
  onMenuOpen?: () => void
}

const navItemClass = (active: boolean) =>
  styleMerge(
    "flex flex-col items-center gap-1 p-2 mobile-touch-target transition-colors duration-200",
    active ? "text-noir-light" : "text-noir-gold hover:text-noir-light"
  )

function useIsActive() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return { isActive }
}

const MobileBottomNavigation: FC<MobileBottomNavigationProps> = ({
  className,
  user,
  onMenuOpen,
}) => {
  const { isActive } = useIsActive()
  const perfumesPath =
    mainNavigation.find(nav => nav.key === "perfumes")?.path || "/the-vault"
  const profileHref = user?.id
    ? getProfilePathForUser({
        id: user.id,
        username: user.username ?? null,
      })
    : SIGN_IN

  return (
    <div
      className={styleMerge(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-noir-dark/95 backdrop-blur-md border-t border-noir-light/20 mobile-safe-bottom",
        className
      )}
    >
      <nav className="flex justify-around items-center py-2">
        <PrefetchLink href="/" className={navItemClass(isActive("/", true))}>
          <AiFillHome size={20} />
          <span className="text-xs font-medium">Home</span>
        </PrefetchLink>

        <button
          type="button"
          onClick={() => {
            const searchInput = document.querySelector(
              'input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]'
            ) as HTMLInputElement | null
            searchInput?.focus()
          }}
          className="flex flex-col items-center gap-1 p-2 mobile-touch-target transition-colors duration-200 text-noir-gold hover:text-noir-light"
        >
          <LuSearch size={20} />
          <span className="text-xs font-medium">Search</span>
        </button>

        <PrefetchLink
          href={perfumesPath}
          className={navItemClass(isActive(perfumesPath))}
        >
          <FaHeart size={20} />
          <span className="text-xs font-medium">Perfumes</span>
        </PrefetchLink>

        <PrefetchLink
          href={profileHref}
          className={navItemClass(
            user?.id ? isActive(profileHref) : isActive(SIGN_IN, true)
          )}
        >
          <FaUser size={20} />
          <span className="text-xs font-medium">{user ? "Profile" : "Sign In"}</span>
        </PrefetchLink>

        <button
          type="button"
          onClick={onMenuOpen}
          className="flex flex-col items-center gap-1 p-2 mobile-touch-target transition-colors duration-200 text-noir-gold hover:text-noir-light"
          aria-label="Open menu"
        >
          <FaBars size={20} />
          <span className="text-xs font-medium">Menu</span>
        </button>
      </nav>
    </div>
  )
}

export default MobileBottomNavigation

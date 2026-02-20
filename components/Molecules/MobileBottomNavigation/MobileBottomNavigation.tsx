import { type FC, type HTMLProps } from "react"
import { AiFillHome } from "react-icons/ai"
import { FaBars, FaHeart, FaUser } from "react-icons/fa"
import { LuSearch } from "react-icons/lu"
import { NavLink } from "react-router"

import { mainNavigation } from "~/data/navigation"
import { ROUTE_PATH as ADMIN_PATH } from "~/routes/admin/profilePage"
import { ROUTE_PATH as SIGN_IN } from "~/routes/login/SignInPage"
import { styleMerge } from "~/utils/styleUtils"

interface MobileBottomNavigationProps extends HTMLProps<HTMLDivElement> {
  user?: {
    id?: string
    role?: string
  } | null
  onMenuOpen?: () => void
}

const MobileBottomNavigation: FC<MobileBottomNavigationProps> = ({
  className,
  user,
  onMenuOpen,
}) => (
  <div
    className={styleMerge(
      "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-noir-dark/95 backdrop-blur-md border-t border-noir-light/20 mobile-safe-bottom",
      className
    )}
  >
    <nav className="flex justify-around items-center py-2">
      {/* Home */}
      <NavLink
        to="/"
        className={({ isActive: active }) => styleMerge(
            "flex flex-col items-center gap-1 p-2 mobile-touch-target transition-colors duration-200",
            active ? "text-noir-light" : "text-noir-gold hover:text-noir-light"
          )
        }
      >
        <AiFillHome size={20} />
        <span className="text-xs font-medium">Home</span>
      </NavLink>

      {/* Search - Quick access to main search */}
      <button
        onClick={() => {
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
          }
        }}
        className="flex flex-col items-center gap-1 p-2 mobile-touch-target transition-colors duration-200 text-noir-gold hover:text-noir-light"
      >
        <LuSearch size={20} />
        <span className="text-xs font-medium">Search</span>
      </button>

      {/* Quick access to perfumes */}
      <NavLink
        to={
          mainNavigation.find(nav => nav.key === "perfumes")?.path || "/the-vault"
        }
        className={({ isActive: active }) => styleMerge(
            "flex flex-col items-center gap-1 p-2 mobile-touch-target transition-colors duration-200",
            active ? "text-noir-light" : "text-noir-gold hover:text-noir-light"
          )
        }
      >
        <FaHeart size={20} />
        <span className="text-xs font-medium">Perfumes</span>
      </NavLink>

      {/* User/Profile */}
      <NavLink
        to={user ? ADMIN_PATH : SIGN_IN}
        className={({ isActive: active }) => styleMerge(
            "flex flex-col items-center gap-1 p-2 mobile-touch-target transition-colors duration-200",
            active ? "text-noir-light" : "text-noir-gold hover:text-noir-light"
          )
        }
      >
        <FaUser size={20} />
        <span className="text-xs font-medium">{user ? "Profile" : "Sign In"}</span>
      </NavLink>

      {/* Menu */}
      <button
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

export default MobileBottomNavigation

import { type FC } from "react"
import { FaUser } from "react-icons/fa6"
import { NavLink } from "react-router"

import { ROUTE_PATH as SIGN_IN } from "~/routes/login/SignInPage"

import LogoutButton from "../../LogoutButton/LogoutButton"

interface UserSectionProps {
  user?: {
    id?: string
    role?: string
  } | null
  onNavClick: () => void
}

const UserSection: FC<UserSectionProps> = ({ user, onNavClick }) => (
  <div className="p-4 border-t border-noir-light/20 mt-4">
    {!user ? (
      <NavLink
        viewTransition
        to={SIGN_IN}
        onClick={onNavClick}
        className="flex items-center gap-3 text-noir-gold hover:text-noir-light font-semibold text-lg py-4 px-4 border border-transparent transition-colors duration-400 rounded-lg hover:bg-noir-black/30 mobile-touch-target"
      >
        <FaUser size={20} />
        <span>Sign In</span>
      </NavLink>
    ) : (
      <div className="flex items-center gap-3">
        <FaUser size={20} className="text-noir-gold" />
        <LogoutButton />
      </div>
    )}
  </div>
)

export default UserSection

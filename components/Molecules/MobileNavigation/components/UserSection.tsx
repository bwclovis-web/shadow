"use client"

import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"
import { FaUser } from "react-icons/fa6"

import { SIGN_IN } from "@/constants/routes"
import { getProfilePathForUser } from "@/utils/user"

import LogoutButton from "../../LogoutButton/LogoutButton"

interface UserSectionProps {
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
  onNavClick: () => void
}

const UserSection = ({ user, onNavClick }: UserSectionProps) => {
  const t = useTranslations("profile")
  return (
    <div className="p-4 border-t border-noir-light/20 mt-4">
      {!user ? (
        <Link
          href={SIGN_IN}
          onClick={onNavClick}
          className="flex items-center gap-3 text-noir-gold hover:text-noir-light font-semibold text-lg py-4 px-4 border border-transparent transition-colors duration-400 rounded-lg hover:bg-noir-black/30 mobile-touch-target"
        >
          <FaUser size={20} />
          <span>Sign In</span>
        </Link>
      ) : (
        <div className="flex flex-col gap-2">
          {user.id && (
            <Link
              href={getProfilePathForUser({
                id: user.id,
                username: user.username ?? null,
              })}
              onClick={onNavClick}
              className="flex items-center gap-3 text-noir-gold hover:text-noir-light font-semibold text-lg py-4 px-4 border border-transparent transition-colors duration-400 rounded-lg hover:bg-noir-black/30 mobile-touch-target"
            >
              <FaUser size={20} className="text-noir-gold" />
              <span>{t("navigation.profile")}</span>
            </Link>
          )}
          <LogoutButton />
        </div>
      )}
    </div>
  )
}

export default UserSection

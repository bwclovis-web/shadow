"use client"

import Link from "next/link"
import { FaUser } from "react-icons/fa6"

import { SIGN_IN } from "@/constants/routes"

import LogoutButton from "../../LogoutButton/LogoutButton"

interface UserSectionProps {
  user?: {
    id?: string
    role?: string
  } | null
  onNavClick: () => void
}

const UserSection = ({ user, onNavClick }: UserSectionProps) => (
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
      <div className="flex items-center gap-3">
        <FaUser size={20} className="text-noir-gold" />
        <LogoutButton />
      </div>
    )}
  </div>
)

export default UserSection

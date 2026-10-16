"use client"

import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"
import { FaUser, FaUserPlus } from "react-icons/fa6"

import { useJoinCta } from "@/components/Containers/SignupAvailability"
import { SIGN_IN } from "@/constants/routes"
import { trackJoinCtaClick } from "@/utils/analytics/track-join-cta"

import LogoutButton from "../../LogoutButton/LogoutButton"

interface UserSectionProps {
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
  onNavClick: () => void
}

const linkClass =
  "flex items-center gap-3 text-noir-gold hover:text-noir-light font-semibold text-lg py-4 px-4 border border-transparent transition-colors duration-400 rounded-lg hover:bg-noir-black/30 mobile-touch-target"

const UserSection = ({ user, onNavClick }: UserSectionProps) => {
  const t = useTranslations("navigation")
  const tJoin = useTranslations("join")
  const { href, labelKey, freeOpen, spotsLeft, limit } = useJoinCta()

  return (
    <div className="p-4 border-t border-noir-light/20 mt-4">
      {!user ? (
        <>
          <Link
            href={href}
            onClick={() => {
              trackJoinCtaClick("nav-mobile-menu", freeOpen)
              onNavClick()
            }}
            className={linkClass}
          >
            <FaUserPlus size={20} aria-hidden focusable={false} />
            <span className="flex flex-col">
              <span>{tJoin(labelKey)}</span>
              {freeOpen ? (
                <span className="text-xs font-normal text-noir-gold-100/80">
                  {tJoin("spotsLeft", { remaining: spotsLeft, limit })}
                </span>
              ) : null}
            </span>
          </Link>
          <Link href={SIGN_IN} onClick={onNavClick} className={linkClass}>
            <FaUser size={20} aria-hidden focusable={false} />
            <span>{t("signIn")}</span>
          </Link>
        </>
      ) : (
        <LogoutButton />
      )}
    </div>
  )
}

export default UserSection

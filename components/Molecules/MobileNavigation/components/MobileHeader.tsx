"use client"

import { type RefObject } from "react"
import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"
import { AiFillHome } from "react-icons/ai"
import { FaBars } from "react-icons/fa6"

import { GlobalAlertBell } from "@/components/Containers/UserAlerts/GlobalAlertBell"
import { useDirectMessageUnreadCount } from "@/components/Molecules/UserAlertsProvider/UserAlertsProvider"

interface MobileHeaderProps {
  logoText: string
  menuButtonRef: RefObject<HTMLButtonElement>
  modalOpen: boolean
  modalId: string
  onMenuToggle: () => void
  onNavClick: () => void
  userId?: string
}

const MobileHeader = ({
  logoText,
  menuButtonRef,
  modalOpen,
  modalId,
  onMenuToggle,
  onNavClick,
  userId,
}: MobileHeaderProps) => {
  const t = useTranslations("navigation")
  const directMessageUnread = useDirectMessageUnreadCount()

  return (
    <div className="flex justify-between items-center w-full py-4 px-4 bg-noir-dark/60 backdrop-blur-md">
      <Link
        href="/"
        className="text-noir-gold hover:text-noir-light font-semibold text-lg px-2 py-1 border border-transparent transition-colors duration-400 flex items-center"
        onClick={onNavClick}
      >
        <AiFillHome className="mr-2" size={20} aria-hidden focusable={false} />
        <span className="hidden sm:inline">{logoText}</span>
        <span className="sm:hidden">S&S</span>
      </Link>

      <div className="flex items-center gap-1 shrink-0">
        {userId && <GlobalAlertBell userId={userId} />}
        <div className="relative">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onMenuToggle}
            className="text-noir-gold hover:text-noir-gold-100 cursor-pointer p-3 transition-colors duration-200  mobile-touch-target rounded-lg hover:bg-noir-black/30"
            aria-label={
              directMessageUnread > 0
                ? t("aria.openMenuUnread")
                : t("aria.openMenu")
            }
            aria-expanded={modalOpen}
            aria-haspopup="true"
            aria-controls={modalId}
          >
            <FaBars size={34} aria-hidden focusable={false} />
          </button>
          {directMessageUnread > 0 && (
            <span
              className="pointer-events-none absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-noir-dark/60"
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default MobileHeader

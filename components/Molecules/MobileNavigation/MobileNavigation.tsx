import { type HTMLProps, type RefObject, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import Modal from "~/components/Organisms/Modal"
import { useSessionStore } from "~/stores/sessionStore"
import { styleMerge } from "~/utils/styleUtils"

import MobileHeader from "./components/MobileHeader"
import NavigationLinks from "./components/NavigationLinks"
import QuickActions from "./components/QuickActions"
import UserSection from "./components/UserSection"

interface MobileNavigationProps extends HTMLProps<HTMLDivElement> {
  user?: {
    id?: string
    role?: string
  } | null
  onMenuClose?: () => void
}

const MobileNavigation = ({
  className,
  user,
  onMenuClose,
}: MobileNavigationProps) => {
  const { t, ready } = useTranslation()
  const [isClientReady, setIsClientReady] = useState(false)
  const { toggleModal, modalOpen, modalId } = useSessionStore()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const MOBILE_MENU_ID = "mobile-navigation-menu"

  // Ensure client-side hydration consistency
  useEffect(() => {
    setIsClientReady(true)
  }, [])

  // Close menu when route changes
  const handleNavClick = () => {
    toggleModal(menuButtonRef as RefObject<HTMLButtonElement>, MOBILE_MENU_ID)
    onMenuClose?.()
  }

  const handleMenuToggle = () => {
    toggleModal(menuButtonRef as RefObject<HTMLButtonElement>, MOBILE_MENU_ID)
  }

  const logoText =
    ready && isClientReady ? t("navigation.logo") : "Shadow and Sillage"

  return (
    <div className={styleMerge("mobile-nav lg:hidden fixed w-full z-30", className)}>
      <MobileHeader
        logoText={logoText}
        menuButtonRef={menuButtonRef as RefObject<HTMLButtonElement>}
        modalOpen={modalOpen}
        modalId={MOBILE_MENU_ID}
        onMenuToggle={handleMenuToggle}
        onNavClick={handleNavClick}
      />

      {/* Mobile Menu Modal */}
      {modalOpen && modalId === MOBILE_MENU_ID && (
        <Modal animateStart="left" background="default" innerType="dark">
          <div className="flex flex-col w-full h-full max-h-[90vh] pointer-events-auto overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-noir-gold-500/20 mb-4 sticky top-0 bg-noir-black/95 backdrop-blur-sm">
              <h2 className="text-noir-gold font-semibold text-xl">{t("navigation.menu")}</h2>
            </div>

            {/* Navigation Links */}
            <NavigationLinks
              user={user}
              isClientReady={isClientReady}
              onNavClick={handleNavClick}
            />

            {/* User Section */}
            <UserSection user={user} onNavClick={handleNavClick} />

            {/* Quick Actions */}
            <QuickActions onNavClick={handleNavClick} />
          </div>
        </Modal>
      )}
    </div>
  )
}

export default MobileNavigation

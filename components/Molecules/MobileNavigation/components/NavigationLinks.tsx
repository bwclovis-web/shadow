"use client"

import { MainNavigationLinks } from "@/components/Molecules/MainNavigationLinks/MainNavigationLinks"

interface NavigationLinksProps {
  user?: {
    id?: string
    role?: string
  } | null
  exchangeNewThisWeekCount?: number
  onNavClick: () => void
}

const NavigationLinks = ({
  user,
  exchangeNewThisWeekCount = 0,
  onNavClick,
}: NavigationLinksProps) => (
  <nav className="flex-1 lg:px-4 pb-4">
    <ul className="space-y-2">
      <MainNavigationLinks
        variant="mobile"
        user={user}
        exchangeNewThisWeekCount={exchangeNewThisWeekCount}
        onNavClick={onNavClick}
      />
    </ul>
  </nav>
)

export default NavigationLinks

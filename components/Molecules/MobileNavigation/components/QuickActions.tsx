"use client"

import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"
import { AiFillHome } from "react-icons/ai"
import { FaMagnifyingGlass } from "react-icons/fa6"

interface QuickActionsProps {
  onNavClick: () => void
}

const QuickActions = ({ onNavClick }: QuickActionsProps) => {
  const t = useTranslations("navigation")
  return (
    <div className="p-4 border-t border-noir-light/20">
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/"
          onClick={onNavClick}
          className="flex flex-col items-center gap-2 text-noir-gold hover:text-noir-light p-3 rounded-lg hover:bg-noir-black/30 mobile-touch-target transition-colors duration-200"
        >
          <AiFillHome size={20} />
          <span className="text-sm font-medium">{t("home")}</span>
        </Link>
      <button
        onClick={() => {
          // Focus on search if available, or navigate to search page
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
            onNavClick()
          }
        }}
        className="flex cursor-pointer flex-col items-center gap-2 text-noir-gold hover:text-noir-light p-3 rounded-lg hover:bg-noir-black/30 mobile-touch-target transition-colors duration-200"
      >
        <FaMagnifyingGlass size={20} />
        <span className="text-sm font-medium">{t("search")}</span>
      </button>
      </div>
    </div>
  )
}

export default QuickActions

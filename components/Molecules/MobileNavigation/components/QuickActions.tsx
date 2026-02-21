import { useTranslations } from "next-intl"
import { AiFillHome } from "react-icons/ai"
import { LuSearch } from "react-icons/lu"
import { NavLink } from "react-router"

interface QuickActionsProps {
  onNavClick: () => void
}

const QuickActions = ({ onNavClick }: QuickActionsProps) => {
  const t = useTranslations("navigation")
  return (
  <div className="p-4 border-t border-noir-light/20">
    <div className="grid grid-cols-2 gap-3">
      <NavLink
        to="/"
        onClick={onNavClick}
        className="flex flex-col items-center gap-2 text-noir-gold hover:text-noir-light p-3 rounded-lg hover:bg-noir-black/30 mobile-touch-target transition-colors duration-200"
      >
        <AiFillHome size={20} />
        <span className="text-sm font-medium">{t("home")}</span>
      </NavLink>
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
        <LuSearch size={20} />
        <span className="text-sm font-medium">{t("search")}</span>
      </button>
      </div>
    </div>
  )
}

export default QuickActions

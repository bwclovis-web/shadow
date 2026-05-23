"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "next-view-transitions"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { FaChevronDown } from "react-icons/fa"

import { styleMerge } from "@/utils/styleUtils"

interface AboutDropdownProps {
  className?: string
  variant?: "desktop" | "mobile"
  onNavClick?: () => void
}

const ABOUT_MENU_ID = "about-menu"

const AboutDropdown = ({
  className,
  variant = "desktop",
  onNavClick,
}: AboutDropdownProps) => {
  const t = useTranslations("navigation")
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/")

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const aboutItems = [
    {
      id: "the-keepers",
      label: t("aboutUs"),
      path: "/the-keepers",
    },
    {
      id: "the-collectors-guide",
      label: t("howWeWork"),
      path: "/the-collectors-guide",
    },
    {
      id: "correspondence",
      label: t("contactUs"),
      path: "/correspondence",
    },
  ]

  const handleNavClick = () => {
    setIsOpen(false)
    onNavClick?.()
  }

  const baseClasses =
    variant === "mobile"
      ? "block text-noir-gold hover:text-noir-light text-lg lg:py-4 py-1 px-4 border border-transparent transition-colors duration-400 rounded-lg mobile-touch-target hover:bg-noir-black/30"
      : "text-noir-gold hover:text-noir-light text-lg px-2 py-1 border border-transparent transition-colors duration-400 block text-center"

  const dropdownClasses =
    variant === "mobile"
      ? "absolute top-full left-0 w-full bg-noir-dark border border-noir-light/20 rounded-lg shadow-lg z-50"
      : "absolute top-full left-0 mt-2 w-48 bg-noir-dark border border-noir-light/20 rounded-lg shadow-lg z-50"

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styleMerge(
          baseClasses,
          "flex items-center gap-2 cursor-pointer",
          isOpen && "text-noir-light bg-noir-black/30 border-noir-light/90"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={ABOUT_MENU_ID}
      >
        {t("about")}
        <FaChevronDown
          className={`transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          size={12}
          aria-hidden
          focusable={false}
        />
      </button>

      <div
        id={ABOUT_MENU_ID}
        className={dropdownClasses}
        hidden={!isOpen}
      >
          <ul className="py-2">
            {aboutItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.path}
                  onClick={handleNavClick}
                  className={styleMerge(
                    variant === "mobile"
                      ? "block text-noir-gold hover:text-noir-light text-lg py-3 px-4 transition-colors duration-400 hover:bg-noir-black/30"
                      : "block text-noir-gold hover:text-noir-light text-base py-2 px-4 transition-colors duration-400 hover:bg-noir-black/30",
                    isActive(item.path) && "text-noir-light bg-noir-black/30"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
      </div>
    </div>
  )
}

export default AboutDropdown

"use client"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import AboutDropdown from "@/components/Molecules/AboutDropdown/AboutDropdown"
import AdminDropdown from "@/components/Molecules/AdminDropdown/AdminDropdown"
import { mainNavigation } from "@/data/navigation"
import { styleMerge } from "@/utils/styleUtils"

export type MainNavigationLinksVariant = "mobile" | "desktop"

export interface MainNavigationLinksProps {
  variant: MainNavigationLinksVariant
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
  onNavClick?: () => void
}

const getMainNavItemClassName = (
  variant: MainNavigationLinksVariant,
  active: boolean
) => {
  if (variant === "mobile") {
    return styleMerge(
      "block text-noir-gold hover:text-noir-light text-lg lg:py-4 py-1 px-4 border border-transparent transition-colors duration-400 rounded-lg mobile-touch-target hover:bg-noir-black/30",
      active && "text-noir-light bg-noir-black/30 border-noir-light/90"
    )
  }
  const navLinkBase =
    "text-noir-gold hover:text-noir-light text-lg px-2 py-1 border border-transparent transition-colors duration-400"
  const navLinkActive =
    "text-noir-light bg-noir-black/30 rounded-full border-noir-light/90"
  return styleMerge(
    navLinkBase,
    "block text-center leading-5",
    active && navLinkActive
  )
}

export const MainNavigationLinks = ({
  variant,
  user,
  onNavClick,
}: MainNavigationLinksProps) => {
  const t = useTranslations("navigation")
  const pathname = usePathname()

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/")

  const aboutVariant = variant === "mobile" ? "mobile" : "desktop"

  return (
    <>
      <li>
        <AboutDropdown variant={aboutVariant} onNavClick={onNavClick} />
      </li>
      {mainNavigation.map((item) => (
        <li key={item.id}>
          <PrefetchLink
            href={item.path}
            onClick={onNavClick}
            className={getMainNavItemClassName(variant, isActive(item.path))}
          >
            {t(item.key)}
          </PrefetchLink>
        </li>
      ))}
      {user && (
        <li>
          <PrefetchLink
            href="/messages"
            onClick={onNavClick}
            className={getMainNavItemClassName(variant, isActive("/messages"))}
          >
            {t("messages")}
          </PrefetchLink>
        </li>
      )}
      {variant === "mobile" && user && (
        <li>
          <AdminDropdown user={user} onNavClick={onNavClick} />
        </li>
      )}
    </>
  )
}

"use client"

import { type VariantProps } from "class-variance-authority"
import type { HTMLProps } from "react"
import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { useTranslations } from "next-intl"
import { FaUser } from "react-icons/fa6"

import LanguageSwitcher from "@/components/Organisms/LanguageSwitcher/LanguageSwitcher"
import { mainNavigation } from "@/data/navigation"
import { ADMIN_PATH, SIGN_IN } from "@/constants/routes"
import { getProfilePathForUser } from "@/utils/user"
import { styleMerge } from "@/utils/styleUtils"

import AboutDropdown from "../AboutDropdown/AboutDropdown"
import LogoutButton from "../LogoutButton/LogoutButton"
import { globalNavigationVariants } from "./globalNavigation-variants"
import AdminNavigation from "../AdminNavigation/AdminNavigation"
import Image from "next/image"

interface GlobalNavigationProps
  extends HTMLProps<HTMLDivElement>,
    VariantProps<typeof globalNavigationVariants> {
  user?: {
    id?: string
    username?: string | null
    role?: string
  } | null
}

const navLinkBase =
  "text-noir-gold hover:text-noir-light font-semibold text-lg px-2 py-1 border border-transparent transition-colors duration-400"
const navLinkActive =
  "text-noir-light bg-noir-black/30 rounded-full border-noir-light/90"
const navLinkActiveAdmin =
  "text-noir-light bg-noir-gold rounded-full border-noir-light/90"

function GlobalNavigationContent({ user }: GlobalNavigationProps) {
  const t = useTranslations("navigation")
  const pathname = usePathname()

  const logoText = t("logo")

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <header
      className="fixed z-30 w-full h-auto bg-noir-dark/60 backdrop-blur-md top-0"
      data-sticky-header="global-navigation"
    >
      <div className="flex justify-end items-center px-30 bg-noir-black/60 backdrop-blur-md w-full gap-4">
        <LanguageSwitcher />
        <div className="flex items-center gap-2">
          {!user ? (
            <PrefetchLink
              href={SIGN_IN}
              className={styleMerge(
                navLinkBase,
                "flex",
                isActive(SIGN_IN, true) && navLinkActive
              )}
            >
              <FaUser size={20} title="Sign In" />
            </PrefetchLink>
          ) : (
            <>
              {user.id && (
                <PrefetchLink
                  href={getProfilePathForUser({
                    id: user.id,
                    username: user.username ?? null,
                  })}
                  className={styleMerge(
                    navLinkBase,
                    "flex",
                    isActive(
                      getProfilePathForUser({
                        id: user.id,
                        username: user.username ?? null,
                      })
                    ) && navLinkActive
                  )}
                >
                  <FaUser size={20} title="Profile" />
                </PrefetchLink>
              )}
              <LogoutButton />
            </>
          )}
        </div>
      </div>
      <nav
        className="hidden lg:flex justify-between inner-container"
        data-cy="GlobalNavigation"
      >
        <PrefetchLink href="/" className="px-2 block">
          <Image
            src="/images/navlogo.webp"
            alt={logoText}
            width={160}
            height={15}
            priority={true}
            quality={90}
            className="w-30 h-15"
          />
        </PrefetchLink>
        <ul className="flex gap-4 items-center tracking-wide max-w-max">
          <li>
            <AboutDropdown variant="desktop" />
          </li>
          {mainNavigation.map((item) => (
            <li key={item.id}>
              <PrefetchLink
                href={item.path}
                className={styleMerge(
                  navLinkBase,
                  "block text-center leading-5",
                  isActive(item.path) && navLinkActive
                )}
              >
                {t(item.key)}
              </PrefetchLink>
            </li>
          ))}
          {user && (
            <>
              <li>
                <PrefetchLink
                  href="/messages"
                  className={styleMerge(
                    navLinkBase,
                    "block text-center leading-5",
                    isActive("/messages") && navLinkActive
                  )}
                >
                  {t("messages")}
                </PrefetchLink>
              </li>
              <li>
                <PrefetchLink
                  href={ADMIN_PATH}
                  className={styleMerge(
                    navLinkBase,
                    "block text-center leading-5",
                    isActive(ADMIN_PATH) && navLinkActiveAdmin
                  )}
                >
                  {t("admin")}
                </PrefetchLink>
              </li>
            </>
          )}
        </ul>
      </nav>
      {user && (
        <div className="hidden lg:block">
          <AdminNavigation user={user} />
        </div>
      )}
    </header>
  )
}

const GlobalNavigation = (props: GlobalNavigationProps) => (
  <Suspense
    fallback={
      <div
        className="min-h-[56px] flex items-center justify-center"
        aria-hidden="true"
      />
    }
  >
    <GlobalNavigationContent {...props} />
  </Suspense>
)

export default GlobalNavigation

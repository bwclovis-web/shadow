"use client"

import { type VariantProps } from "class-variance-authority"
import type { HTMLProps } from "react"
import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"
import { useJoinCta } from "@/components/Containers/SignupAvailability"
import { trackJoinCtaClick } from "@/utils/analytics/track-join-cta"
import { useTranslations } from "next-intl"
import { FaUser } from "react-icons/fa6"

import LanguageSwitcher from "@/components/Organisms/LanguageSwitcher/LanguageSwitcher"
import { MainNavigationLinks } from "@/components/Molecules/MainNavigationLinks/MainNavigationLinks"
import { SIGN_IN } from "@/constants/routes"
import { styleMerge } from "@/utils/styleUtils"

import { GlobalAlertBell } from "@/components/Containers/UserAlerts/GlobalAlertBell"
import LogoutButton from "../LogoutButton/LogoutButton"
import { globalNavigationVariants } from "./globalNavigation-variants"
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
  "text-noir-gold hover:text-noir-light text-lg px-2 py-1 border border-transparent transition-colors duration-400"
const navLinkActive =
  "text-noir-light bg-noir-black/30 rounded-full border-noir-light/90"

const GuestJoinCta = () => {
  const t = useTranslations("join")
  const { href, labelKey, freeOpen, spotsLeft, limit } = useJoinCta()

  return (
    <div className="flex items-center gap-3">
      {freeOpen ? (
        <span className="text-xs text-noir-gold-100/80">
          {t("spotsLeft", { remaining: spotsLeft, limit })}
        </span>
      ) : null}
      <VooDooLink
        url={href}
        variant="primary"
        background="gold"
        size="sm"
        onClick={() => trackJoinCtaClick("nav-desktop", freeOpen)}
      >
        {t(labelKey)}
      </VooDooLink>
    </div>
  )
}

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
      className="fixed z-30 w-full h-auto bg-noir-dark/60 backdrop-blur-md top-0 hidden lg:block"
      data-sticky-header="global-navigation"
    >
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="relative mx-auto h-full w-full max-w-[1280px] px-10">
          <PrefetchLink
            href="/"
            className="pointer-events-auto absolute left-8 top-1/2 -translate-y-1/2 block px-2"
            aria-label={logoText}
          >
            <Image
              src="/images/new/logo-one.webp"
              alt=""
              width={356}
              height={356}
              priority={pathname !== "/"}
              quality={75}
              className="h-[var(--spacing-site-header-desktop)] w-auto max-h-42 drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)]"
            />
          </PrefetchLink>
        </div>
      </div>
      <div className="relative z-10 w-full bg-noir-black/60 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-end gap-4 px-10 py-2">
          <LanguageSwitcher />
          <div className="flex items-center gap-2">
            {!user ? (
              <>
                <GuestJoinCta />
                <PrefetchLink
                  href={SIGN_IN}
                  aria-label={t("signIn")}
                  className={styleMerge(
                    navLinkBase,
                    "flex",
                    isActive(SIGN_IN, true) && navLinkActive
                  )}
                >
                  <FaUser size={20} aria-hidden focusable={false} />
                </PrefetchLink>
              </>
            ) : (
              <>
                {user.id && <GlobalAlertBell userId={user.id} />}
                <LogoutButton />
              </>
            )}
          </div>
        </div>
      </div>
      <nav
        className="relative z-10 mx-auto hidden min-h-14 w-full max-w-[1280px] items-center justify-between px-10 py-2 lg:flex"
        aria-label={t("aria.primary")}
        data-cy="GlobalNavigation"
      >
        <div
          className="shrink-0 w-[calc(var(--spacing-site-header-desktop)+1rem)]"
          aria-hidden
        />
        <ul className="flex flex-wrap gap-4 items-center justify-end tracking-wide max-w-max">
          <MainNavigationLinks variant="desktop" user={user} />
        </ul>
      </nav>
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

"use client"

import { useTranslations } from "next-intl"
import { FaBookOpen, FaRightLeft, FaUserGroup } from "react-icons/fa6"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import {
  COMMUNITY_PATH,
  THE_ARCHIVE_PATH,
  THE_EXCHANGE_PATH,
} from "@/constants/routes"

const pathways = [
  {
    key: "archive",
    href: THE_ARCHIVE_PATH,
    icon: FaBookOpen,
  },
  {
    key: "exchange",
    href: THE_EXCHANGE_PATH,
    icon: FaRightLeft,
  },
  {
    key: "community",
    href: COMMUNITY_PATH,
    icon: FaUserGroup,
  },
] as const

const HomePathways = () => {
  const t = useTranslations("home.galleryWalk.pathways")

  return (
    <nav
      className="border-b border-noir-gold/30 bg-noir-black py-3 lg:py-4"
      aria-label={t("ariaLabel")}
    >
      <ul className="mx-auto grid w-full max-w-[1280px] px-5 sm:px-8 md:grid-cols-3 lg:px-10">
        {pathways.map(({ key, href, icon: Icon }) => (
          <li
            key={key}
            className="border-t border-noir-gold/30 first:border-t-0 md:border-t-0 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
          >
            <PrefetchLink
              href={href}
              className="group flex h-full items-center gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold md:py-2"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-noir-gold/80 text-noir-gold transition-colors group-hover:border-noir-light group-hover:text-noir-light">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-headline text-xl font-semibold leading-tight text-noir-gold transition-colors group-hover:text-noir-light lg:text-2xl">
                  {t(`${key}.title`)}
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-noir-light/75 lg:text-[0.9375rem]">
                  {t(`${key}.description`)}
                </span>
              </span>
            </PrefetchLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default HomePathways

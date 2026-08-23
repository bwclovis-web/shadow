"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import Select from "@/components/Atoms/Select"

const NAV_LINKS = [
  { href: "/community/shelves", labelKey: "publicShelvesLink" as const },
  { href: "/seasonal-planning", labelKey: "seasonalPlanningLink" as const },
  { href: "/wear-suggestions", labelKey: "wearSuggestionsLink" as const },
  { href: "/digest", labelKey: "digestLink" as const },
  { href: "/membership", labelKey: "membershipCta" as const },
]

const linkClassName =
  "text-sm uppercase tracking-wide border border-noir-gold/40 px-3 py-2 rounded hover:bg-white/5 text-noir-gold-100"

const CommunityPageNav = () => {
  const t = useTranslations("community")
  const router = useRouter()

  const navSelectData = [
    { id: "", name: "", label: t("navSelectPlaceholder") },
    ...NAV_LINKS.map(link => ({
      id: link.href,
      name: link.href,
      label: t(link.labelKey),
    })),
  ]

  return (
    <>
      <div className="mb-8 md:hidden">
        <Select
          selectId="community-page-nav"
          ariaLabel={t("navSelectLabel")}
          selectData={navSelectData}
          defaultId=""
          size="compact"
          className="w-full max-w-none"
          action={evt => {
            const href = evt.target.value
            if (!href) return
            router.push(href)
          }}
        />
      </div>
      <div className="mb-8 hidden md:flex flex-wrap justify-end gap-3">
        {NAV_LINKS.map(link => (
          <PrefetchLink key={link.href} href={link.href} className={linkClassName}>
            {t(link.labelKey)}
          </PrefetchLink>
        ))}
      </div>
    </>
  )
}

export default CommunityPageNav

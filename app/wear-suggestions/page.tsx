import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getWearSuggestions } from "@/models/wear-suggestions.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

export const metadata: Metadata = {
  title: "What should I wear?",
  description: "Three picks from your collection for today.",
  robots: { index: false, follow: false },
}

const BANNER = "/images/new/what-to-wear.webp"

const WearSuggestionsPage = async () => {
  const t = await getTranslations("wearSuggestions")
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: false,
  })

  if (!session?.userId) {
    return (
      <main id="main-content">
        <TitleBanner image={BANNER} heading={t("title")} subheading={t("subtitle")} />
        <PageWrapper>
          <p className="text-noir-gold-100">
            <Link href="/sign-in?redirect=/wear-suggestions" className="underline text-noir-gold">
              Sign in
            </Link>{" "}
            to see wear suggestions.
          </p>
        </PageWrapper>
      </main>
    )
  }

  const result = await getWearSuggestions(session.userId)

  if (!result.ok) {
    return (
      <main id="main-content">
        <TitleBanner image={BANNER} heading={t("title")} subheading={t("subtitle")} />
        <PageWrapper>
          <p className="text-noir-gold-100 mb-3">{t("premiumRequired")}</p>
          <Link href="/membership" className="text-noir-gold underline">
            {t("upgradeCta")}
          </Link>
        </PageWrapper>
      </main>
    )
  }

  const reasonLabel = (reason: string) => {
    if (reason === "season_fit") return t("seasonFit")
    if (reason === "profile_fit") return t("profileFit")
    if (reason === "recent_wear") return t("recentWear")
    return t("fromCollection")
  }

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER}
        heading={t("title")}
        subheading={`${t("subtitle")} (${result.season})`}
      />
      <PageWrapper>
        {result.suggestions.length === 0 ? (
          <p className="text-noir-gold-100">{t("empty")}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-3">
            {result.suggestions.map(s => (
              <li
                key={s.id}
                className="rounded border border-noir-gold-500/30 bg-noir-dark/40 p-4"
              >
                <Link
                  href={`/perfume/${s.slug}`}
                  className="font-medium text-noir-gold hover:underline"
                >
                  {s.name}
                </Link>
                <p className="mt-1 text-xs text-noir-gold-500/80">{reasonLabel(s.reason)}</p>
                <p className="mt-2 text-sm text-noir-gold-100">{s.rationale}</p>
                <Link
                  href={`/community?tab=journal&perfumeId=${encodeURIComponent(s.id)}`}
                  className="mt-3 inline-block text-xs uppercase tracking-wide text-noir-gold underline"
                >
                  Log a wear
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageWrapper>
    </main>
  )
}

export default WearSuggestionsPage

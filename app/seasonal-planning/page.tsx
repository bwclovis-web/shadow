import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getSeasonalPlanningSuggestions } from "@/models/seasonal-planning.server"
import {
  getCurrentSeasonKey,
  getSeasonalPlanningBanner,
} from "@/utils/season-calendar"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

export const metadata: Metadata = {
  title: "Seasonal planning",
  description: "Wear this season suggestions from your collection and journal.",
}

const SeasonalPlanningPage = async () => {
  const t = await getTranslations("seasonalPlanning")
  const season = getCurrentSeasonKey()
  const banner = getSeasonalPlanningBanner(season)
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: false,
  })

  if (!session?.userId) {
    return (
      <main id="main-content">
        <TitleBanner image={banner} heading={t("title")} subheading={t("subtitle")} />
        <PageWrapper>
          <p className="text-noir-gold-100">
            <Link href="/sign-in?redirect=/seasonal-planning" className="underline text-noir-gold">
              Sign in
            </Link>{" "}
            to view seasonal planning.
          </p>
        </PageWrapper>
      </main>
    )
  }

  const result = await getSeasonalPlanningSuggestions(session.userId)

  if (!result.ok) {
    return (
      <main id="main-content">
        <TitleBanner image={banner} heading={t("title")} subheading={t("subtitle")} />
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
    if (reason === "collection") return t("fromCollection")
    if (reason === "recent_wear") return t("recentWear")
    if (reason === "scent_dna") return t("scentDna")
    if (reason === "quiz_pref") return t("quizPref")
    return t("trending")
  }

  return (
    <main id="main-content">
      <TitleBanner
        image={banner}
        heading={t("title")}
        subheading={`${t("subtitle")} (${result.season})`}
      />
      <PageWrapper>
        {result.suggestions.length === 0 ? (
          <p className="text-noir-gold-100">{t("empty")}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.suggestions.map((s) => (
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
                <p className="mt-1 text-xs text-noir-gold-100">{reasonLabel(s.reason)}</p>
                {s.noteFamilyRationale ? (
                  <p className="mt-1 text-xs text-noir-gold-500/80">{s.noteFamilyRationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PageWrapper>
    </main>
  )
}

export default SeasonalPlanningPage

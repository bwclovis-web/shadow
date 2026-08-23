import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import { RecommendationReasonLine } from "@/components/Containers/Recommendations/RecommendationReasonLine"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { buildPersonalizedDigest } from "@/models/personalized-digest.server"
import { getHouseRadarItems } from "@/models/house-radar.server"
import { getWearSuggestions } from "@/models/wear-suggestions.server"
import { getPersonalizedRecommendations } from "@/services/recommendations"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

const BANNER_IMAGE = publicAssetUrl("/images/new/vault.webp")

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("digestPage.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const DigestPage = async ({ params }: Props) => {
  const { userSlug } = await params
  const { user } = await requireOwnedProfileSession(userSlug, {
    subPath: "digest",
  })
  const t = await getTranslations("digestPage")
  const tWear = await getTranslations("wearSuggestions")

  const [digest, wear, recs, houseRadar] = await Promise.all([
    buildPersonalizedDigest(user.id),
    getWearSuggestions(user.id),
    getPersonalizedRecommendations(user.id, 5),
    getHouseRadarItems(user.id),
  ])

  if (!digest) {
    return (
      <main id="main-content">
        <TitleBanner
          image={BANNER_IMAGE}
          heading={t("heading")}
          subheading={t("subheading")}
        />
        <PageWrapper>
          <p className="text-noir-gold-100 mb-3">{t("premiumRequired")}</p>
          <Link href="/membership" className="text-noir-gold underline">
            {t("upgradeCta")}
          </Link>
        </PageWrapper>
      </main>
    )
  }

  const wearReasonLabel = (reason: string) => {
    if (reason === "season_fit") return tWear("seasonFit")
    if (reason === "profile_fit") return tWear("profileFit")
    if (reason === "recent_wear") return tWear("recentWear")
    return tWear("fromCollection")
  }

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={`${t("subheading")} — ${digest.weekOf}`}
      />
      <PageWrapper>
        <div className="space-y-10">
          <p className="text-noir-gold-100">{digest.wardrobeHint}</p>

          <section>
            <h2 className="mb-4 text-lg uppercase tracking-wide text-noir-gold">
              {t("recommendations")}
            </h2>
            {recs.length === 0 ? (
              <p className="text-sm text-noir-gold-100">{t("empty")}</p>
            ) : (
              <ul className="space-y-3">
                {recs.map(r => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded border border-noir-gold-500/30 bg-noir-dark/40 px-4 py-3"
                  >
                    <Link
                      href={`/perfume/${r.slug}`}
                      className="font-medium text-noir-gold hover:underline"
                    >
                      {r.name}
                    </Link>
                    <RecommendationReasonLine reason={r.reason} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {wear.ok && wear.suggestions.length > 0 ? (
            <section>
              <h2 className="mb-4 text-lg uppercase tracking-wide text-noir-gold">
                {t("wearSuggestions")}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-3">
                {wear.suggestions.map(s => (
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
                    <p className="mt-1 text-xs text-noir-gold-500/80">
                      {wearReasonLabel(s.reason)}
                    </p>
                    <p className="mt-1 text-xs text-noir-gold-100">{s.rationale}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {houseRadar.length > 0 ? (
            <section>
              <h2 className="mb-4 text-lg uppercase tracking-wide text-noir-gold">
                {t("houseRadar")}
              </h2>
              <ul className="space-y-2">
                {houseRadar.map(item => (
                  <li
                    key={item.perfumeId}
                    className="flex flex-wrap items-baseline gap-2 text-sm text-noir-gold-100"
                  >
                    <Link
                      href={`/perfume/${item.perfumeSlug}`}
                      className="font-medium text-noir-gold hover:underline"
                    >
                      {item.perfumeName}
                    </Link>
                    <span className="opacity-70">
                      {t("fromHouse", { house: item.houseName })}
                    </span>
                    {item.matchedFamily ? (
                      <span className="text-xs text-noir-gold-500/80">
                        {t("palateMatch", { family: item.matchedFamily })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-4 text-lg uppercase tracking-wide text-noir-gold">
              {t("sampling")}
            </h2>
            {digest.samplingQueue.length === 0 ? (
              <p className="text-sm text-noir-gold-100">—</p>
            ) : (
              <ul className="space-y-2 text-sm text-noir-gold-100">
                {digest.samplingQueue.map((q, i) => (
                  <li key={`${q.perfumeName}-${i}`}>
                    {q.perfumeName}{" "}
                    <span className="text-noir-gold-500/70">({q.status})</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-lg uppercase tracking-wide text-noir-gold">
              {t("gaps")}
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-noir-gold-100">
              {digest.collectionGaps.map(g => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </section>
        </div>
      </PageWrapper>
    </main>
  )
}

export default DigestPage

import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { listPublishedChallenges } from "@/models/community.server"

/** Placeholder hero — swap when a dedicated challenges asset is ready. */
const BANNER_IMAGE = "/images/new/quiz.webp"

export const metadata: Metadata = {
  title: "Community challenges | Shadow",
  description: "Seasonal scent challenges and community events.",
}

const CommunityChallengesPage = async () => {
  const t = await getTranslations("community")
  const challenges = await listPublishedChallenges()

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("challengesPage.heading")}
        subheading={t("challengesPage.subheading")}
      />
      <PageWrapper>
        <p className="text-xs uppercase tracking-wide mb-6">
          <PrefetchLink href="/community" className="text-noir-gold-500/80 hover:underline">
            ← {t("title")}
          </PrefetchLink>
        </p>
        <p className="mb-8 text-noir-gold-100/90 max-w-2xl">
          {t("challengesPage.intro")}{" "}
          <Link href="/journal" className="underline text-noir-gold-500">
            {t("challengesPage.journalLink")}
          </Link>{" "}
          {t("challengesPage.introAfter")}
        </p>
        {challenges.length === 0 ? (
          <p className="text-sm opacity-80 text-noir-gold-100">
            {t("challengesPage.empty")}{" "}
            <PrefetchLink href="/community" className="underline text-noir-gold-500">
              {t("title")}
            </PrefetchLink>
            .
          </p>
        ) : (
          <ul className="space-y-4">
            {challenges.map(c => (
              <li key={c.id} className="noir-border rounded-lg p-4 text-noir-gold-100">
                <h2 className="text-lg text-noir-gold-500">
                  <Link
                    href={`/community/challenges/${c.slug}`}
                    className="hover:underline"
                  >
                    {c.title}
                  </Link>
                </h2>
                {c.description && (
                  <p className="text-sm mt-1 opacity-80">{c.description}</p>
                )}
                <p className="text-xs mt-2 opacity-60">
                  {t("challengeMeta", {
                    count: c._count.entries,
                    ends: c.endsAt.toISOString().slice(0, 10),
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PageWrapper>
    </main>
  )
}

export default CommunityChallengesPage

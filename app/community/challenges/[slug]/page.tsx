import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getChallengeBySlug } from "@/models/community.server"
import { getTraderDisplayName, getProfilePathForUser } from "@/utils/user"

const BANNER_IMAGE = "/images/new/quiz.webp"

type Props = {
  params: Promise<{ slug: string }>
}

export const generateMetadata = async ({ params }: Props) => {
  const { slug } = await params
  const challenge = await getChallengeBySlug(slug)
  if (!challenge) return { title: "Challenge" }
  return {
    title: `${challenge.title} | Community challenges`,
    description: challenge.description ?? undefined,
  }
}

const ChallengeDetailPage = async ({ params }: Props) => {
  const { slug } = await params
  const challenge = await getChallengeBySlug(slug)
  if (!challenge || !challenge.isPublished) notFound()

  const t = await getTranslations("community")
  const now = new Date()
  const isLive = challenge.startsAt <= now && challenge.endsAt >= now

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={challenge.title}
        subheading={
          isLive
            ? t("challengeMeta", {
                count: challenge._count.entries,
                ends: challenge.endsAt.toISOString().slice(0, 10),
              })
            : challenge.description ?? ""
        }
      />
      <PageWrapper>
        <p className="text-xs uppercase tracking-wide mb-6">
          <PrefetchLink
            href="/community/challenges"
            className="text-noir-gold-500/80 hover:underline"
          >
            ← {t("challengesPage.heading")}
          </PrefetchLink>
        </p>
        {challenge.description && (
          <p className="mb-8 text-noir-gold-100/90 max-w-2xl">{challenge.description}</p>
        )}
        <h2 className="text-lg text-noir-gold-500 mb-4">{t("challengeEntries")}</h2>
        {challenge.entries.length === 0 ? (
          <p className="text-sm opacity-70">{t("noChallengeEntries")}</p>
        ) : (
          <ul className="space-y-3">
            {challenge.entries.map(entry => {
              const name = getTraderDisplayName(entry.user)
              const profileHref = getProfilePathForUser(entry.user)
              return (
                <li key={entry.id} className="noir-border rounded-lg p-4 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <PrefetchLink
                      href={profileHref}
                      className="text-noir-gold-500 hover:underline"
                    >
                      {name}
                    </PrefetchLink>
                    <span className="opacity-60 text-xs">
                      {entry.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </div>
                  {entry.perfume && (
                    <p className="mt-1">
                      <Link
                        href={`/perfume/${entry.perfume.slug}`}
                        className="underline text-noir-gold-500"
                      >
                        {entry.perfume.name}
                      </Link>
                    </p>
                  )}
                  {entry.caption && (
                    <p className="opacity-80 mt-1">{entry.caption}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-8 text-sm">
          <PrefetchLink href="/community" className="underline text-noir-gold-500">
            {t("joinChallenge")}
          </PrefetchLink>
        </p>
      </PageWrapper>
    </main>
  )
}

export default ChallengeDetailPage

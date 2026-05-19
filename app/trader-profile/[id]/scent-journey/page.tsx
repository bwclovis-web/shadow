import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { Link } from "next-view-transitions"

import { ScentJourneyTimeline } from "@/components/Containers/TraderProfile/ScentJourneyTimeline"
import TitleBanner from "@/components/Organisms/TitleBanner"
import {
  getScentJourneyForUser,
  SCENT_JOURNEY_FULL_LIMIT,
} from "@/models/scent-journey.server"
import { getTraderById } from "@/models/user.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getTraderDisplayName } from "@/utils/user"

type Props = {
  params: Promise<{ id: string }>
}

const BANNER_IMAGE = "/images/trade.webp"

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { id } = await params
  const trader = await getTraderById(id)
  if (!trader) return { title: "Scent journey" }

  const t = await getTranslations("traderProfile.scentJourney.meta")
  const traderName = getTraderDisplayName(trader)

  return {
    title: t("title", { traderName }),
    description: t("description", { traderName }),
    openGraph: {
      title: t("title", { traderName }),
      description: t("description", { traderName }),
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: t("title", { traderName }),
      description: t("description", { traderName }),
    },
  }
}

export default async function TraderScentJourneyPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { id } = await params
  if (!id) notFound()

  const trader = await getTraderById(id)
  if (!trader) notFound()

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const viewerId = session?.user?.id ?? null

  const [scentJourney, t] = await Promise.all([
    getScentJourneyForUser(trader.id, SCENT_JOURNEY_FULL_LIMIT),
    getTranslations("traderProfile.scentJourney"),
  ])

  const traderName = getTraderDisplayName(trader)
  const profileHref = `/trader-profile/${trader.id}`

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("pageHeading", { traderName })}
        subheading={t("pageSubheading")}
      />
      <div className="inner-container mx-auto max-w-2xl px-4 py-10">
        <p className="mb-6">
          <Link
            href={profileHref}
            className="text-sm text-noir-gold underline-offset-2 hover:underline"
          >
            {t("backToProfile", { traderName })}
          </Link>
        </p>
        <ScentJourneyTimeline
          items={scentJourney}
          traderId={trader.id}
          viewerId={viewerId}
        />
      </div>
    </section>
  )
}

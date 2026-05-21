import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import ScentDnaCard from "@/components/Containers/TraderProfile/ScentDnaCard/ScentDnaCard"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getScentDnaForUser } from "@/models/scent-dna.server"
import { getTraderById } from "@/models/user.server"
import { getTraderDisplayName } from "@/utils/user"
import PageWrapper from "@/components/Containers/Pagewrapper/PageWrapper"

type Props = {
  params: Promise<{ id: string }>
}

const BANNER_IMAGE = "/images/quiz.png"

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { id } = await params
  const trader = await getTraderById(id)
  if (!trader) return { title: "Scent DNA" }

  const t = await getTranslations("traderProfile.scentDna.meta")
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

export default async function TraderScentDnaPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { id } = await params
  if (!id) notFound()

  const trader = await getTraderById(id)
  if (!trader) notFound()

  const [scentDna, t] = await Promise.all([
    getScentDnaForUser(trader.id),
    getTranslations("traderProfile.scentDna"),
  ])

  const traderName = getTraderDisplayName(trader)
  const sharePath = `/trader-profile/${trader.id}/scent-dna`

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("sharePageHeading", { traderName })}
        subheading={t("sharePageSubheading")}
      />
      <PageWrapper className="flex justify-center">
        <ScentDnaCard
          scentDna={scentDna}
          traderName={traderName}
          shareUrl={sharePath}
          variant="share"
        />
      </PageWrapper>
    </main>
  )
}

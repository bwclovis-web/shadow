import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getPublicShelfById } from "@/models/community.server"
import { isFeatureEnabled } from "@/utils/feature-flags"
import { getTraderDisplayName } from "@/utils/user"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"

type Props = {
  params: Promise<{ id: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { id } = await params
  if (!isValidPrismaRecordId(id) || !isFeatureEnabled("communityShelves")) {
    return { title: "Tray" }
  }
  const shelf = await getPublicShelfById(id)
  return {
    title: shelf?.name ?? "Tray",
    description: shelf?.description ?? "Public collection tray",
  }
}

const BANNER = "/images/new/community.webp"

const PublicShelfDetailPage = async ({ params }: Props) => {
  const { id } = await params
  const t = await getTranslations("publicShelves")

  if (!isFeatureEnabled("communityShelves") || !isValidPrismaRecordId(id)) {
    notFound()
  }

  const shelf = await getPublicShelfById(id)
  if (!shelf) notFound()

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER}
        heading={shelf.name}
        subheading={t("byCollector", {
          name: getTraderDisplayName(shelf.user),
        })}
      />
      <PageWrapper>
        <p className="mb-6">
          <Link href="/community/shelves" className="text-sm text-noir-gold underline">
            {t("backToBrowse")}
          </Link>
        </p>
        {shelf.description ? (
          <p className="mb-6 text-noir-gold-100">{shelf.description}</p>
        ) : null}
        {shelf.items.length === 0 ? (
          <p className="text-noir-gold-100">{t("empty")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shelf.items.map((item) => (
              <li key={item.id} className="rounded border border-noir-gold-500/20 p-3">
                <Link
                  href={`/perfume/${item.perfume.slug}`}
                  className="text-noir-gold hover:underline"
                >
                  {item.perfume.name}
                </Link>
                {item.note ? (
                  <p className="mt-1 text-xs text-noir-gold-100">{item.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PageWrapper>
    </main>
  )
}

export default PublicShelfDetailPage

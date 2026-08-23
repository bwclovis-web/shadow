import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { listPublicShelves } from "@/models/community.server"
import { isFeatureEnabled } from "@/utils/feature-flags"
import { getTraderDisplayName } from "@/utils/user"

export const metadata: Metadata = {
  title: "Public trays",
  description: "Browse public collection trays from the community.",
}

const BANNER = "/images/new/public-trays.webp"

const PublicShelvesPage = async () => {
  const t = await getTranslations("publicShelves")

  if (!isFeatureEnabled("communityShelves")) {
    return (
      <main id="main-content">
        <TitleBanner
          image={BANNER}
          heading={t("browseTitle")}
          subheading={t("browseSubtitle")}
        />
        <PageWrapper>
          <p className="text-noir-gold-100">{t("empty")}</p>
        </PageWrapper>
      </main>
    )
  }

  const shelves = await listPublicShelves()

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER}
        heading={t("browseTitle")}
        subheading={t("browseSubtitle")}
      />
      <PageWrapper>
        {shelves.length === 0 ? (
          <p className="text-noir-gold-100">{t("empty")}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shelves.map((shelf) => (
              <li
                key={shelf.id}
                className="rounded border border-noir-gold-500/30 bg-noir-dark/30 p-4"
              >
                <h2 className="text-lg text-noir-gold">{shelf.name}</h2>
                <p className="text-xs text-noir-gold-100 mb-2">
                  {t("byCollector", {
                    name: getTraderDisplayName(shelf.user),
                  })}{" "}
                  · {shelf._count.items}
                </p>
                <Link
                  href={`/community/shelf/${shelf.id}`}
                  className="text-sm text-noir-gold underline"
                >
                  {t("viewShelf")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageWrapper>
    </main>
  )
}

export default PublicShelvesPage

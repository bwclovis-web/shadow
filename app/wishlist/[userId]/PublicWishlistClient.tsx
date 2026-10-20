"use client"

import { useEffect } from "react"
import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"

import { Button } from "@/components/Atoms/Button/Button"
import { CopyShareLinkButton } from "@/components/Molecules/CopyShareLinkButton"
import { ItemsSearchingFor } from "@/components/Containers/TraderProfile"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { useCatalogNavigation } from "@/hooks/useCatalogNavigation"
import type { PublicSeekingPageResult } from "@/types/seeking"
import {
  buildSeekingPublicHref,
  type SeekingPublicUrlState,
  withSeekingPublicPage,
} from "@/utils/seeking-params"

type PublicWishlistClientProps = {
  traderId: string
  traderName: string
  traderRegion?: string | null
  seeking: PublicSeekingPageResult
  urlState: SeekingPublicUrlState
  bannerImage: string
}

const PublicWishlistClient = ({
  traderId,
  traderName,
  traderRegion,
  seeking,
  urlState,
  bannerImage,
}: PublicWishlistClientProps) => {
  const t = useTranslations("wishlist.public")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const basePath = `/wishlist/${traderId}`
  const { isPending, state: requested, navigate } = useCatalogNavigation(urlState)

  const { meta, items } = seeking

  useEffect(() => {
    if (urlState.page === meta.currentPage) return
    if (meta.totalCount === 0 && urlState.page <= 1) return
    const clamped = withSeekingPublicPage(urlState, meta.currentPage)
    router.replace(buildSeekingPublicHref(basePath, clamped), { scroll: false })
  }, [basePath, meta.currentPage, meta.totalCount, router, urlState])

  const wishlistItems = items.map(item => ({
    id: item.id,
    perfumeId: item.perfumeId,
    isPublic: true as const,
    bottlePreference: item.bottlePreference,
    createdAt:
      item.createdAt instanceof Date
        ? item.createdAt.toISOString()
        : String(item.createdAt),
    user: {
      id: traderId,
      firstName: traderName,
      lastName: "",
      username: "",
      email: "",
    },
    perfume: {
      ...item.perfume,
      image: item.perfume.image ?? undefined,
      perfumeHouse: item.perfume.perfumeHouse ?? undefined,
    },
  }))

  const regionLabel =
    traderRegion && traderRegion.trim().length > 0
      ? t("regionHint", { region: traderRegion.trim() })
      : t("regionUnknown")

  const go = (next: SeekingPublicUrlState) => {
    navigate(buildSeekingPublicHref(basePath, next), next)
  }

  const showPagination = meta.totalPages > 1
  const showRange = meta.totalCount > 0 && meta.showingFrom > 0

  return (
    <section>
      <TitleBanner
        image={bannerImage}
        heading={t("heading", { traderName })}
        subheading={t("subheading")}
      >
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-semibold text-noir-gold-500">
            {t("itemCount", { count: meta.totalCount })}
          </p>
          <p className="text-sm text-noir-gold-100">{regionLabel}</p>
          <CopyShareLinkButton sharePath={`/wishlist/${traderId}`} />
          <Link
            href={`/trader-profile/${traderId}`}
            className="text-sm text-noir-gold-100 underline hover:text-noir-gold"
          >
            {t("viewProfile")}
          </Link>
        </div>
      </TitleBanner>

      <div className="inner-container p-6">
        {meta.totalCount === 0 ? (
          <p className="text-center text-noir-gold-100">{t("empty")}</p>
        ) : (
          <div className="space-y-4">
            {showRange ? (
              <p className="text-center text-sm text-noir-gold-100">
                {t("showingRange", {
                  from: meta.showingFrom,
                  to: meta.showingTo,
                  total: meta.totalCount,
                })}
              </p>
            ) : null}

            {isPending ? (
              <p className="text-center text-sm text-noir-gold-100" aria-live="polite">
                {tCommon("loading")}
              </p>
            ) : null}

            <ItemsSearchingFor wishlistItems={wishlistItems} />

            {showPagination ? (
              <nav
                aria-label={t("paginationNav")}
                className="flex flex-col items-center gap-2 border-t border-noir-gold/20 pt-4"
              >
                <p className="text-sm text-noir-gold-100" aria-live="polite">
                  {t("pageOf", {
                    current: requested.page,
                    total: Math.max(meta.totalPages, 1),
                  })}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!meta.hasPrevPage || isPending}
                    aria-label={tCommon("previous")}
                    onClick={() =>
                      go(withSeekingPublicPage(requested, requested.page - 1))
                    }
                  >
                    {tCommon("previous")}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={!meta.hasNextPage || isPending}
                    aria-label={tCommon("next")}
                    onClick={() =>
                      go(withSeekingPublicPage(requested, requested.page + 1))
                    }
                  >
                    {tCommon("next")}
                  </Button>
                </div>
              </nav>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}

export default PublicWishlistClient

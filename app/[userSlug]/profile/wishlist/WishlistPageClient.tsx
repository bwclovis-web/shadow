"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "next/navigation"

import { VooDooLink } from "@/components/Atoms/Button"
import { Button } from "@/components/Atoms/Button/Button"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import { TradeComposerModal } from "@/components/Containers/Trade/TradeComposerModal"
import { CopyShareLinkButton } from "@/components/Molecules/CopyShareLinkButton"
import { ExchangeCollectorsPanel } from "@/components/Organisms/ExchangeCollectorsPanel/ExchangeCollectorsPanel"
import Modal from "@/components/Organisms/Modal"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import {
  SIGN_IN,
  THE_ARCHIVE_PATH,
  THE_COLLECTORS_GUIDE_PATH,
} from "@/constants/routes"
import { TABLET_MEDIA } from "@/constants/breakpoints"
import { useCatalogNavigation } from "@/hooks/useCatalogNavigation"
import { useExchangeOffers } from "@/hooks/useExchangeOffers"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useTradeComposerModal } from "@/hooks/useTradeComposerModal"
import { seekingQueryKeys } from "@/lib/queries/seeking"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"
import type { OwnedSeekingPageResult } from "@/types/seeking"
import type { SeekingWishlistItemDto } from "@/types/seeking"
import { tradeListingSeedFromExchangeRow } from "@/types/trade"
import { offerDtoToUserPerfumeRow } from "@/utils/exchange-offer-dto"
import {
  buildSeekingOwnedHref,
  type SeekingOwnedUrlState,
  withSeekingAvailablePage,
  withSeekingFilterChange,
  withSeekingSeekingPage,
  withSeekingViewChange,
} from "@/utils/seeking-params"
import { normalizeSeekingSearch } from "@/utils/seeking-constants"
import type { SeekingView, SeekingVisibilityFilter } from "@/utils/seeking-constants"
import { getTraderDisplayName } from "@/utils/user"

import { revalidateWishlistPage } from "./actions"
import SeekingGroupSection from "./SeekingGroupSection"
import SeekingToolbar from "./SeekingToolbar"

type WishlistPageClientProps = {
  bannerImage: string
  userSlug: string
  userId: string
  urlState: SeekingOwnedUrlState
  seeking: OwnedSeekingPageResult
}

const WishlistPageClient = ({
  bannerImage,
  userSlug,
  userId,
  urlState,
  seeking,
}: WishlistPageClientProps) => {
  const t = useTranslations("wishlist")
  const tChrome = useTranslations("wishlist.chrome")
  const tCommon = useTranslations("common")
  const tListings = useTranslations("tradingPost.listings")
  const router = useRouter()
  const pathname = usePathname()
  const basePath = `/${userSlug}/profile/wishlist`
  const { isPending, state: requested, navigate } = useCatalogNavigation(urlState)
  const isMdUp = useMediaQuery(TABLET_MEDIA)
  const signInHref = `${SIGN_IN}?redirect=${encodeURIComponent(pathname)}`

  const [gridOffersPerfumeId, setGridOffersPerfumeId] = useState<string | null>(
    null
  )
  const [listExpandedPerfumeId, setListExpandedPerfumeId] = useState<
    string | null
  >(null)
  const [removedOfferIds, setRemovedOfferIds] = useState(() => new Set<string>())
  const [contactBusyOfferId, setContactBusyOfferId] = useState<string | null>(
    null
  )
  const offersTriggerRef = useRef<HTMLButtonElement | null>(null)

  const {
    composerData,
    modalOpen: composerModalOpen,
    openComposer,
    closeComposer,
  } = useTradeComposerModal()

  const serverDataKey = seekingQueryKeys.ownedData(userId, {
    search: seeking.search,
    visibility: seeking.visibility,
    availablePage: seeking.available.meta.currentPage,
    seekingPage: seeking.stillSeeking.meta.currentPage,
  })
  const requestedDataKey = seekingQueryKeys.ownedData(userId, {
    search: requested.search,
    visibility: requested.visibility,
    availablePage: requested.availablePage,
    seekingPage: requested.seekingPage,
  })
  const filterPending =
    isPending &&
    (requested.search !== seeking.search ||
      requested.visibility !== seeking.visibility)
  const suppressStaleGroups = filterPending

  const resultsView = requested.view
  const activeOffersPerfumeId =
    resultsView === "list" ? listExpandedPerfumeId : gridOffersPerfumeId

  const allPageItems = useMemo(
    () => [...seeking.available.items, ...seeking.stillSeeking.items],
    [seeking.available.items, seeking.stillSeeking.items]
  )

  const activeOffersItem = useMemo(
    () =>
      activeOffersPerfumeId
        ? (allPageItems.find(i => i.perfumeId === activeOffersPerfumeId) ?? null)
        : null,
    [activeOffersPerfumeId, allPageItems]
  )

  const offersQuery = useExchangeOffers({
    perfumeId: activeOffersPerfumeId,
    /** Seeking browse uses base Exchange eligibility (no discovery filters). */
    filterQueryString: "",
    enabled: Boolean(activeOffersPerfumeId),
  })

  const clearOffersUi = useCallback(() => {
    setGridOffersPerfumeId(null)
    setListExpandedPerfumeId(null)
    setRemovedOfferIds(new Set())
    setContactBusyOfferId(null)
    offersTriggerRef.current = null
  }, [])

  useEffect(() => {
    clearOffersUi()
  }, [
    clearOffersUi,
    seeking.search,
    seeking.visibility,
    seeking.available.meta.currentPage,
    seeking.stillSeeking.meta.currentPage,
  ])

  useEffect(() => {
    if (resultsView === "list") {
      setGridOffersPerfumeId(null)
    } else {
      setListExpandedPerfumeId(null)
    }
    setRemovedOfferIds(new Set())
    setContactBusyOfferId(null)
  }, [resultsView])

  useEffect(() => {
    setRemovedOfferIds(new Set())
    setContactBusyOfferId(null)
  }, [activeOffersPerfumeId])

  useEffect(() => {
    if (
      gridOffersPerfumeId &&
      !allPageItems.some(i => i.perfumeId === gridOffersPerfumeId)
    ) {
      setGridOffersPerfumeId(null)
    }
    if (
      listExpandedPerfumeId &&
      !allPageItems.some(i => i.perfumeId === listExpandedPerfumeId)
    ) {
      setListExpandedPerfumeId(null)
    }
  }, [allPageItems, gridOffersPerfumeId, listExpandedPerfumeId])

  const go = (next: SeekingOwnedUrlState) => {
    navigate(buildSeekingOwnedHref(basePath, next), next)
  }

  useEffect(() => {
    const clamped: SeekingOwnedUrlState = {
      ...urlState,
      search: seeking.search,
      visibility: seeking.visibility,
      availablePage: seeking.available.meta.currentPage,
      seekingPage: seeking.stillSeeking.meta.currentPage,
    }
    const needsClamp =
      urlState.availablePage !== clamped.availablePage ||
      urlState.seekingPage !== clamped.seekingPage
    if (!needsClamp) return
    if (seeking.availabilityStatus === "failed") return
    router.replace(buildSeekingOwnedHref(basePath, clamped), { scroll: false })
  }, [
    basePath,
    router,
    seeking.availabilityStatus,
    seeking.available.meta.currentPage,
    seeking.search,
    seeking.stillSeeking.meta.currentPage,
    seeking.visibility,
    urlState,
  ])

  const reconcileAfterMutation = async () => {
    await revalidateWishlistPage(userSlug, userId)
    router.refresh()
  }

  const handleSearchCommit = (raw: string) => {
    const search = normalizeSeekingSearch(raw)
    if (search === requested.search) return
    go(withSeekingFilterChange(requested, { search }))
  }

  const handleVisibilityChange = (visibility: SeekingVisibilityFilter) => {
    if (visibility === requested.visibility) return
    go(withSeekingFilterChange(requested, { visibility }))
  }

  const handleViewChange = (view: SeekingView) => {
    if (view === requested.view) return
    go(withSeekingViewChange(requested, view))
  }

  const handleViewOffers = useCallback(
    (item: SeekingWishlistItemDto, trigger: HTMLButtonElement | null) => {
      offersTriggerRef.current = trigger
      if (resultsView === "list") {
        setListExpandedPerfumeId(prev =>
          prev === item.perfumeId ? null : item.perfumeId
        )
        return
      }
      setGridOffersPerfumeId(item.perfumeId)
    },
    [resultsView]
  )

  const closeGridOffers = useCallback(() => {
    setGridOffersPerfumeId(null)
  }, [])

  const handleContactOffer = useCallback(
    async (offer: ExchangeOfferDto) => {
      if (!activeOffersItem || offer.userId === userId) return

      setContactBusyOfferId(offer.id)
      try {
        const available = await offersQuery.verifyOfferStillAvailable(offer.id)
        if (!available) {
          setRemovedOfferIds(prev => new Set(prev).add(offer.id))
          return
        }

        const up = offerDtoToUserPerfumeRow(offer)
        openComposer(
          {
            seed: tradeListingSeedFromExchangeRow(up, {
              perfumeId: activeOffersItem.perfumeId,
              perfumeName: activeOffersItem.perfume.name,
              perfumeHouse: activeOffersItem.perfume.perfumeHouse?.name,
              perfumeImage: activeOffersItem.perfume.image ?? null,
            }),
            counterpartyDisplayName: getTraderDisplayName(up.user),
          },
          offersTriggerRef.current
        )
      } finally {
        setContactBusyOfferId(null)
      }
    },
    [activeOffersItem, userId, openComposer, offersQuery]
  )

  const offersHost = {
    expandedPerfumeId:
      resultsView === "list" ? listExpandedPerfumeId : gridOffersPerfumeId,
    offers: offersQuery.offers,
    offersStatus: offersQuery.status,
    offersError: offersQuery.errorMessage,
    hasMoreOffers: offersQuery.hasMore,
    loadingMoreOffers: offersQuery.loadingMore,
    viewerId: userId,
    signInHref,
    removedOfferIds,
    contactBusyOfferId,
    onViewOffers: handleViewOffers,
    onContactOffer: (offer: ExchangeOfferDto) => void handleContactOffer(offer),
    onRetryOffers: () => void offersQuery.reload(),
    onLoadMoreOffers: () => void offersQuery.loadMore(),
  }

  const filterMatchTotal =
    seeking.visibilityCounts[
      seeking.visibility === "all" ? "all" : seeking.visibility
    ]
  const hasTrackedItems = seeking.heroTotalCount > 0
  const hasFilterMatches = filterMatchTotal > 0

  return (
    <main id="main-content">
      <TitleBanner
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <p className="mx-auto block max-w-max rounded-lg text-lg font-semibold text-noir-gold-500 shadow-md">
          {seeking.heroTotalCount} {t("itemsInWishlist")}
        </p>
      </TitleBanner>

      <PageWrapper>
        <div className="mb-4 px-4">
          <div className="noir-border mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-sm text-noir-gold-100">{t("share.stripHint")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <CopyShareLinkButton sharePath={`/wishlist/${userId}`} />
              <PrefetchLink
                href={`/wishlist/${userId}`}
                className="cursor-pointer text-sm font-medium text-noir-gold underline-offset-2 hover:underline"
              >
                {t("share.previewPublicPage")}
              </PrefetchLink>
            </div>
          </div>
        </div>

        {!hasTrackedItems ? (
          <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 rounded-md border-2 border-noir-light bg-noir-gray/80 p-4 py-8 text-center">
            <h2>{t("empty.heading")}</h2>
            <p className="text-xl text-noir-gold-100">{t("empty.subheading")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <VooDooLink url={THE_ARCHIVE_PATH} variant="primary" background="gold">
                {t("empty.browseArchive")}
              </VooDooLink>
              <PrefetchLink
                href={THE_COLLECTORS_GUIDE_PATH}
                className="cursor-pointer text-sm text-noir-gold underline-offset-4 hover:underline"
              >
                {t("empty.collectorsGuide")}
              </PrefetchLink>
            </div>
          </div>
        ) : (
          <div className="space-y-6 px-2 md:px-0">
            <SeekingToolbar
              state={requested}
              disabled={isPending}
              onSearchCommit={handleSearchCommit}
              onVisibilityChange={handleVisibilityChange}
              onViewChange={handleViewChange}
              labels={{
                searchPlaceholder: tChrome("searchPlaceholder"),
                visibilityGroupLabel: tChrome("visibilityGroupLabel"),
                visibilityAll: tChrome("visibilityAll", {
                  count: seeking.visibilityCounts.all,
                }),
                visibilityPublic: tChrome("visibilityPublic", {
                  count: seeking.visibilityCounts.public,
                }),
                visibilityPrivate: tChrome("visibilityPrivate", {
                  count: seeking.visibilityCounts.private,
                }),
                viewLabel: tChrome("viewLabel"),
                gridView: tChrome("gridView"),
                listView: tChrome("listView"),
              }}
            />

            {isPending ? (
              <p className="text-sm text-noir-gold-100" aria-live="polite">
                {tChrome("updating")}
              </p>
            ) : null}

            {seeking.availabilityStatus === "failed" ? (
              <div
                className="rounded border border-red-500/40 bg-red-950/40 px-4 py-3 text-center"
                role="alert"
              >
                <p className="text-noir-cream">{tChrome("availabilityFailed")}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.refresh()}
                >
                  {tChrome("retry")}
                </Button>
              </div>
            ) : null}

            {!hasFilterMatches && seeking.availabilityStatus === "ok" ? (
              <p className="py-8 text-center text-noir-gold-100">
                {tChrome("noMatches")}
              </p>
            ) : null}

            {hasFilterMatches && seeking.availabilityStatus === "ok" ? (
              <div
                className="space-y-8"
                data-seeking-key={serverDataKey.join(":")}
                data-seeking-requested={requestedDataKey.join(":")}
              >
                <SeekingGroupSection
                  group={seeking.available}
                  view={requested.view}
                  markAvailable
                  suppressItems={suppressStaleGroups}
                  offersHost={offersHost}
                  onPageChange={page =>
                    go(withSeekingAvailablePage(requested, page))
                  }
                  onRemoveItem={reconcileAfterMutation}
                  onVisibilityChange={reconcileAfterMutation}
                  labels={{
                    heading: tChrome("availableHeading", {
                      count: seeking.available.meta.totalCount,
                    }),
                    showingRange: tChrome("showingRange", {
                      from: seeking.available.meta.showingFrom,
                      to: seeking.available.meta.showingTo,
                      total: seeking.available.meta.totalCount,
                    }),
                    empty: tChrome("availableEmpty"),
                    previous: tCommon("previous"),
                    next: tCommon("next"),
                    paginationNav: tChrome("availablePagination"),
                    pageStatus: tChrome("pageOf", {
                      label: tChrome("availableLabel"),
                      current: seeking.available.meta.currentPage,
                      total: Math.max(seeking.available.meta.totalPages, 1),
                    }),
                  }}
                />

                <SeekingGroupSection
                  group={seeking.stillSeeking}
                  view={requested.view}
                  markAvailable={false}
                  suppressItems={suppressStaleGroups}
                  offersHost={offersHost}
                  onPageChange={page =>
                    go(withSeekingSeekingPage(requested, page))
                  }
                  onRemoveItem={reconcileAfterMutation}
                  onVisibilityChange={reconcileAfterMutation}
                  labels={{
                    heading: tChrome("stillSeekingHeading", {
                      count: seeking.stillSeeking.meta.totalCount,
                    }),
                    showingRange: tChrome("showingRange", {
                      from: seeking.stillSeeking.meta.showingFrom,
                      to: seeking.stillSeeking.meta.showingTo,
                      total: seeking.stillSeeking.meta.totalCount,
                    }),
                    empty: tChrome("stillSeekingEmpty"),
                    previous: tCommon("previous"),
                    next: tCommon("next"),
                    paginationNav: tChrome("stillSeekingPagination"),
                    pageStatus: tChrome("pageOf", {
                      label: tChrome("stillSeekingLabel"),
                      current: seeking.stillSeeking.meta.currentPage,
                      total: Math.max(seeking.stillSeeking.meta.totalPages, 1),
                    }),
                  }}
                />
              </div>
            ) : null}

            <p className="px-2 text-center text-xs text-noir-gold-100/80">
              {tChrome("footerNote")}
            </p>
          </div>
        )}

        {activeOffersItem && resultsView === "grid" ? (
          <ExchangeCollectorsPanel
            open
            onClose={closeGridOffers}
            title={tListings("collectorsTitle", {
              name: activeOffersItem.perfume.name,
            })}
            closeLabel={tListings("collectorsClose")}
            perfumeName={activeOffersItem.perfume.name}
            perfumeImage={activeOffersItem.perfume.image}
            offers={offersQuery.offers}
            status={offersQuery.status}
            errorMessage={offersQuery.errorMessage}
            hasMore={offersQuery.hasMore}
            loadingMore={offersQuery.loadingMore}
            viewerId={userId}
            signInHref={signInHref}
            removedOfferIds={removedOfferIds}
            contactBusyOfferId={contactBusyOfferId}
            onContact={offer => void handleContactOffer(offer)}
            onRetry={() => void offersQuery.reload()}
            onLoadMore={() => void offersQuery.loadMore()}
            variant={isMdUp ? "panel" : "sheet"}
          />
        ) : null}

        {composerData && composerModalOpen ? (
          <Modal innerType="dark" animateStart="top">
            <TradeComposerModal
              data={composerData}
              onClose={closeComposer}
              onViewProfileClick={closeComposer}
              onListingPicked={init => {
                closeComposer()
                setTimeout(() => openComposer(init), 0)
              }}
            />
          </Modal>
        ) : null}
      </PageWrapper>
    </main>
  )
}

export default WishlistPageClient

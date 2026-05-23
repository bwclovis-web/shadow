"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTransitionRouter } from "next-view-transitions"

import { usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import { PaginationBar } from "@/components/Molecules/PaginationBar"
import { FilterChipStrip } from "@/components/Molecules/FilterChipStrip"
import { DiscoveryFiltersPanel } from "@/components/Organisms/DiscoveryFiltersPanel"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import { ExchangePerfumeCard } from "@/components/Molecules/ExchangePerfumeCard"
import { ExchangeOpenSplitChip } from "@/components/Molecules/ExchangeOpenSplitChip/ExchangeOpenSplitChip"
import Modal from "@/components/Organisms/Modal"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { DESKTOP_MEDIA } from "@/constants/breakpoints"
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { TradeComposerModal } from "@/components/Containers/Trade/TradeComposerModal"
import { useTradeComposerModal } from "@/hooks/useTradeComposerModal"
import {
  getTradeCtaLabelKey,
  isCashOnlyListing,
  tradeListingSeedFromExchangeRow,
} from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"
import {
  discoveryFiltersActive,
  discoveryFiltersToSearchParams,
  emptyDiscoveryFilters,
  parseDiscoveryFiltersFromSearchParams,
  type PerfumeDiscoveryFilters,
} from "@/utils/discovery-filters"
import ActivityFeedSection from "@/components/Containers/Exchange/ActivityFeedSection"
import SeasonalTrendingSection from "@/components/Containers/Exchange/SeasonalTrendingSection"
import WishlistMatchesSection from "@/components/Containers/Exchange/WishlistMatchesSection"
import { buildExchangeDiscoveryChipItems } from "./buildExchangeDiscoveryChipItems"
import type { ExchangePageData } from "./exchange-types"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

export type { ExchangePageData } from "./exchange-types"

const ROUTE_PATH = "/the-exchange"
const BANNER_IMAGE = "/images/new/exchange.webp"
const TheExchangeClient = ({
  availablePerfumes,
  pagination,
  searchQuery,
  initialNoteTags,
  initialHouse,
  initialPerfume = null,
  wishlistMatches = [],
  recentListings = [],
  followedActivity = [],
  seasonalTrending = { season: "spring", perfumes: [] },
  traderReputationByUserId = {},
  viewerId = null,
  openSplitChipsByPerfumeId = {},
}: ExchangePageData) => {
  const t = useTranslations("tradingPost")
  const tListings = useTranslations("tradingPost.listings")
  const tSplits = useTranslations("decantSplits.exchange")
  const tTradeComposer = useTranslations("tradeComposer")
  const tf = useTranslations("tradingPost.filters")
  const tSeason = useTranslations("singlePerfume.seasonVote.season")
  const tTraderPrefs = useTranslations("traderProfile.preferences")
  const tListingCondition = useTranslations("listing.condition")
  const tWishlistBottle = useTranslations("wishlist.bottlePreference")
  const router = useTransitionRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isLg = useMediaQuery(DESKTOP_MEDIA)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const exchangeGridRef = useRef<HTMLUListElement>(null)
  const {
    composerData,
    modalOpen: composerModalOpen,
    openComposer,
    openListingPicker,
    closeComposer,
  } = useTradeComposerModal()

  const searchParamsKey = searchParams.toString()
  const discoveryFromUrl = useMemo(
    () =>
      parseDiscoveryFiltersFromSearchParams(
        new URLSearchParams(searchParamsKey)
      ),
    [searchParamsKey]
  )

  const pushUrlFromSearchParams = useCallback(
    (nextSearch: URLSearchParams) => {
      const qs = nextSearch.toString()
      const newUrl = `${ROUTE_PATH}${qs ? `?${qs}` : ""}`
      const currentUrl = `${pathname}${searchParamsKey ? `?${searchParamsKey}` : ""}`
      if (newUrl !== currentUrl) {
        router.push(newUrl, { scroll: false })
      }
    },
    [router, pathname, searchParamsKey]
  )

  const updateSearchUrl = useCallback(
    async (query: string) => {
      const discovery = parseDiscoveryFiltersFromSearchParams(
        new URLSearchParams(searchParams.toString())
      )
      const nextSearch = discoveryFiltersToSearchParams(
        discovery,
        new URLSearchParams(searchParams.toString())
      )
      if (query) nextSearch.set("q", query)
      else nextSearch.delete("q")
      nextSearch.delete("pg")
      pushUrlFromSearchParams(nextSearch)
      return []
    },
    [searchParams, pushUrlFromSearchParams]
  )

  const {
    searchValue: localSearchValue,
    setSearchValue: setLocalSearchValue,
    cancelPending,
  } = useDebouncedSearch(updateSearchUrl, {
    delay: 300,
    minLength: 0,
    initialValue: searchQuery,
  })

  const localSearchRef = useRef(localSearchValue)
  useEffect(() => {
    localSearchRef.current = localSearchValue
  }, [localSearchValue])

  useGsapStagger(exchangeGridRef, {
    selector: "[data-exchange-card]",
    deps: [availablePerfumes.map(p => p.id).join(",")],
    enabled: availablePerfumes.length > 0,
  })

  const handleDiscoveryChange = useCallback(
    (next: PerfumeDiscoveryFilters) => {
      const nextSearch = discoveryFiltersToSearchParams(
        next,
        new URLSearchParams(searchParams.toString())
      )
      nextSearch.delete("pg")
      const q = localSearchRef.current.trim()
      if (q) nextSearch.set("q", q)
      else nextSearch.delete("q")
      pushUrlFromSearchParams(nextSearch)
    },
    [searchParams, pushUrlFromSearchParams]
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (pathname !== ROUTE_PATH) return
      const target = e.target as HTMLElement
      const inField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      if (e.key === "/" && !inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (e.key !== "Escape") return

      const hasFilters =
        discoveryFiltersActive(discoveryFromUrl) ||
        localSearchRef.current.trim().length > 0

      if (inField && document.activeElement === searchInputRef.current) {
        e.preventDefault()
        setLocalSearchValue("")
        cancelPending()
        if (hasFilters) handleDiscoveryChange(emptyDiscoveryFilters())
        searchInputRef.current?.blur()
        return
      }

      if (!inField && hasFilters) {
        e.preventDefault()
        setLocalSearchValue("")
        cancelPending()
        handleDiscoveryChange(emptyDiscoveryFilters())
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    pathname,
    discoveryFromUrl,
    cancelPending,
    handleDiscoveryChange,
    setLocalSearchValue,
  ])

  const handleProposeSwapFromCard = useCallback(
    (
      perfume: (typeof availablePerfumes)[number],
      trigger: HTMLButtonElement | null
    ) => {
      if (!viewerId) return
      const listings = perfume.userPerfume.filter(up => up.userId !== viewerId)
      if (listings.length === 0) return

      const perfumeMeta = {
        perfumeId: perfume.id,
        perfumeName: perfume.name,
        perfumeHouse: perfume.perfumeHouse?.name,
        perfumeImage: perfume.image ?? null,
      }

      if (listings.length === 1) {
        const up = listings[0]!
        openComposer(
          {
            seed: tradeListingSeedFromExchangeRow(up, perfumeMeta),
            counterpartyDisplayName: getTraderDisplayName(up.user),
          },
          trigger
        )
        return
      }

      openListingPicker(listings, perfumeMeta, {
        trigger,
        traderReputationByUserId,
      })
    },
    [viewerId, openComposer, openListingPicker, traderReputationByUserId]
  )

  const getCardOfferCtaKey = (
    perfume: (typeof availablePerfumes)[number]
  ): "proposeSwap" | "connectAboutBottle" | "chooseListing" => {
    const listings = perfume.userPerfume.filter(
      up => viewerId && up.userId !== viewerId
    )
    if (listings.length === 1) {
      const up = listings[0]!
      return getTradeCtaLabelKey(up.tradePreference, up.tradeOnly)
    }
    if (listings.every(up => isCashOnlyListing(up.tradePreference, up.tradeOnly))) {
      return "connectAboutBottle"
    }
    if (
      listings.every(
        up => !isCashOnlyListing(up.tradePreference, up.tradeOnly)
      )
    ) {
      return "proposeSwap"
    }
    return "chooseListing"
  }

  const handlePageChange = (page: number) => {
    cancelPending()
    const discovery = parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(searchParams.toString())
    )
    const nextSearch = discoveryFiltersToSearchParams(
      discovery,
      new URLSearchParams(searchParams.toString())
    )
    if (localSearchValue.trim()) nextSearch.set("q", localSearchValue.trim())
    else nextSearch.delete("q")
    if (page > 1) nextSearch.set("pg", page.toString())
    else nextSearch.delete("pg")
    pushUrlFromSearchParams(nextSearch)
  }

  const totalCount = pagination.totalCount ?? availablePerfumes.length
  const isEmptyExchange =
    totalCount === 0 &&
    !searchQuery &&
    !discoveryFiltersActive(discoveryFromUrl)

  const filterLabels = {
    notesTitle: tf("notesTitle"),
    notesDescription: tf("notesDescription"),
    notesSearchLabel: tf("notesSearchLabel"),
    seasonTitle: tf("seasonTitle"),
    seasonDescription: tf("seasonDescription"),
    houseTitle: tf("houseTitle"),
    houseSearchLabel: tf("houseSearchLabel"),
    houseClear: tf("houseClear"),
    priceTitle: tf("priceTitle"),
    priceDescription: tf("priceDescription"),
    minLabel: tf("minLabel"),
    maxLabel: tf("maxLabel"),
    tradePrefTitle: tf("tradePrefTitle"),
    tradePrefDescription: tf("tradePrefDescription"),
    tradePrefAria: tf("tradePrefAria"),
    tradePrefCash: tTraderPrefs("cash"),
    tradePrefTrade: tTraderPrefs("exchange"),
    tradePrefBoth: tTraderPrefs("both"),
    bottleTitle: tf("bottleTitle"),
    bottleDescription: tf("bottleDescription"),
    bottleAria: tf("bottleAria"),
    bottleFull: tWishlistBottle("full"),
    bottlePartial: tWishlistBottle("partial"),
    bottleSample: tWishlistBottle("sample"),
    bottleDecant: tf("bottleDecant"),
    conditionTitle: tf("conditionTitle"),
    conditionDescription: tf("conditionDescription"),
    conditionAria: tf("conditionAria"),
    conditionLabels: {
      sealed: tListingCondition("sealed"),
      mint: tListingCondition("mint"),
      lightlyUsed: tListingCondition("lightlyUsed"),
      heavilyUsed: tListingCondition("heavilyUsed"),
      damaged: tListingCondition("damaged"),
    },
    regionTitle: tf("regionTitle"),
    regionDescription: tf("regionDescription"),
    regionLabel: tf("regionLabel"),
    regionAll: tf("regionAll"),
    regionUS: tf("regionUS"),
    regionUK: tf("regionUK"),
    regionAU: tf("regionAU"),
    regionEU: tf("regionEU"),
    regionOther: tf("regionOther"),
    hasPhotosLabel: tf("hasPhotosLabel"),
    hasPhotosDescription: tf("hasPhotosDescription"),
    hasPhotosToggle: tf("hasPhotosToggle"),
    clearAll: tf("clearAll"),
  }

  const filterPanel = (
    <DiscoveryFiltersPanel
      value={discoveryFromUrl}
      onChange={handleDiscoveryChange}
      initialNoteTags={initialNoteTags}
      initialHouse={initialHouse}
      labels={filterLabels}
    />
  )

  const discoveryChipItems = useMemo(() => {
    if (!discoveryFiltersActive(discoveryFromUrl)) {
      return []
    }
    const houseLabel =
      discoveryFromUrl.houseId == null
        ? null
        : initialHouse?.id === discoveryFromUrl.houseId
          ? initialHouse.name
          : tf("unknownHouse")

    const perfumeLabel =
      discoveryFromUrl.perfumeId == null
        ? null
        : initialPerfume?.id === discoveryFromUrl.perfumeId
          ? initialPerfume.name
          : tf("unknownPerfume")

    return buildExchangeDiscoveryChipItems(discoveryFromUrl, {
      noteTags: initialNoteTags,
      houseLabel,
      perfumeLabel,
      apply: handleDiscoveryChange,
      seasonLabel: key => tSeason(key),
      copy: {
        removeFilterAria: label => tf("removeFilterAria", { label }),
        unknownNote: tf("unknownNote"),
        priceChipMin: min => tf("priceChipMin", { min }),
        priceChipMax: max => tf("priceChipMax", { max }),
        priceChipRange: (min, max) =>
          tf("priceChipRange", { min, max }),
        tradePrefLabel: pref => tTraderPrefs(pref),
        bottleLabel: bottle =>
          bottle === "decant" ? tf("bottleDecant") : tWishlistBottle(bottle),
        conditionLabel: condition => tListingCondition(condition),
        regionLabel: region => {
          const key =
            region === "US"
              ? "regionUS"
              : region === "UK"
                ? "regionUK"
                : region === "AU"
                  ? "regionAU"
                  : region === "EU"
                    ? "regionEU"
                    : "regionOther"
          return tf(key)
        },
        hasPhotosLabel: tf("hasPhotosChip"),
      },
    })
  }, [
    discoveryFromUrl,
    handleDiscoveryChange,
    initialHouse,
    initialPerfume,
    initialNoteTags,
    tListingCondition,
    tSeason,
    tTraderPrefs,
    tWishlistBottle,
    tf,
  ])

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <span className="block max-w-max rounded-md uppercase font-semibold text-noir-gold-500 mx-auto">
          {totalCount} {t("count")}
        </span>
      </TitleBanner>

      <PageWrapper>
      {isEmptyExchange ? (
        <div className="text-center py-8 bg-noir-gray/80 rounded-md mt-8 border-2 border-noir-light">
          <h2 className="text-noir-light font-black text-3xl text-shadow-md text-shadow-noir-dark">
            {t("empty")}
          </h2>
        </div>
      ) : (
        <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,300px)_1fr] lg:items-start">
              <div className="min-w-0 space-y-6 lg:sticky lg:top-4">
                {isLg ? (
                  <aside aria-label={tf("toggle")}>{filterPanel}</aside>
                ) : (
                  <details
                    className="rounded-md border border-noir-light bg-noir-gray/80"
                    open={mobileFiltersOpen}
                    onToggle={e => setMobileFiltersOpen(e.currentTarget.open)}
                  >
                    <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-noir-gold [&::-webkit-details-marker]:hidden">
                      {tf("toggle")}
                    </summary>
                    <div className="border-t border-noir-light/40 px-4 pb-4 pt-2">
                      {filterPanel}
                    </div>
                  </details>
                )}
                {seasonalTrending.perfumes.length > 0 ? (
                  <SeasonalTrendingSection
                    season={seasonalTrending.season}
                    perfumes={seasonalTrending.perfumes}
                    variant="sidebar"
                    className="noir-border rounded-md border-noir-gold/40 bg-noir-gold/10 p-4"
                  />
                ) : null}
              </div>

              <div className="min-w-0 space-y-6">
                {discoveryChipItems.length > 0 ? (
                  <FilterChipStrip
                    chips={discoveryChipItems}
                    regionAriaLabel={tf("activeFiltersAria")}
                    onClearAll={() =>
                      handleDiscoveryChange(emptyDiscoveryFilters())
                    }
                    clearAllLabel={tf("clearAll")}
                    variant="dark"
                    className="rounded-md border border-noir-light/40 bg-noir-gray/40 p-3"
                  />
                ) : null}
                <div className="max-w-md mx-auto lg:mx-0 lg:max-w-none">
                  <SearchInput
                    id="exchange-search"
                    inputRef={searchInputRef}
                    value={localSearchValue}
                    onChange={setLocalSearchValue}
                    placeholder={t("search.placeholder")}
                  />
                  <p className="mt-1 text-center text-xs text-noir-gold-500 lg:text-left">
                    {t("search.keyboardHint")}
                  </p>
                </div>
                {recentListings.length > 0 || followedActivity.length > 0 ? (
                  <ActivityFeedSection
                    listings={recentListings}
                    followedItems={followedActivity}
                  />
                ) : null}
                {viewerId && wishlistMatches.length > 0 ? (
                  <WishlistMatchesSection
                    matches={wishlistMatches}
                    viewerId={viewerId}
                    traderReputationByUserId={traderReputationByUserId}
                  />
                ) : null}
                {availablePerfumes.length === 0 ? (
                  <div className="text-center py-8 bg-noir-dark/80 rounded-md border-2 border-noir-gold animate-fade-in">
                    <h2>
                      {t("search.noResults")}
                    </h2>
                    <p className="text-noir-gold-100 mt-2">
                      {t("search.tryDifferent")}
                    </p>
                  </div>
                ) : (
                  <ul
                    ref={exchangeGridRef}
                    className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 auto-rows-fr"
                  >
                    {availablePerfumes.map(perfume => (
                      <li
                        key={perfume.id}
                        data-exchange-card
                        className="relative opacity-0"
                      >
                        <ExchangePerfumeCard perfume={perfume} viewerId={viewerId}>
                          <div className="rounded-md space-y-2">
                            {(openSplitChipsByPerfumeId[perfume.id]?.length ?? 0) > 0 && (
                              <ExchangeOpenSplitChip
                                chips={openSplitChipsByPerfumeId[perfume.id]!}
                                label={tSplits("openSplitChip", {
                                  count:
                                    openSplitChipsByPerfumeId[perfume.id]![0]!
                                      .openSlotCount,
                                })}
                              />
                            )}
                            <p className="text-sm font-medium text-noir-gold">
                              {tListings("summary", {
                                count: perfume.userPerfume.length,
                              })}
                            </p>
                            {viewerId &&
                            perfume.userPerfume.some(
                              up => up.userId !== viewerId
                            ) ? (
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                background="gold"
                                className="w-full max-w-full"
                                onClick={e =>
                                  handleProposeSwapFromCard(
                                    perfume,
                                    e.currentTarget
                                  )
                                }
                              >
                                {tTradeComposer(getCardOfferCtaKey(perfume))}
                              </Button>
                            ) : null}
                          </div>
                        </ExchangePerfumeCard>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

          {pagination.totalPages > 1 && (
            <PaginationBar
              className="py-6"
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          )}

          {composerData && composerModalOpen ? (
            <Modal innerType="dark" animateStart="top">
              <TradeComposerModal
                data={composerData}
                onClose={closeComposer}
                onViewProfileClick={closeComposer}
                traderReputationByUserId={traderReputationByUserId}
                onListingPicked={init => {
                  closeComposer()
                  setTimeout(() => openComposer(init), 0)
                }}
              />
            </Modal>
          ) : null}
        </>
      )}
      </PageWrapper>
    </main>
  )
}

export default TheExchangeClient

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button, VooDooLink } from "@/components/Atoms/Button"
import AdSenseUnit from "@/components/Atoms/AdSenseUnit"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { JoinLink } from "@/components/Molecules/JoinLink"
import { PaginationBar } from "@/components/Molecules/PaginationBar"
import { FilterChipStrip } from "@/components/Molecules/FilterChipStrip"
import { FilterToggleGroup } from "@/components/Molecules/FilterToggleGroup"
import { SaveSearchButton } from "@/components/Molecules/SaveSearchButton/SaveSearchButton"
import { ExchangeFragranceGroupCard } from "@/components/Molecules/ExchangeFragranceGroupCard"
import { ExchangeOpenSplitChip } from "@/components/Molecules/ExchangeOpenSplitChip/ExchangeOpenSplitChip"
import ActivityFeedSection from "@/components/Containers/Exchange/ActivityFeedSection"
import { ExchangeDiscoveryToolbar } from "@/components/Containers/Exchange/ExchangeDiscoveryToolbar"
import MutualSwapsSection from "@/components/Containers/Exchange/MutualSwapsSection"
import PalateRecommendationsSection from "@/components/Containers/Exchange/PalateRecommendationsSection"
import SeasonalTrendingSection from "@/components/Containers/Exchange/SeasonalTrendingSection"
import WishlistMatchesSection from "@/components/Containers/Exchange/WishlistMatchesSection"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import Modal from "@/components/Organisms/Modal"
import CatalogFilterDrawer from "@/components/Organisms/CatalogFilterDrawer/CatalogFilterDrawer"
import TitleBanner from "@/components/Organisms/TitleBanner"
import {
  SIGN_IN,
  THE_ARCHIVE_PATH,
  THE_COLLECTORS_GUIDE_PATH,
} from "@/constants/routes"
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import { useTradeComposerModal } from "@/hooks/useTradeComposerModal"
import { fetchExchangeOffersPage } from "@/lib/queries/exchange-offers"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"
import { tradeListingSeedFromExchangeRow } from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"
import type { ExchangeUserPerfumeRow } from "./exchange-types"
import {
  countDiscoveryFilters,
  discoveryFiltersActive,
  discoveryFiltersToSearchParams,
  DISCOVERY_TRADE_PREFERENCES,
  emptyDiscoveryFilters,
  parseDiscoveryFiltersFromSearchParams,
  type DiscoveryTradePreference,
  type PerfumeDiscoveryFilters,
} from "@/utils/discovery-filters"
import { styleMerge } from "@/utils/styleUtils"
import { buildExchangeDiscoveryChipItems } from "./buildExchangeDiscoveryChipItems"
import type { ExchangePageData } from "./exchange-types"

const DiscoveryFiltersPanel = dynamic(
  () =>
    import("@/components/Organisms/DiscoveryFiltersPanel").then(
      mod => mod.DiscoveryFiltersPanel
    ),
  { ssr: false }
)

const TradeComposerModal = dynamic(
  () =>
    import("@/components/Containers/Trade/TradeComposerModal").then(
      mod => mod.TradeComposerModal
    ),
  { ssr: false }
)

export type { ExchangePageData } from "./exchange-types"

const ROUTE_PATH = "/the-exchange"
const BANNER_IMAGE = "/images/new/exchange.webp"
const SIGN_IN_WITH_RETURN = `${SIGN_IN}?redirect=${encodeURIComponent(ROUTE_PATH)}`

const offerDtoToUserPerfumeRow = (
  offer: ExchangeOfferDto
): ExchangeUserPerfumeRow => ({
  id: offer.id,
  userId: offer.userId,
  available: offer.available,
  type: offer.type,
  tradePreference: offer.tradePreference,
  tradeOnly: offer.tradeOnly,
  price: offer.price,
  tradePrice: offer.tradePrice,
  images: offer.images,
  condition: offer.condition,
  decantFormat: offer.decantFormat,
  mlRemaining: offer.mlRemaining,
  user: offer.user,
})

const TheExchangeClient = ({
  availablePerfumes,
  pagination,
  searchQuery,
  filterQueryString,
  initialNoteTags,
  initialHouse,
  initialPerfume = null,
  wishlistMatches = [],
  palateRecommendations = [],
  mutualSwapSuggestions = [],
  recentListings = [],
  followedActivity = [],
  seasonalTrending = { season: "spring", perfumes: [] },
  traderReputationByUserId = {},
  viewerId = null,
  openSplitChipsByPerfumeId = {},
  showAds = true,
}: ExchangePageData) => {
  const t = useTranslations("tradingPost")
  const tListings = useTranslations("tradingPost.listings")
  const tSplits = useTranslations("decantSplits.exchange")
  const tf = useTranslations("tradingPost.filters")
  const tToolbar = useTranslations("tradingPost.toolbar")
  const tCatalog = useTranslations("catalog")
  const tSeason = useTranslations("singlePerfume.seasonVote.season")
  const tTraderPrefs = useTranslations("traderProfile.preferences")
  const tListingCondition = useTranslations("listing.condition")
  const tWishlistBottle = useTranslations("wishlist.bottlePreference")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState<PerfumeDiscoveryFilters>(
    emptyDiscoveryFilters()
  )
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

  const activeFilterCount = countDiscoveryFilters(discoveryFromUrl)
  const draftFilterCount = countDiscoveryFilters(draftFilters)

  const pushUrlFromSearchParams = useCallback(
    (nextSearch: URLSearchParams) => {
      const qs = nextSearch.toString()
      const newUrl = `${pathname}${qs ? `?${qs}` : ""}`
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

  const openFilters = useCallback(() => {
    setDraftFilters(discoveryFromUrl)
    setFiltersOpen(true)
  }, [discoveryFromUrl])

  const applyFilters = useCallback(() => {
    handleDiscoveryChange(draftFilters)
    setFiltersOpen(false)
  }, [draftFilters, handleDiscoveryChange])

  const clearDraftFilters = useCallback(() => {
    setDraftFilters(emptyDiscoveryFilters())
  }, [])

  useEffect(() => {
    const onExchangeRoute =
      pathname === ROUTE_PATH || pathname.endsWith(ROUTE_PATH)

    const onKeyDown = (e: KeyboardEvent) => {
      if (!onExchangeRoute || filtersOpen) return
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
    filtersOpen,
    discoveryFromUrl,
    cancelPending,
    handleDiscoveryChange,
    setLocalSearchValue,
  ])

  const handleProposeSwapFromCard = useCallback(
    async (
      perfume: (typeof availablePerfumes)[number],
      trigger: HTMLButtonElement | null
    ) => {
      if (!viewerId || perfume.offerCount <= 0) return

      const perfumeMeta = {
        perfumeId: perfume.id,
        perfumeName: perfume.name,
        perfumeHouse: perfume.perfumeHouse?.name,
        perfumeImage: perfume.image ?? null,
      }

      try {
        const page = await fetchExchangeOffersPage({
          perfumeId: perfume.id,
          filterQueryString,
        })
        const listings = page.offers
          .filter(o => o.userId !== viewerId)
          .map(offerDtoToUserPerfumeRow)
        if (listings.length === 0) return

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
      } catch (error) {
        console.error("[the-exchange] failed to load offers for CTA", error)
      }
    },
    [
      viewerId,
      filterQueryString,
      openComposer,
      openListingPicker,
      traderReputationByUserId,
    ]
  )

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

  const handleTradeShortcutChange = (
    tradePreferences: DiscoveryTradePreference[]
  ) => {
    handleDiscoveryChange({ ...discoveryFromUrl, tradePreferences })
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
    minRepTitle: tf("minRepTitle"),
    minRepDescription: tf("minRepDescription"),
    minRepLabel: tf("minRepLabel"),
    minRepAll: tf("minRepAll"),
    clearAll: tf("clearAll"),
  }

  const tradeShortcutOptions = DISCOVERY_TRADE_PREFERENCES.map(pref => ({
    value: pref,
    label:
      pref === "cash"
        ? tTraderPrefs("cash")
        : pref === "trade"
          ? tTraderPrefs("exchange")
          : tTraderPrefs("both"),
  }))

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
        priceChipRange: (min, max) => tf("priceChipRange", { min, max }),
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
        minRepLabel: score => tf("minRepChip", { score }),
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

      <PageWrapper className="space-y-6">
        {isEmptyExchange ? (
          <div className="mt-8 space-y-4 rounded-md border-2 border-noir-light bg-noir-gray/80 px-4 py-8 text-center">
            <h2 className="text-3xl font-black text-noir-light text-shadow-md text-shadow-noir-dark">
              {t("empty")}
            </h2>
            <p className="mx-auto max-w-lg text-noir-gold/90">{t("emptyHint")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <VooDooLink
                url={THE_ARCHIVE_PATH}
                variant="primary"
                background="gold"
              >
                {t("emptyBrowseArchive")}
              </VooDooLink>
              <VooDooLink url={THE_COLLECTORS_GUIDE_PATH} variant="secondary">
                {t("emptyCollectorsGuide")}
              </VooDooLink>
              <VooDooLink url={SIGN_IN_WITH_RETURN} variant="secondary">
                {t("emptySignIn")}
              </VooDooLink>
              <JoinLink placement="exchange-empty" />
            </div>
          </div>
        ) : (
          <>
            <OrnamentalFrame size="standard" className="bg-noir-black/40 p-3 md:p-4">
              <ExchangeDiscoveryToolbar
                searchId="exchange-search"
                searchInputRef={searchInputRef}
                searchValue={localSearchValue}
                onSearchChange={setLocalSearchValue}
                activeFilterCount={activeFilterCount}
                onOpenFilters={openFilters}
                labels={{
                  searchPlaceholder: t("search.placeholder"),
                  keyboardHint: t("search.keyboardHint"),
                  sort: tCatalog("toolbar.sort"),
                  sortNameAsc: tToolbar("sortNameAsc"),
                  filters: tCatalog("toolbar.filters"),
                  filtersAria: tCatalog("toolbar.filtersAria", {
                    count: activeFilterCount,
                  }),
                  view: tCatalog("toolbar.view"),
                  gridView: tCatalog("toolbar.gridView"),
                  listView: tCatalog("toolbar.listView"),
                  listViewUnavailable: tToolbar("listViewUnavailable"),
                }}
              />
            </OrnamentalFrame>

            <div className="space-y-3">
              <FilterToggleGroup
                options={tradeShortcutOptions}
                selected={discoveryFromUrl.tradePreferences}
                onChange={handleTradeShortcutChange}
                ariaLabel={tToolbar("tradeShortcutsAria")}
              />

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

              {(discoveryFiltersActive(discoveryFromUrl) ||
                Boolean(localSearchValue.trim())) && (
                <SaveSearchButton
                  name={`Exchange: ${(
                    localSearchValue.trim() ||
                    discoveryFromUrl.perfumeId ||
                    discoveryFromUrl.houseId ||
                    "filters"
                  )
                    .toString()
                    .slice(0, 60)}`}
                  query={{
                    q: localSearchValue.trim() || undefined,
                    houseId: discoveryFromUrl.houseId ?? undefined,
                    perfumeId: discoveryFromUrl.perfumeId ?? undefined,
                    noteIds: discoveryFromUrl.noteIds.length
                      ? discoveryFromUrl.noteIds
                      : undefined,
                    source: "exchange",
                    alertOnNewListing: true,
                    alertOnEditorial: false,
                  }}
                />
              )}
            </div>

            <OrnamentalFrame size="standard" className="bg-noir-black/30 p-3 md:p-4">
              {availablePerfumes.length === 0 ? (
                <div className="animate-fade-in rounded-md border-2 border-noir-gold bg-noir-dark/80 py-8 text-center">
                  <h2>{t("search.noResults")}</h2>
                  <p className="mt-2 text-noir-gold-100">
                    {t("search.tryDifferent")}
                  </p>
                  {activeFilterCount > 0 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-4"
                      onClick={() =>
                        handleDiscoveryChange(emptyDiscoveryFilters())
                      }
                    >
                      {tCatalog("clearFilters")}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul
                  ref={exchangeGridRef}
                  className={styleMerge(
                    "grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
                    availablePerfumes.length === 1 && "max-w-md",
                    availablePerfumes.length === 2 && "max-w-3xl"
                  )}
                >
                  {availablePerfumes.map((perfume, index) => (
                    <li
                      key={perfume.id}
                      data-exchange-card
                      className="relative min-w-0"
                    >
                      <ExchangeFragranceGroupCard
                        perfume={perfume}
                        viewerId={viewerId}
                        imagePriority={index < 3}
                        viewCollectorsLabel={tListings("viewCollectors")}
                        signInHref={SIGN_IN_WITH_RETURN}
                        signInLabel={t("signInToPropose")}
                        onViewCollectors={trigger =>
                          void handleProposeSwapFromCard(perfume, trigger)
                        }
                        openSplitSlot={
                          (openSplitChipsByPerfumeId[perfume.id]?.length ?? 0) >
                          0 ? (
                            <ExchangeOpenSplitChip
                              chips={openSplitChipsByPerfumeId[perfume.id]!}
                              label={tSplits("openSplitChip", {
                                count:
                                  openSplitChipsByPerfumeId[perfume.id]![0]!
                                    .openSlotCount,
                              })}
                            />
                          ) : null
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}

              {pagination.totalPages > 1 ? (
                <PaginationBar
                  className="pt-6"
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              ) : null}
            </OrnamentalFrame>

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
            {viewerId && mutualSwapSuggestions.length > 0 ? (
              <MutualSwapsSection suggestions={mutualSwapSuggestions} />
            ) : null}
            {viewerId && palateRecommendations.length > 0 ? (
              <PalateRecommendationsSection
                matches={palateRecommendations}
                viewerId={viewerId}
                traderReputationByUserId={traderReputationByUserId}
              />
            ) : null}
            {seasonalTrending.perfumes.length > 0 ? (
              <SeasonalTrendingSection
                season={seasonalTrending.season}
                perfumes={seasonalTrending.perfumes}
                variant="sidebar"
                className="rounded-md border border-noir-gold/40 bg-noir-gold/10 p-4"
              />
            ) : null}

            <AdSenseUnit showAds={showAds} variant="display" />

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

            <CatalogFilterDrawer
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              title={tf("toggle")}
              closeLabel={tCatalog("drawer.close")}
              clearLabel={tCatalog("drawer.clearAll")}
              applyLabel={tCatalog("drawer.apply", { count: draftFilterCount })}
              onClear={clearDraftFilters}
              onApply={applyFilters}
            >
              <DiscoveryFiltersPanel
                value={draftFilters}
                onChange={setDraftFilters}
                initialNoteTags={initialNoteTags}
                initialHouse={initialHouse}
                labels={filterLabels}
              />
            </CatalogFilterDrawer>
          </>
        )}
      </PageWrapper>
    </main>
  )
}

export default TheExchangeClient

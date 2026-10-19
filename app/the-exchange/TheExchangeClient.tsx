"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import dynamic from "next/dynamic"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import AdSenseUnit from "@/components/Atoms/AdSenseUnit"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { PaginationBar } from "@/components/Molecules/PaginationBar"
import { FilterChipStrip } from "@/components/Molecules/FilterChipStrip"
import { FilterToggleGroup } from "@/components/Molecules/FilterToggleGroup"
import { SaveSearchButton } from "@/components/Molecules/SaveSearchButton/SaveSearchButton"
import { ExchangeFragranceGroupCard } from "@/components/Molecules/ExchangeFragranceGroupCard"
import { ExchangeFragranceGroupRow } from "@/components/Molecules/ExchangeFragranceGroupRow/ExchangeFragranceGroupRow"
import { ExchangeOpenSplitChip } from "@/components/Molecules/ExchangeOpenSplitChip/ExchangeOpenSplitChip"
import { ExchangeResultsStatePanel } from "@/components/Molecules/ExchangeResultsStatePanel"
import {
  ExchangeDiscoveryToolbar,
  type ExchangeBrowseView,
} from "@/components/Containers/Exchange/ExchangeDiscoveryToolbar"
import MutualSwapsSection from "@/components/Containers/Exchange/MutualSwapsSection"
import PalateRecommendationsSection from "@/components/Containers/Exchange/PalateRecommendationsSection"
import SeasonalTrendingSection from "@/components/Containers/Exchange/SeasonalTrendingSection"
import WishlistMatchesSection from "@/components/Containers/Exchange/WishlistMatchesSection"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import Modal from "@/components/Organisms/Modal"
import CatalogFilterDrawer from "@/components/Organisms/CatalogFilterDrawer/CatalogFilterDrawer"
import { ExchangeCollectorsPanel } from "@/components/Organisms/ExchangeCollectorsPanel/ExchangeCollectorsPanel"
import TitleBanner from "@/components/Organisms/TitleBanner"
import {
  SIGN_IN,
  THE_ARCHIVE_PATH,
  THE_COLLECTORS_GUIDE_PATH,
} from "@/constants/routes"
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"
import { useExchangeOffers } from "@/hooks/useExchangeOffers"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useTradeComposerModal } from "@/hooks/useTradeComposerModal"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"
import { tradeListingSeedFromExchangeRow } from "@/types/trade"
import { TABLET_MEDIA } from "@/constants/breakpoints"
import { getTraderDisplayName } from "@/utils/user"
import type {
  ExchangePerfumeRow,
  ExchangeUserPerfumeRow,
} from "./exchange-types"
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
import {
  DEFAULT_EXCHANGE_GROUP_SORT,
  parseExchangeGroupSort,
  type ExchangeGroupSort,
} from "@/utils/exchange-constants"
import {
  exchangeCommittedFilterKey,
  resolveExchangeResultsMode,
} from "@/utils/exchange-results-state"
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
  sort: initialSort,
  filterQueryString,
  initialNoteTags,
  initialHouse,
  initialPerfume = null,
  wishlistMatches = [],
  palateRecommendations = [],
  mutualSwapSuggestions = [],
  seasonalTrending = { season: "spring", perfumes: [] },
  traderReputationByUserId = {},
  viewerId = null,
  openSplitChipsByPerfumeId = {},
  showAds = true,
  loadFailed = false,
  previewState = null,
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
  const [, startTransition] = useTransition()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterDrawerGeneration, setFilterDrawerGeneration] = useState(0)
  const [draftFilters, setDraftFilters] = useState<PerfumeDiscoveryFilters>(
    emptyDiscoveryFilters()
  )
  const [collectorsPerfumeId, setCollectorsPerfumeId] = useState<string | null>(
    null
  )
  const [listExpandedPerfumeId, setListExpandedPerfumeId] = useState<
    string | null
  >(null)
  const [contactBusyOfferId, setContactBusyOfferId] = useState<string | null>(
    null
  )
  const [removedOfferIds, setRemovedOfferIds] = useState<Set<string>>(
    () => new Set()
  )
  const collectorsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const exchangeGridRef = useRef<HTMLUListElement>(null)
  const isMdUp = useMediaQuery(TABLET_MEDIA)
  const {
    composerData,
    modalOpen: composerModalOpen,
    openComposer,
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

  const resultsView: ExchangeBrowseView =
    new URLSearchParams(searchParamsKey).get("view") === "list"
      ? "list"
      : "grid"

  const resultsSort: ExchangeGroupSort = parseExchangeGroupSort(
    new URLSearchParams(searchParamsKey).get("sort") ?? initialSort
  )

  const activeFilterCount = countDiscoveryFilters(discoveryFromUrl)
  const draftFilterCount = countDiscoveryFilters(draftFilters)

  const collectorsPerfume = useMemo(
    () =>
      collectorsPerfumeId
        ? (availablePerfumes.find(p => p.id === collectorsPerfumeId) ?? null)
        : null,
    [availablePerfumes, collectorsPerfumeId]
  )

  const listExpandedPerfume = useMemo(
    () =>
      listExpandedPerfumeId
        ? (availablePerfumes.find(p => p.id === listExpandedPerfumeId) ?? null)
        : null,
    [availablePerfumes, listExpandedPerfumeId]
  )

  const activeOffersPerfumeId =
    resultsView === "list" ? listExpandedPerfumeId : collectorsPerfumeId

  const offersQuery = useExchangeOffers({
    perfumeId: activeOffersPerfumeId,
    filterQueryString,
    enabled: Boolean(activeOffersPerfumeId),
  })

  useEffect(() => {
    setCollectorsPerfumeId(null)
    setListExpandedPerfumeId(null)
    collectorsTriggerRef.current = null
    setRemovedOfferIds(new Set())
    setContactBusyOfferId(null)
  }, [filterQueryString])

  useEffect(() => {
    if (resultsView === "list") {
      setCollectorsPerfumeId(null)
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
      collectorsPerfumeId &&
      !availablePerfumes.some(p => p.id === collectorsPerfumeId)
    ) {
      setCollectorsPerfumeId(null)
    }
    if (
      listExpandedPerfumeId &&
      !availablePerfumes.some(p => p.id === listExpandedPerfumeId)
    ) {
      setListExpandedPerfumeId(null)
    }
  }, [availablePerfumes, collectorsPerfumeId, listExpandedPerfumeId])

  const pushUrlFromSearchParams = useCallback(
    (nextSearch: URLSearchParams) => {
      const qs = nextSearch.toString()
      const newUrl = `${pathname}${qs ? `?${qs}` : ""}`
      const currentUrl = `${pathname}${searchParamsKey ? `?${searchParamsKey}` : ""}`
      if (newUrl !== currentUrl) {
        startTransition(() => {
          router.push(newUrl, { scroll: false })
        })
      }
    },
    [router, pathname, searchParamsKey, startTransition]
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

  /** Live commits (shortcuts / chips) keep an open drawer draft aligned. */
  const commitDiscovery = useCallback(
    (next: PerfumeDiscoveryFilters) => {
      handleDiscoveryChange(next)
      if (filtersOpen) {
        setDraftFilters(next)
      }
    },
    [handleDiscoveryChange, filtersOpen]
  )

  const openFilters = useCallback(() => {
    setDraftFilters(discoveryFromUrl)
    setFilterDrawerGeneration(g => g + 1)
    setFiltersOpen(true)
  }, [discoveryFromUrl])

  const closeFilters = useCallback(() => {
    setFiltersOpen(false)
  }, [])

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
      if (!onExchangeRoute || filtersOpen || collectorsPerfumeId) return
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
        if (hasFilters) commitDiscovery(emptyDiscoveryFilters())
        searchInputRef.current?.blur()
        return
      }

      if (!inField && hasFilters) {
        e.preventDefault()
        setLocalSearchValue("")
        cancelPending()
        commitDiscovery(emptyDiscoveryFilters())
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    pathname,
    filtersOpen,
    collectorsPerfumeId,
    discoveryFromUrl,
    cancelPending,
    commitDiscovery,
    setLocalSearchValue,
  ])

  const restoreCollectorsFocus = useCallback(() => {
    const trigger = collectorsTriggerRef.current
    collectorsTriggerRef.current = null
    requestAnimationFrame(() => {
      trigger?.focus()
    })
  }, [])

  const closeCollectorsPanel = useCallback(() => {
    setCollectorsPerfumeId(null)
    restoreCollectorsFocus()
  }, [restoreCollectorsFocus])

  const handleViewChange = useCallback(
    (nextView: ExchangeBrowseView) => {
      const nextSearch = new URLSearchParams(searchParams.toString())
      if (nextView === "list") nextSearch.set("view", "list")
      else nextSearch.delete("view")
      pushUrlFromSearchParams(nextSearch)
    },
    [searchParams, pushUrlFromSearchParams]
  )

  const handleSortChange = useCallback(
    (nextSort: ExchangeGroupSort) => {
      const nextSearch = new URLSearchParams(searchParams.toString())
      if (nextSort === DEFAULT_EXCHANGE_GROUP_SORT) nextSearch.delete("sort")
      else nextSearch.set("sort", nextSort)
      nextSearch.delete("pg")
      pushUrlFromSearchParams(nextSearch)
    },
    [searchParams, pushUrlFromSearchParams]
  )

  const handleOpenCollectors = useCallback(
    (perfume: ExchangePerfumeRow, trigger: HTMLButtonElement | null) => {
      collectorsTriggerRef.current = trigger
      if (resultsView === "list") {
        setListExpandedPerfumeId(prev =>
          prev === perfume.id ? null : perfume.id
        )
        return
      }
      setCollectorsPerfumeId(perfume.id)
    },
    [resultsView]
  )

  const handleContactOffer = useCallback(
    async (offer: ExchangeOfferDto) => {
      const perfume =
        resultsView === "list" ? listExpandedPerfume : collectorsPerfume
      if (!perfume || !viewerId || offer.userId === viewerId) return

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
              perfumeId: perfume.id,
              perfumeName: perfume.name,
              perfumeHouse: perfume.perfumeHouse?.name,
              perfumeImage: perfume.image ?? null,
            }),
            counterpartyDisplayName: getTraderDisplayName(up.user),
          },
          collectorsTriggerRef.current
        )
      } finally {
        setContactBusyOfferId(null)
      }
    },
    [
      resultsView,
      listExpandedPerfume,
      collectorsPerfume,
      viewerId,
      openComposer,
      offersQuery,
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
    commitDiscovery({ ...discoveryFromUrl, tradePreferences })
  }

  const totalCount = pagination.totalCount ?? availablePerfumes.length
  const pageOfferCount = availablePerfumes.reduce(
    (sum, perfume) => sum + perfume.offerCount,
    0
  )
  const rangeFrom =
    totalCount === 0
      ? 0
      : (pagination.currentPage - 1) * pagination.pageSize + 1
  const rangeTo =
    totalCount === 0
      ? 0
      : Math.min(
          (pagination.currentPage - 1) * pagination.pageSize +
            availablePerfumes.length,
          totalCount
        )
  const committedHasCriteria =
    discoveryFiltersActive(discoveryFromUrl) || Boolean(searchQuery.trim())

  const pendingFilterKey = useMemo(
    () => exchangeCommittedFilterKey(new URLSearchParams(searchParamsKey)),
    [searchParamsKey]
  )
  // Only criteria/search mismatch makes results stale — not view/pg URL toggles
  // (those share the same committed filter key and would flash a false “updating” state).
  const resultsAreStale =
    !previewState && pendingFilterKey !== filterQueryString

  const resultsMode = resolveExchangeResultsMode({
    loadFailed,
    isStale: resultsAreStale,
    pageItemCount: availablePerfumes.length,
    totalCount,
    hasActiveCriteria: committedHasCriteria,
    previewState,
  })

  const handleRetryLoad = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router, startTransition])

  const filterLabels = {
    notesTitle: tf("notesTitle"),
    notesDescription: tf("notesDescription"),
    notesSearchLabel: tf("notesSearchLabel"),
    notesSearchPlaceholder: tf("notesSearchPlaceholder"),
    notesEmptyLabel: tf("notesEmptyLabel"),
    notesSearching: tCatalog("filters.searching"),
    notesNoMatches: tCatalog("filters.noMatches"),
    notesSearchError: tCatalog("filters.searchError"),
    seasonTitle: tf("seasonTitle"),
    seasonDescription: tf("seasonDescription"),
    houseTitle: tf("houseTitle"),
    houseSearchLabel: tf("houseSearchLabel"),
    houseClear: tf("houseClear"),
    houseSearching: tCatalog("filters.searching"),
    houseNoMatches: tCatalog("filters.noMatches"),
    houseSearchError: tCatalog("filters.searchError"),
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
      apply: commitDiscovery,
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
    commitDiscovery,
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
        {resultsMode !== "failure" ? (
          <span className="block max-w-max rounded-md uppercase font-semibold text-noir-gold-500 mx-auto">
            {totalCount} {t("count")}
          </span>
        ) : null}
      </TitleBanner>

      <PageWrapper className="space-y-6">
        <>
            <OrnamentalFrame size="standard" className="bg-noir-black/40 p-3 md:p-4">
              <ExchangeDiscoveryToolbar
                searchId="exchange-search"
                searchInputRef={searchInputRef}
                searchValue={localSearchValue}
                onSearchChange={setLocalSearchValue}
                activeFilterCount={activeFilterCount}
                onOpenFilters={openFilters}
                sort={resultsSort}
                onSortChange={handleSortChange}
                view={resultsView}
                onViewChange={handleViewChange}
                labels={{
                  searchPlaceholder: t("search.placeholder"),
                  keyboardHint: t("search.keyboardHint"),
                  sort: tCatalog("toolbar.sort"),
                  sortNameAsc: tToolbar("sortNameAsc"),
                  sortNameDesc: tToolbar("sortNameDesc"),
                  sortOffersNewest: tToolbar("sortOffersNewest"),
                  filters: tCatalog("toolbar.filters"),
                  filtersAria: tCatalog("toolbar.filtersAria", {
                    count: activeFilterCount,
                  }),
                  view: tCatalog("toolbar.view"),
                  gridView: tCatalog("toolbar.gridView"),
                  listView: tCatalog("toolbar.listView"),
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
                    commitDiscovery(emptyDiscoveryFilters())
                  }
                  clearAllLabel={tf("clearAll")}
                  variant="dark"
                  className="rounded-md border border-noir-light/40 bg-noir-gray/40 p-3"
                />
              ) : null}

              {(resultsMode === "zero-matches" ||
                discoveryFiltersActive(discoveryFromUrl) ||
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
              {resultsMode === "results" || resultsMode === "stale" ? (
                <div className="mb-4 flex flex-col gap-1 text-sm text-noir-gold/80 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {pagination.totalPages <= 1
                      ? tListings("resultsMeta", {
                          fragrances: totalCount,
                          offers: pageOfferCount,
                        })
                      : tListings("resultsFragranceCount", {
                          count: totalCount,
                        })}
                  </p>
                  {availablePerfumes.length > 0 ? (
                    <p>
                      {tListings("resultsRange", {
                        from: rangeFrom,
                        to: rangeTo,
                        total: totalCount,
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {resultsMode === "failure" ? (
                <ExchangeResultsStatePanel
                  mode="failure"
                  title={t("states.loadFailedTitle")}
                  description={t("states.loadFailedDescription")}
                  retryLabel={t("states.retry")}
                  onRetry={handleRetryLoad}
                />
              ) : null}

              {resultsMode === "stale" ? (
                <div className="space-y-4">
                  <ExchangeResultsStatePanel
                    mode="stale"
                    title={t("states.updatingTitle")}
                    description={t("states.updatingDescription")}
                    staleLabel={t("states.staleLabel")}
                    hideIllustration
                  />
                  {availablePerfumes.length > 0 ? (
                    <ul
                      ref={exchangeGridRef}
                      aria-busy="true"
                      className={styleMerge(
                        "pointer-events-none opacity-50",
                        resultsView === "list"
                          ? "flex flex-col gap-3"
                          : "grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
                      )}
                    >
                      {availablePerfumes.map((perfume, index) => (
                        <li
                          key={perfume.id}
                          data-exchange-card
                          className="relative min-w-0"
                        >
                          {resultsView === "list" ? (
                            <ExchangeFragranceGroupRow
                              perfume={perfume}
                              expanded={false}
                              onToggle={() => undefined}
                              offers={[]}
                              status="idle"
                              errorMessage={null}
                              hasMore={false}
                              loadingMore={false}
                              viewerId={viewerId}
                              signInHref={SIGN_IN_WITH_RETURN}
                              onContact={() => undefined}
                              onRetry={() => undefined}
                              onLoadMore={() => undefined}
                            />
                          ) : (
                            <ExchangeFragranceGroupCard
                              perfume={perfume}
                              imagePriority={index < 3}
                              viewCollectorsLabel={tListings("viewCollectors")}
                              onViewCollectors={() => undefined}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {resultsMode === "zero-matches" ? (
                <ExchangeResultsStatePanel
                  mode="zero-matches"
                  title={t("states.zeroMatchesTitle")}
                  description={t("states.zeroMatchesDescription")}
                  showClearFilters={
                    activeFilterCount > 0 || Boolean(searchQuery.trim())
                  }
                  clearLabel={tCatalog("clearFilters")}
                  onClearFilters={() =>
                    commitDiscovery(emptyDiscoveryFilters())
                  }
                />
              ) : null}

              {resultsMode === "no-inventory" ? (
                <ExchangeResultsStatePanel
                  mode="no-inventory"
                  title={t("states.noInventoryTitle")}
                  description={t("states.noInventoryDescription")}
                  browseArchiveHref={THE_ARCHIVE_PATH}
                  browseArchiveLabel={t("emptyBrowseArchive")}
                  collectorsGuideHref={THE_COLLECTORS_GUIDE_PATH}
                  collectorsGuideLabel={t("emptyCollectorsGuide")}
                  signInHref={SIGN_IN_WITH_RETURN}
                  signInLabel={t("emptySignIn")}
                  showJoinLink
                />
              ) : null}

              {resultsMode === "results" ? (
                <ul
                  ref={exchangeGridRef}
                  className={
                    resultsView === "list"
                      ? "flex flex-col gap-3"
                      : "grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
                  }
                >
                  {availablePerfumes.map((perfume, index) => {
                    const openSplitSlot =
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

                    return (
                      <li
                        key={perfume.id}
                        data-exchange-card
                        className="relative min-w-0"
                      >
                        {resultsView === "list" ? (
                          <ExchangeFragranceGroupRow
                            perfume={perfume}
                            expanded={listExpandedPerfumeId === perfume.id}
                            onToggle={trigger =>
                              handleOpenCollectors(perfume, trigger)
                            }
                            offers={
                              listExpandedPerfumeId === perfume.id
                                ? offersQuery.offers
                                : []
                            }
                            status={
                              listExpandedPerfumeId === perfume.id
                                ? offersQuery.status
                                : "idle"
                            }
                            errorMessage={
                              listExpandedPerfumeId === perfume.id
                                ? offersQuery.errorMessage
                                : null
                            }
                            hasMore={
                              listExpandedPerfumeId === perfume.id
                                ? offersQuery.hasMore
                                : false
                            }
                            loadingMore={
                              listExpandedPerfumeId === perfume.id
                                ? offersQuery.loadingMore
                                : false
                            }
                            viewerId={viewerId}
                            signInHref={SIGN_IN_WITH_RETURN}
                            removedOfferIds={removedOfferIds}
                            contactBusyOfferId={contactBusyOfferId}
                            onContact={offer => void handleContactOffer(offer)}
                            onRetry={() => void offersQuery.reload()}
                            onLoadMore={() => void offersQuery.loadMore()}
                            openSplitSlot={openSplitSlot}
                          />
                        ) : (
                          <ExchangeFragranceGroupCard
                            perfume={perfume}
                            imagePriority={index < 3}
                            viewCollectorsLabel={tListings("viewCollectors")}
                            onViewCollectors={trigger =>
                              handleOpenCollectors(perfume, trigger)
                            }
                            openSplitSlot={openSplitSlot}
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : null}

              {(resultsMode === "results" || resultsMode === "stale") &&
              pagination.totalPages > 1 ? (
                <PaginationBar
                  className="border-t border-noir-gold/20 pt-6 mt-6"
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              ) : null}
            </OrnamentalFrame>

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

            {collectorsPerfume && resultsView === "grid" ? (
              <ExchangeCollectorsPanel
                open
                onClose={closeCollectorsPanel}
                title={tListings("collectorsTitle", {
                  name: collectorsPerfume.name,
                })}
                closeLabel={tListings("collectorsClose")}
                perfumeName={collectorsPerfume.name}
                perfumeImage={collectorsPerfume.image}
                offers={offersQuery.offers}
                status={offersQuery.status}
                errorMessage={offersQuery.errorMessage}
                hasMore={offersQuery.hasMore}
                loadingMore={offersQuery.loadingMore}
                viewerId={viewerId}
                signInHref={SIGN_IN_WITH_RETURN}
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
              onClose={closeFilters}
              title={tf("toggle")}
              closeLabel={tCatalog("drawer.close")}
              clearLabel={tCatalog("drawer.clearAll")}
              applyLabel={tCatalog("drawer.apply", { count: draftFilterCount })}
              onClear={clearDraftFilters}
              onApply={applyFilters}
              mobileHeight="nearlyFull"
            >
              <DiscoveryFiltersPanel
                key={filterDrawerGeneration}
                value={draftFilters}
                onChange={setDraftFilters}
                initialNoteTags={initialNoteTags}
                initialHouse={initialHouse}
                labels={filterLabels}
              />
            </CatalogFilterDrawer>
        </>
      </PageWrapper>
    </main>
  )
}

export default TheExchangeClient

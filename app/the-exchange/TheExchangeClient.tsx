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
import LinkCard from "@/components/Organisms/LinkCard"
import Modal from "@/components/Organisms/Modal"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"
import useMediaQuery from "@/hooks/useMediaQuery"
import { useSessionStore } from "@/hooks/sessionStore"
import {
  discoveryFiltersActive,
  discoveryFiltersToSearchParams,
  emptyDiscoveryFilters,
  parseDiscoveryFiltersFromSearchParams,
  type PerfumeDiscoveryFilters,
} from "@/utils/discovery-filters"
import { buildExchangeDiscoveryChipItems } from "./buildExchangeDiscoveryChipItems"
import ExchangeTradersModalContent from "./ExchangeTradersModalContent"
import type { ExchangePageData } from "./exchange-types"

export type { ExchangePageData } from "./exchange-types"

const ROUTE_PATH = "/the-exchange"
const BANNER_IMAGE = "/images/exchange.webp"
const DESKTOP_MEDIA = "(min-width: 1024px)"
const EXCHANGE_TRADERS_MODAL_ID = "exchange-traders"

const TheExchangeClient = ({
  availablePerfumes,
  pagination,
  searchQuery,
  initialNoteTags,
  initialHouse,
  traderReputationByUserId = {},
}: ExchangePageData) => {
  const t = useTranslations("tradingPost")
  const tListings = useTranslations("tradingPost.listings")
  const tf = useTranslations("tradingPost.filters")
  const tSeason = useTranslations("singlePerfume.seasonVote.season")
  const router = useTransitionRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isLg = useMediaQuery(DESKTOP_MEDIA)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const exchangeTradersTriggerRef = useRef<HTMLButtonElement | null>(null)
  const { modalOpen, modalId, modalData, toggleModal, closeModal } =
    useSessionStore()

  useEffect(() => {
    return () => {
      if (useSessionStore.getState().modalId === EXCHANGE_TRADERS_MODAL_ID) {
        closeModal()
      }
    }
  }, [closeModal])

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

  const exchangeModalPerfume = useMemo(() => {
    if (!modalOpen || modalId !== EXCHANGE_TRADERS_MODAL_ID) return null
    const rawId = modalData?.perfumeId
    const perfumeId = typeof rawId === "string" ? rawId : null
    if (!perfumeId) return null
    return availablePerfumes.find(p => p.id === perfumeId) ?? null
  }, [modalOpen, modalId, modalData, availablePerfumes])

  const openExchangeTradersModal = useCallback(
    (perfumeId: string, trigger: HTMLButtonElement | null) => {
      exchangeTradersTriggerRef.current = trigger
      toggleModal(exchangeTradersTriggerRef, EXCHANGE_TRADERS_MODAL_ID, {
        perfumeId,
      })
    },
    [toggleModal]
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

    return buildExchangeDiscoveryChipItems(discoveryFromUrl, {
      noteTags: initialNoteTags,
      houseLabel,
      apply: handleDiscoveryChange,
      seasonLabel: key => tSeason(key),
      copy: {
        removeFilterAria: label => tf("removeFilterAria", { label }),
        unknownNote: tf("unknownNote"),
        priceChipMin: min => tf("priceChipMin", { min }),
        priceChipMax: max => tf("priceChipMax", { max }),
        priceChipRange: (min, max) =>
          tf("priceChipRange", { min, max }),
      },
    })
  }, [
    discoveryFromUrl,
    handleDiscoveryChange,
    initialHouse,
    initialNoteTags,
    tSeason,
    tf,
  ])

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <span className="block max-w-max rounded-md uppercase font-semibold text-noir-gold-500 mx-auto">
          {totalCount} {t("count")}
        </span>
      </TitleBanner>

      {isEmptyExchange ? (
        <div className="text-center py-8 bg-noir-gray/80 rounded-md mt-8 border-2 border-noir-light">
          <h2 className="text-noir-light font-black text-3xl text-shadow-md text-shadow-noir-dark">
            {t("empty")}
          </h2>
        </div>
      ) : (
        <>
          <div className="inner-container py-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,300px)_1fr] lg:items-start">
              {isLg ? (
                <aside
                  className="min-w-0 lg:sticky lg:top-4"
                  aria-label={tf("toggle")}
                >
                  {filterPanel}
                </aside>
              ) : (
                <details
                  className="min-w-0 rounded-md border border-noir-light bg-noir-gray/80"
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
                    value={localSearchValue}
                    onChange={setLocalSearchValue}
                    placeholder={t("search.placeholder")}
                  />
                </div>
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
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 auto-rows-fr animate-fade-in">
                    {availablePerfumes.map((perfume, index) => (
                      <li
                        key={perfume.id}
                        className="relative animate-fade-in-item"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <LinkCard
                          data={{
                            ...perfume,
                            image: perfume.image ?? undefined,
                            perfumeHouse: perfume.perfumeHouse
                              ? { name: perfume.perfumeHouse.name }
                              : undefined,
                          }}
                          type="perfume"
                        >
                          <div className="mt-2 rounded-md space-y-2">
                            <p className="text-sm font-medium text-noir-gold">
                              {tListings("summary", {
                                count: perfume.userPerfume.length,
                              })}
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              background="gold"
                              className="w-full max-w-full"
                              onClick={e =>
                                openExchangeTradersModal(
                                  perfume.id,
                                  e.currentTarget
                                )
                              }
                            >
                              {tListings("openButton")}
                            </Button>
                          </div>
                        </LinkCard>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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

          {modalOpen &&
            modalId === EXCHANGE_TRADERS_MODAL_ID &&
            exchangeModalPerfume && (
              <Modal innerType="dark" animateStart="panelLeft">
                <div
                  role="dialog"
                  aria-modal
                  aria-labelledby="exchange-traders-modal-title"
                  className="min-h-0 flex-1"
                >
                  <ExchangeTradersModalContent
                    perfume={exchangeModalPerfume}
                    traderReputationByUserId={traderReputationByUserId}
                  />
                </div>
              </Modal>
            )}
        </>
      )}
    </section>
  )
}

export default TheExchangeClient

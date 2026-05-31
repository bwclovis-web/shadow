"use client"

import { type ChangeEvent, useCallback, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button, VooDooLink } from "@/components/Atoms/Button"
import VooDooDetails from "@/components/Atoms/VooDooDetails"
import { PaginationBar } from "@/components/Molecules/PaginationBar"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import { TradeStatusCard } from "@/components/Molecules/TradeStatusCard"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import { useDataWithFilters } from "@/hooks/useDataWithFilters"
import { useResponsivePageSize } from "@/hooks/useMediaQuery"
import {
  filterTrades,
  getOtherTraderName,
  TRADE_DATE_FILTERS,
} from "@/lib/my-trades-filters"
import type { TradeForClient } from "@/types/trade"

type TradesPageClientProps = {
  activeTrades: TradeForClient[]
  historyTrades: TradeForClient[]
  bannerImage: string
  userSlug: string
  userId: string
}

const dateInputClassName =
  "w-full min-w-[9rem] bg-noir-black/90 px-2 py-2 text-noir-gold-100 border border-noir-gold rounded-sm font-semibold outline-none focus:outline-none focus:ring-2 focus:ring-noir-gold/50 focus:bg-noir-dark"

const dateLabelClassName =
  "font-semibold text-lg mb-1 capitalize text-noir-gold text-shadow-lg text-shadow-noir-black/60 tracking-wide"

const TradesPageClient = ({
  activeTrades,
  historyTrades,
  bannerImage,
  userSlug,
  userId,
}: TradesPageClientProps) => {
  const t = useTranslations("myTrades")
  const router = useRouter()
  const searchParams = useSearchParams()
  const pageSize = useResponsivePageSize()
  const basePath = `/${userSlug}/profile/trades`

  const {
    filteredData: filteredHistory,
    searchQuery,
    setSearchQuery,
    customFilterValues,
    setCustomFilterValue,
    resetFilters,
  } = useDataWithFilters({
    items: historyTrades,
    nameAccessor: (trade) => getOtherTraderName(trade, userId),
    dateAccessor: (trade) => trade.createdAt,
    customFilters: TRADE_DATE_FILTERS,
    syncToUrl: true,
  })

  const filteredActive = useMemo(
    () => filterTrades(activeTrades, userId, searchQuery, customFilterValues),
    [activeTrades, userId, searchQuery, customFilterValues]
  )

  const hasAny = activeTrades.length > 0 || historyTrades.length > 0
  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(customFilterValues.dateFrom) ||
    Boolean(customFilterValues.dateTo)

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize))
  const rawPage = Math.max(1, parseInt(searchParams.get("pg") ?? "1", 10) || 1)
  const currentPage = totalPages > 0 ? Math.min(rawPage, totalPages) : 1

  const paginatedHistory = useMemo(
    () =>
      filteredHistory.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      ),
    [filteredHistory, currentPage, pageSize]
  )

  useEffect(() => {
    if (totalPages >= 1 && rawPage > totalPages) {
      const next = new URLSearchParams(searchParams.toString())
      next.set("pg", String(totalPages))
      router.replace(`${basePath}?${next.toString()}`, { scroll: false })
    }
  }, [totalPages, rawPage, basePath, router, searchParams])

  const handlePageChange = useCallback(
    (page: number) => {
      const next = new URLSearchParams(searchParams.toString())
      if (page <= 1) next.delete("pg")
      else next.set("pg", String(page))
      const qs = next.toString()
      router.push(`${basePath}${qs ? `?${qs}` : ""}`, { scroll: false })
    },
    [basePath, router, searchParams]
  )

  const handleDateFromChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      setCustomFilterValue("dateFrom", evt.target.value)
    },
    [setCustomFilterValue]
  )

  const handleDateToChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      setCustomFilterValue("dateTo", evt.target.value)
    },
    [setCustomFilterValue]
  )

  const showActiveSection = activeTrades.length > 0
  const showHistorySection = historyTrades.length > 0

  return (
    <main id="main-content">
      <TitleBanner
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <VooDooLink
          url={`/${userSlug}/profile`}
          variant="link"
          size="sm"
          prefetch
          transitionVariant="detail-to-list"
        >
          {t("backToProfile")}
        </VooDooLink>
      </TitleBanner>

      <PageWrapper>
        {!hasAny ? (
          <h2 className="text-center text-noir-gold-100">{t("empty")}</h2>
        ) : (
          <div className="mx-auto flex flex-col gap-4">
            <div className="noir-border flex w-full flex-col gap-4 border-b border-t border-noir-gold p-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
              <div className="w-full md:max-w-md">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t("filters.collectorPlaceholder")}
                />
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col items-start">
                  <label htmlFor="my-trades-date-from" className={dateLabelClassName}>
                    {t("filters.dateFrom")}
                  </label>
                  <input
                    id="my-trades-date-from"
                    type="date"
                    value={customFilterValues.dateFrom || ""}
                    onChange={handleDateFromChange}
                    className={dateInputClassName}
                  />
                </div>
                <div className="flex flex-col items-start">
                  <label htmlFor="my-trades-date-to" className={dateLabelClassName}>
                    {t("filters.dateTo")}
                  </label>
                  <input
                    id="my-trades-date-to"
                    type="date"
                    value={customFilterValues.dateTo || ""}
                    onChange={handleDateToChange}
                    className={dateInputClassName}
                  />
                </div>

                {hasActiveFilters ? (
                  <Button onClick={resetFilters} variant="secondary" size="sm">
                    {t("filters.clearAll")}
                  </Button>
                ) : null}
              </div>
            </div>

            {showActiveSection ? (
              <VooDooDetails
                name="myActiveTrades"
                summary={t("activeSummary", { count: filteredActive.length })}
                className="text-noir-gold"
                background="dark"
                defaultOpen
              >
                <div className="space-y-3 py-2">
                  {filteredActive.length > 0 ? (
                    filteredActive.map((trade) => (
                      <TradeStatusCard
                        key={trade.id}
                        trade={trade}
                        currentUserId={userId}
                      />
                    ))
                  ) : (
                    <p className="text-noir-gold-100">{t("noActiveFilterMatches")}</p>
                  )}
                </div>
              </VooDooDetails>
            ) : null}

            {showHistorySection ? (
              <VooDooDetails
                name="myTradeHistory"
                summary={t("historySummary", { count: filteredHistory.length })}
                className="text-noir-gold"
                background="dark"
                defaultOpen={hasActiveFilters || currentPage > 1}
              >
                <div className="space-y-6 py-4">
                  {filteredHistory.length > 0 ? (
                    paginatedHistory.map((trade) => (
                      <TradeStatusCard
                        key={trade.id}
                        trade={trade}
                        currentUserId={userId}
                        readOnly
                      />
                    ))
                  ) : (
                    <p className="text-noir-gold-100">{t("noFilterMatches")}</p>
                  )}

                  <PaginationBar
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              </VooDooDetails>
            ) : null}
          </div>
        )}
      </PageWrapper>
    </main>
  )
}

export default TradesPageClient

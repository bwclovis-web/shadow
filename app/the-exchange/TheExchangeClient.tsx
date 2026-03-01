"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import LinkCard from "@/components/Organisms/LinkCard"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import { getUserDisplayName } from "@/utils/user"

const ROUTE_PATH = "/the-exchange"
const BANNER_IMAGE = "/images/exchange.webp"

type PaginationMeta = {
  totalCount: number
  pageSize: number
  currentPage: number
  totalPages: number
  hasMore: boolean
  hasNextPage: boolean
  hasPrevPage: boolean
}

export type ExchangePageData = {
  availablePerfumes: Array<{
    id: string
    name: string
    slug: string
    image?: string | null
    perfumeHouse?: { id: string; name: string; slug: string; type: string } | null
    userPerfume: Array<{
      id: string
      userId: string
      available: string
      type: string | null
      tradePreference: string | null
      user: {
        id: string
        firstName: string | null
        lastName: string | null
        username: string | null
        email: string | null
      }
    }>
  }>
  pagination: PaginationMeta
  searchQuery: string
}

const TheExchangeClient = ({
  availablePerfumes,
  pagination,
  searchQuery,
}: ExchangePageData) => {
  const t = useTranslations("tradingPost")
  const tPrefs = useTranslations("traderProfile.preferences")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [localSearchValue, setLocalSearchValue] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getTradePreferenceLabel = (preference: string | null | undefined) => {
    switch (preference) {
      case "cash":
        return tPrefs("cash")
      case "trade":
        return tPrefs("trade")
      case "both":
        return tPrefs("both")
      default:
        return tPrefs("cash")
    }
  }

  useEffect(() => {
    setLocalSearchValue(searchQuery)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [searchQuery])

  const handleSearchChange = (value: string) => {
    setLocalSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const nextSearch = new URLSearchParams(searchParams.toString())
      if (value.trim()) nextSearch.set("q", value.trim())
      else nextSearch.delete("q")
      nextSearch.delete("pg")
      const qs = nextSearch.toString()
      router.push(`${ROUTE_PATH}${qs ? `?${qs}` : ""}`, { scroll: false })
    }, 300)
  }

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    []
  )

  const handlePageChange = (page: number) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const nextSearch = new URLSearchParams(searchParams.toString())
    if (localSearchValue.trim()) nextSearch.set("q", localSearchValue.trim())
    else nextSearch.delete("q")
    if (page > 1) nextSearch.set("pg", page.toString())
    else nextSearch.delete("pg")
    const qs = nextSearch.toString()
    router.push(`${ROUTE_PATH}${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  const handleNextPage = () => {
    if (pagination.hasNextPage) handlePageChange(pagination.currentPage + 1)
  }

  const handlePrevPage = () => {
    if (pagination.hasPrevPage) handlePageChange(pagination.currentPage - 1)
  }

  const totalCount = pagination.totalCount ?? availablePerfumes.length
  const isEmptyExchange = totalCount === 0 && !searchQuery

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
            <div className="max-w-md mx-auto mb-6">
              <SearchInput
                value={localSearchValue}
                onChange={handleSearchChange}
                placeholder={t("search.placeholder")}
              />
            </div>
            {availablePerfumes.length === 0 ? (
              <div className="text-center py-8 bg-noir-gray/80 rounded-md border-2 border-noir-light animate-fade-in">
                <h2 className="text-noir-light font-black text-xl text-shadow-md text-shadow-noir-dark">
                  {t("search.noResults")}
                </h2>
                <p className="text-noir-gold-100 mt-2">{t("search.tryDifferent")}</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr animate-fade-in">
                {availablePerfumes.map((perfume, index) => (
                  <li
                    key={perfume.id}
                    className="relative animate-fade-in-item"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <LinkCard data={{ ...perfume, image: perfume.image ?? undefined, perfumeHouse: perfume.perfumeHouse ? { name: perfume.perfumeHouse.name } : undefined }} type="perfume">
                      <div className="mt-2 rounded-md">
                        <p className="text-base font-medium text-noir-gold mb-1">
                          {t("availableFrom")}:
                        </p>
                        {perfume.userPerfume.map((userPerfume) => (
                          <div key={userPerfume.id} className="mb-1">
                            <Link
                              href={`/trader/${userPerfume.userId}`}
                              className="text-sm font-semibold text-blue-300 hover:text-noir-blue underline"
                            >
                              {getUserDisplayName(userPerfume.user)}:
                            </Link>
                            <span className="text-sm ml-2 text-noir-gold-100">
                              {getPerfumeTypeLabel(userPerfume.type ?? undefined) || "Unknown Type"}{" "}
                              {userPerfume.available} ml
                            </span>
                            {userPerfume.tradePreference && (
                              <span className="text-sm ml-2 text-noir-gold-500 font-medium">
                                • {getTradePreferenceLabel(userPerfume.tradePreference !== null ? userPerfume.tradePreference : undefined)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </LinkCard>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 py-6">
              {pagination.hasPrevPage && (
                <Button onClick={handlePrevPage} variant="secondary" size="sm">
                  Previous
                </Button>
              )}
              <span className="text-noir-gold/80">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              {pagination.hasNextPage && (
                <Button onClick={handleNextPage} variant="secondary" size="sm">
                  Next
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default TheExchangeClient

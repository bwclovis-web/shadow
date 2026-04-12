"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { GiTrade } from "react-icons/gi"

import { selectVariants, selectWrapperVariants } from "@/components/Atoms/Select/select-variants"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { useSessionStore } from "@/hooks/sessionStore"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import type { TraderReputationV1 } from "@/services/reputation/types"
import {
  getExchangeListingTradeDisplay,
  type ExchangeListingTradePreference,
} from "@/utils/exchangeListingTradeDisplay"
import { styleMerge } from "@/utils/styleUtils"
import { getTraderDisplayName } from "@/utils/user"

import type { ExchangePerfumeRow, ExchangeUserPerfumeRow } from "./exchange-types"

type ExchangeTradersModalContentProps = {
  perfume: ExchangePerfumeRow
  traderReputationByUserId: Record<string, TraderReputationV1>
}

type PreferenceFilter = "all" | ExchangeListingTradePreference

type SortMode = "default" | "priceDesc" | "scoreDesc"

const parseMoney = (s: string | null | undefined): number | null => {
  const n = Number.parseFloat(String(s ?? "").trim())
  return Number.isFinite(n) ? n : null
}

const listingPriceSortValue = (up: ExchangeUserPerfumeRow): number | null => {
  const p = parseMoney(up.price)
  const t = parseMoney(up.tradePrice)
  if (p != null && t != null) return Math.max(p, t)
  return p ?? t ?? null
}

const ExchangeTradersModalContent = ({
  perfume,
  traderReputationByUserId,
}: ExchangeTradersModalContentProps) => {
  const closeModal = useSessionStore(s => s.closeModal)
  const t = useTranslations("tradingPost.listings")
  const tProfile = useTranslations("traderProfile")
  const tRep = useTranslations("traderProfile.reputation")

  const preferenceSelectId = useId()
  const sortSelectId = useId()

  const [preferenceFilter, setPreferenceFilter] =
    useState<PreferenceFilter>("all")
  const [sortBy, setSortBy] = useState<SortMode>("default")

  useEffect(() => {
    setPreferenceFilter("all")
    setSortBy("default")
  }, [perfume.id])

  const displayedRows = useMemo(() => {
    const filtered = perfume.userPerfume.filter(up => {
      if (preferenceFilter === "all") return true
      const { preference } = getExchangeListingTradeDisplay({
        tradePreference: up.tradePreference,
        tradeOnly: up.tradeOnly,
        price: up.price,
        tradePrice: up.tradePrice,
      })
      return preference === preferenceFilter
    })

    if (sortBy === "default") return filtered

    const copy = [...filtered]
    if (sortBy === "priceDesc") {
      copy.sort((a, b) => {
        const va = listingPriceSortValue(a)
        const vb = listingPriceSortValue(b)
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        return vb - va
      })
      return copy
    }

    copy.sort((a, b) => {
      const sa = traderReputationByUserId[a.userId]?.score
      const sb = traderReputationByUserId[b.userId]?.score
      if (sa == null && sb == null) return 0
      if (sa == null) return 1
      if (sb == null) return -1
      return sb - sa
    })
    return copy
  }, [
    perfume.userPerfume,
    preferenceFilter,
    sortBy,
    traderReputationByUserId,
  ])

  const selectShell = styleMerge(
    selectWrapperVariants({ size: "compact" }),
    "w-full min-w-0 flex-1 bg-transparent pr-0 max-w-none"
  )
  const selectClass = styleMerge(
    selectVariants({ size: "compact" }),
    "w-full min-w-0 bg-noir-dark/60 text-sm text-noir-gold-100"
  )

  return (
    <div className="flex min-h-0 flex-col gap-4 pt-2">
      <div className="border-b border-noir-gold/30 pb-3">
        <h2 id="exchange-traders-modal-title">
          {t("title", { name: perfume.name })}
        </h2>
        {perfume.perfumeHouse?.name ? (
          <p className="text-sm text-noir-gold-100">
            {perfume.perfumeHouse.name}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-noir-gold-500">
          {t("traderCount", { count: displayedRows.length })}
        </p>
      </div>

      <div className="flex flex-col gap-3 border-b border-noir-gold/30 pb-3 sm:flex-row sm:items-end sm:gap-4">
        <div className={selectShell}>
          <label
            className="mb-1 block text-sm text-noir-gold-500"
            htmlFor={preferenceSelectId}
          >
            {t("filterPreferenceLabel")}
          </label>
          <select
            id={preferenceSelectId}
            value={preferenceFilter}
            onChange={e =>
              setPreferenceFilter(e.target.value as PreferenceFilter)
            }
            className={selectClass}
          >
            <option value="all" className="bg-noir-dark">
              {t("filterPreferenceAll")}
            </option>
            <option value="cash" className="bg-noir-dark">
              {tProfile("preferences.cash")}
            </option>
            <option value="trade" className="bg-noir-dark">
              {tProfile("preferences.trade")}
            </option>
            <option value="both" className="bg-noir-dark">
              {tProfile("preferences.both")}
            </option>
          </select>
        </div>
        <div className={selectShell}>
          <label
            className="mb-1 block text-sm text-noir-gold-500"
            htmlFor={sortSelectId}
          >
            {t("sortLabel")}
          </label>
          <select
            id={sortSelectId}
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortMode)}
            className={selectClass}
          >
            <option value="default" className="bg-noir-dark">
              {t("sortDefault")}
            </option>
            <option value="priceDesc" className="bg-noir-dark">
              {t("sortPriceHighLow")}
            </option>
            <option value="scoreDesc" className="bg-noir-dark">
              {t("sortScoreHighLow")}
            </option>
          </select>
        </div>
      </div>

      {displayedRows.length === 0 ? (
        <p className="text-sm text-noir-gold-500">{t("noTradersMatchFilter")}</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6">
          {displayedRows.map(up => {
            const { preference, showPrice, showTradePrice } =
              getExchangeListingTradeDisplay({
                tradePreference: up.tradePreference,
                tradeOnly: up.tradeOnly,
                price: up.price,
                tradePrice: up.tradePrice,
              })
            const rep = traderReputationByUserId[up.userId]
            const typeLabel =
              getPerfumeTypeLabel(up.type ?? undefined) || t("unknownType")

            const prefLabel = (() => {
              switch (preference) {
                case "cash":
                  return tProfile("preferences.cash")
                case "trade":
                  return tProfile("preferences.trade")
                case "both":
                  return tProfile("preferences.both")
                default:
                  return tProfile("preferences.cash")
              }
            })()

            return (
              <li
                key={up.id}
                className="noir-border bg-noir-dark/40 p-3 text-sm text-noir-gold-100"
              >
                <PrefetchLink
                  href={`/trader-profile/${up.userId}`}
                  prefetch={false}
                  className="text-base font-semibold text-noir-blue underline decoration-noir-gold/40 hover:text-noir-gold-100"
                  onClick={() => {
                    closeModal()
                  }}
                >
                  {getTraderDisplayName(up.user)}
                </PrefetchLink>
                {rep?.score != null ? (
                  <span className="ml-2 text-noir-gold-500">
                    ({tRep("exchangeTrust", { score: rep.score })})
                  </span>
                ) : null}
                <p className="mt-2 text-noir-gold-100">
                  <span className="text-noir-gold-500">{tProfile("amount")}:</span>{" "}
                  <span className="font-medium text-noir-gold-100">
                    {up.available} ml · {typeLabel}
                  </span>
                </p>
                {showPrice && up.price ? (
                  <p className="mt-1">
                    <span className="text-noir-gold-500">
                      {tProfile("price")}:
                    </span>{" "}
                    <span className="text-noir-gold-100">${up.price}/ml</span>
                  </p>
                ) : null}
                {showTradePrice && up.tradePrice ? (
                  <p className="mt-1">
                    <span className="text-noir-gold-500">
                      {tProfile("tradePrice")}:
                    </span>{" "}
                    <span className="text-noir-gold-100">
                      ${up.tradePrice}/ml
                    </span>
                  </p>
                ) : null}
                <p className="mt-1">
                  <span className="text-noir-gold-500">
                    {tProfile("preference")}:
                  </span>{" "}
                  <span className="text-noir-gold-100">{prefLabel}</span>
                </p>
                {up.tradeOnly ? (
                  <div className="mt-2 flex items-center gap-2 font-medium text-noir-gold-500">
                    <GiTrade size={18} className="shrink-0 fill-noir-gold-100" />
                    <span>{tProfile("tradeOnly")}</span>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default ExchangeTradersModalContent

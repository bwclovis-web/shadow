"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { useTranslations } from "next-intl"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import { selectVariants, selectWrapperVariants } from "@/components/Atoms/Select/select-variants"
import { ExchangeListingRow } from "@/components/Molecules/ExchangeListingRow"
import type { TraderReputationV1 } from "@/services/reputation/types"
import {
  getExchangeListingTradeDisplay,
  type ExchangeListingTradePreference,
} from "@/utils/exchangeListingTradeDisplay"
import { styleMerge } from "@/utils/styleUtils"

type PreferenceFilter = "all" | ExchangeListingTradePreference
type SortMode = "default" | "priceDesc" | "scoreDesc"

const listingPriceSortValue = (up: ExchangeUserPerfumeRow): number | null => {
  const p = Number.parseFloat(String(up.price ?? "").trim())
  const t = Number.parseFloat(String(up.tradePrice ?? "").trim())
  if (Number.isFinite(p) && Number.isFinite(t)) return Math.max(p, t)
  if (Number.isFinite(p)) return p
  if (Number.isFinite(t)) return t
  return null
}

export type ExchangeListingPickerProps = {
  listings: ExchangeUserPerfumeRow[]
  traderReputationByUserId?: Record<string, TraderReputationV1>
  listResetKey?: string
  onSelectListing: (row: ExchangeUserPerfumeRow) => void
  /** Called before navigating to a trader profile (closes parent modal). */
  onViewProfileClick?: () => void
  showMakeOffer?: boolean
  listClassName?: string
}

export const ExchangeListingPicker = ({
  listings,
  traderReputationByUserId = {},
  listResetKey,
  onSelectListing,
  onViewProfileClick,
  showMakeOffer = true,
  listClassName = "flex max-h-[50vh] flex-col gap-3 overflow-y-auto",
}: ExchangeListingPickerProps) => {
  const t = useTranslations("tradingPost.listings")
  const tProfile = useTranslations("traderProfile")

  const preferenceSelectId = useId()
  const sortSelectId = useId()

  const [preferenceFilter, setPreferenceFilter] = useState<PreferenceFilter>("all")
  const [sortBy, setSortBy] = useState<SortMode>("default")

  useEffect(() => {
    setPreferenceFilter("all")
    setSortBy("default")
  }, [listResetKey])

  const displayedRows = useMemo(() => {
    const filtered = listings.filter(up => {
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
  }, [listings, preferenceFilter, sortBy, traderReputationByUserId])

  const selectShell = styleMerge(
    selectWrapperVariants({ size: "compact" }),
    "w-full min-w-0 flex-1 bg-transparent pr-0 max-w-none"
  )
  const selectClass = styleMerge(
    selectVariants({ size: "compact" }),
    "w-full min-w-0 bg-noir-dark/60 text-sm text-noir-gold-100"
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className={selectShell}>
          <label
            className="mb-1 block text-sm text-noir-gold-500"
            htmlFor={preferenceSelectId}
          >
            {t("filterPreferenceLabel")}
          </label>
          <select
            id={preferenceSelectId}
            key={`pref-${listResetKey ?? "default"}`}
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
            key={`sort-${listResetKey ?? "default"}`}
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
        <ul className={listClassName}>
          {displayedRows.map(up => (
            <ExchangeListingRow
              key={up.id}
              listing={up}
              reputation={traderReputationByUserId[up.userId]}
              showProfileLink
              showMakeOffer={showMakeOffer}
              onViewProfileClick={onViewProfileClick}
              onMakeOffer={() => onSelectListing(up)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

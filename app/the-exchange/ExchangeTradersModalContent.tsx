"use client"

import { useTranslations } from "next-intl"
import { GiTrade } from "react-icons/gi"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { useSessionStore } from "@/hooks/sessionStore"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import type { TraderReputationV1 } from "@/services/reputation/types"
import { getExchangeListingTradeDisplay } from "@/utils/exchangeListingTradeDisplay"
import { getTraderDisplayName } from "@/utils/user"

import type { ExchangePerfumeRow } from "./exchange-types"

type ExchangeTradersModalContentProps = {
  perfume: ExchangePerfumeRow
  traderReputationByUserId: Record<string, TraderReputationV1>
}

const ExchangeTradersModalContent = ({
  perfume,
  traderReputationByUserId,
}: ExchangeTradersModalContentProps) => {
  const closeModal = useSessionStore(s => s.closeModal)
  const t = useTranslations("tradingPost.listings")
  const tProfile = useTranslations("traderProfile")
  const tRep = useTranslations("traderProfile.reputation")

  return (
    <div className="flex min-h-0 flex-col gap-4 pr-10 pt-2">
      <div className="border-b border-noir-gold/30 pb-3">
        <h2
          id="exchange-traders-modal-title"
          className="text-xl font-bold text-noir-gold"
        >
          {t("title", { name: perfume.name })}
        </h2>
        {perfume.perfumeHouse?.name ? (
          <p className="text-sm text-noir-gold-100">{perfume.perfumeHouse.name}</p>
        ) : null}
        <p className="mt-2 text-sm text-noir-gold-500">
          {t("traderCount", { count: perfume.userPerfume.length })}
        </p>
      </div>
      <ul className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6">
        {perfume.userPerfume.map(up => {
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
                  <span className="text-noir-gold-500">{tProfile("price")}:</span>{" "}
                  <span className="text-noir-gold-100">${up.price}/ml</span>
                </p>
              ) : null}
              {showTradePrice && up.tradePrice ? (
                <p className="mt-1">
                  <span className="text-noir-gold-500">
                    {tProfile("tradePrice")}:
                  </span>{" "}
                  <span className="text-noir-gold-100">${up.tradePrice}/ml</span>
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
    </div>
  )
}

export default ExchangeTradersModalContent

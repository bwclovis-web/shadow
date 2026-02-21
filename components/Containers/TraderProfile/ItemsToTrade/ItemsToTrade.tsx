import { useTranslations } from "next-intl"
import { GiTrade } from "react-icons/gi"

import VooDooDetails from "~/components/Atoms/VooDooDetails"
import type { UserPerfumeI } from "~/types"
import ContactItemButton from "~/components/Containers/TraderProfile/ContactItemButton"

import TradersComments from "./TradersComments"

const getTradeLabel = (t: ReturnType<typeof useTranslations>, preference: string) => {
  switch (preference) {
    case "cash":
      return t("preferences.cash")
    case "trade":
      return t("preferences.trade")
    case "both":
      return t("preferences.both")
    default:
      return t("preferences.cash")
  }
}

// Header component for perfume info
const PerfumeHeader = ({ userPerfume }: { userPerfume: UserPerfumeI }) => (
  <>
    <div className="font-semibold text-xl text-noir-gold">
      {userPerfume.perfume?.name || "Unknown Perfume"}
    </div>
    <div className="text-sm text-noir-gold-100">
      by {userPerfume.perfume?.perfumeHouse?.name}
    </div>
  </>
)

const PriceInfo = ({ userPerfume, t }: { userPerfume: UserPerfumeI; t: ReturnType<typeof useTranslations> }) => {
  return (
    <p className="text-md text-noir-gold-100 mt-4">
      {t("amount")}:{" "}
      <span className="text-noir-gold-500">{userPerfume.available || "0"}ml</span>
    </p>
  )
}

// Helper component for trade information
const TradeInfo = ({ userPerfume, t }: { userPerfume: UserPerfumeI; t: ReturnType<typeof useTranslations> }) => {
  const tradePreference = userPerfume.tradePreference || "cash"
  // Don't show price if tradeOnly is true
  const showPrice = !userPerfume.tradeOnly && (tradePreference === "cash" || tradePreference === "both") && userPerfume.price
  const showTradePrice = !userPerfume.tradeOnly && userPerfume.tradePrice
  
  return (
    <div className="text-sm text-noir-gold-300 space-y-1">
      {showPrice && (
        <p className="font-medium text-noir-gold-100">
          {t("price")}:
          <span className="text-noir-gold-500"> ${userPerfume.price}/ml</span>
        </p>
      )}
      {showTradePrice && (
        <p className="font-medium text-noir-gold-100">
          {t("tradePrice")}:
          <span className="text-noir-gold-500"> ${userPerfume.tradePrice}/ml</span>
        </p>
      )}
      <p className="text-noir-gold-100">
        {t("preference")}:
        <span className="text-noir-gold-500">
          {" "}
          {getTradeLabel(t, tradePreference)}
        </span>
      </p>
      {userPerfume.tradeOnly && (
        <div className="text-gold-noir font-medium flex gap-2 items-center">
          <GiTrade size={20} className="fill-noir-gold-100" />{" "}
          <span className="text-noir-gold-500">{t("tradeOnly")}</span>
        </div>
      )}
    </div>
  )
}

// Comments component
const CommentsSection = ({ userPerfume, t }: { userPerfume: UserPerfumeI; t: ReturnType<typeof useTranslations> }) => {
  const publicComments =
    userPerfume?.comments?.filter(comment => comment.isPublic) || []

  return (
    <>
      {publicComments.length > 0 ? (
        <VooDooDetails
          name="comments"
          summary={`${t("comments")} (${publicComments.length})`}
          className="text-noir-gold mt-2"
        >
          <TradersComments comments={publicComments} />
        </VooDooDetails>
      ) : (
        <div className="mt-2 text-xs text-noir-gold-500 italic">
          {t("noPublicComments")}
        </div>
      )}
    </>
  )
}

interface ItemsToTradeProps {
  userPerfume: UserPerfumeI
  trader?: {
    id: string
    firstName?: string | null
    lastName?: string | null
    username?: string | null
    email?: string
  }
  viewerId?: string | null
}

const ItemsToTrade = ({ userPerfume, trader, viewerId }: ItemsToTradeProps) => {
  const t = useTranslations("traderProfile")
  return (
  <li
    key={userPerfume.id}
    className="mb-4 border bg-noir-gold/20 border-noir-gold rounded p-2"
  >
    <PerfumeHeader userPerfume={userPerfume} />
    <PriceInfo userPerfume={userPerfume} t={t} />
    <TradeInfo userPerfume={userPerfume} t={t} />
    <CommentsSection userPerfume={userPerfume} t={t} />
    {trader && (
      <ContactItemButton
        traderId={trader.id}
        trader={trader}
        userPerfume={userPerfume}
        viewerId={viewerId}
      />
    )}
  </li>
  )
}

export default ItemsToTrade

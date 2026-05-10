"use client"

import { useTranslations } from "next-intl"

import TitleBanner from "@/components/Organisms/TitleBanner"
import VooDooDetails from "@/components/Atoms/VooDooDetails"
import {
  ItemsSearchingFor,
  ItemsToTrade,
} from "@/components/Containers/TraderProfile"
import { useTrader } from "@/hooks/useTrader"
import type { TraderResponse } from "@/lib/queries/user"
import type { TraderFeedbackResponse } from "@/lib/queries/traderFeedback"
import type { SafeUser, UserPerfumeI } from "@/types"
import { getTraderDisplayName } from "@/utils/user"
import { TraderProfileAside } from "./aside/aside"
import { useMediaQuery } from "@/hooks/useMediaQuery"
const DESKTOP_MEDIA = "(min-width: 1024px)"

const BANNER_IMAGE = "/images/trade.webp"

type TraderProfileClientProps = {
  initialTrader: TraderResponse
  viewer: SafeUser | null
  feedback: TraderFeedbackResponse
}

export default function TraderProfileClient({
  initialTrader,
  viewer,
  feedback,
}: TraderProfileClientProps) {
  const { data: trader } = useTrader(initialTrader.id, initialTrader)
  const t = useTranslations("traderProfile")
  const isLgView = useMediaQuery(DESKTOP_MEDIA)
  if (!trader) {
    return (
      <div className="p-4">
        Trader not found
      </div>
    )
  }

  const traderName = getTraderDisplayName(trader)

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading", { traderName })}
        subheading={t("subheading", { traderName })}
      />

      <div className="inner-container grid grid-cols-1 items-start gap-8 p-6 md:grid-cols-2 xl:grid-cols-3">
        {isLgView ? (
          <TraderProfileAside trader={trader} viewer={viewer} feedback={feedback} />
        ) : (
            <VooDooDetails type="primary" name="traderProfileAside" summary={t("traderProfileAside", { traderName })} background="dark" defaultOpen={false}>
              <div className="py-4">
                <TraderProfileAside trader={trader} viewer={viewer} feedback={feedback} />
              </div>
            </VooDooDetails>
        )}

        <div className="flex flex-col gap-4 md:col-span-2 xl:col-span-2">
          <div className="noir-border relative p-4">
            <h2 className="mb-2 text-center">
              {t("itemsAvailable")}
            </h2>
            <VooDooDetails
              type="primary"
              name="itemsAvailable"
              summary={t("itemsAvailableSummary", { traderName })}
              background="dark"
              defaultOpen={false}
            >
              {trader.UserPerfume?.length ? (
                <ul className="mt-6">
                  {trader.UserPerfume.map((up) => (
                    <ItemsToTrade
                      key={up.id}
                      userPerfume={{ ...up, userId: trader.id } as UserPerfumeI}
                      trader={trader}
                      viewerId={viewer?.id}
                    />
                  ))}
                </ul>
              ) : (
                <p>{t("noItemsAvailable")}</p>
              )}
            </VooDooDetails>
          </div>

          <div className="noir-border relative w-full p-4">
            <h2 className="mb-2 text-center">
              {t("itemsSearchingFor")}
            </h2>
            <VooDooDetails
              type="primary"
              name="itemsSearchingFor"
              summary={t("itemsSummary", { traderName })}
              background="dark"
              defaultOpen={false}
            >
              <ItemsSearchingFor
                wishlistItems={(trader.UserPerfumeWishlist ?? []).map((item) => ({
                  id: item.id,
                  perfumeId: item.perfumeId,
                  isPublic: item.isPublic,
                  bottlePreference: item.bottlePreference,
                  createdAt: item.createdAt,
                  user: {
                    id: trader.id,
                    firstName: trader.firstName ?? "",
                    lastName: trader.lastName ?? "",
                    username: trader.username ?? "",
                    email: trader.email,
                  },
                  perfume: item.perfume,
                }))}
              />
            </VooDooDetails>
          </div>
        </div>
      </div>
    </section>
  )
}

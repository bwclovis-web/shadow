"use client"

import { useTranslations } from "next-intl"

import { TradeComposerModal } from "@/components/Containers/Trade/TradeComposerModal"
import TraderActionButton from "@/components/Containers/TraderProfile/TraderActionButton"
import { tradeComposerModalId } from "@/constants/modalIds"
import { getTradeCtaLabelKey, tradeListingSeedFromUserPerfumeI } from "@/types/trade"
import type { UserPerfumeI } from "@/types"

type ProposeTradeButtonProps = {
  traderId: string
  trader: {
    id: string
    firstName?: string | null
    lastName?: string | null
    username?: string | null
    email?: string
  }
  userPerfume: UserPerfumeI
  viewerId?: string | null
}

const ProposeTradeButton = ({
  traderId,
  trader,
  userPerfume,
  viewerId,
}: ProposeTradeButtonProps) => {
  const t = useTranslations("tradeComposer")

  const seed = tradeListingSeedFromUserPerfumeI(userPerfume, traderId)
  const itemModalId = tradeComposerModalId(userPerfume.id)
  const ctaKey = getTradeCtaLabelKey(userPerfume.tradePreference, userPerfume.tradeOnly)

  return (
    <TraderActionButton
      traderId={traderId}
      trader={trader}
      viewerId={viewerId}
      label={t(ctaKey)}
      modalId={itemModalId}
      size="sm"
      className="mt-2 w-full max-w-max"
      onBeforeOpen={traderName => ({
        mode: "compose",
        init: { seed, counterpartyDisplayName: traderName },
      })}
      renderModal={({ traderName, closeModal }) => (
        <TradeComposerModal
          data={{
            mode: "compose",
            init: { seed, counterpartyDisplayName: traderName },
          }}
          onClose={closeModal}
          onViewProfileClick={closeModal}
        />
      )}
    />
  )
}

export default ProposeTradeButton

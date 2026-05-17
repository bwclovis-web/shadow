"use client"

import { useCallback, useRef } from "react"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import {
  TRADE_COMPOSER_PICKER_MODAL_ID,
  tradeComposerModalId,
} from "@/constants/modalIds"
import { useSessionStore } from "@/hooks/sessionStore"
import type { TraderReputationV1 } from "@/services/reputation/types"
import type { TradeComposerInit, TradeListingSeed } from "@/types/trade"

export type TradeComposerModalData =
  | { mode: "compose"; init: TradeComposerInit }
  | {
      mode: "pick"
      listingsToPick: ExchangeUserPerfumeRow[]
      perfumeMeta: {
        perfumeId: string
        perfumeName: string
        perfumeHouse?: string
        perfumeImage?: string | null
      }
      traderReputationByUserId?: Record<string, TraderReputationV1>
    }

export const useTradeComposerModal = () => {
  const { modalOpen, modalId, modalData, toggleModal, closeModal } = useSessionStore()
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const openComposer = useCallback(
    (init: TradeComposerInit, trigger?: HTMLButtonElement | null) => {
      if (trigger) triggerRef.current = trigger
      toggleModal(triggerRef, tradeComposerModalId(init.seed.userPerfumeId), {
        mode: "compose",
        init,
      } satisfies TradeComposerModalData)
    },
    [toggleModal]
  )

  const openListingPicker = useCallback(
    (
      listingsToPick: ExchangeUserPerfumeRow[],
      perfumeMeta: {
        perfumeId: string
        perfumeName: string
        perfumeHouse?: string
        perfumeImage?: string | null
      },
      options?: {
        trigger?: HTMLButtonElement | null
        traderReputationByUserId?: Record<string, TraderReputationV1>
      }
    ) => {
      const trigger = options?.trigger
      if (trigger) triggerRef.current = trigger
      toggleModal(triggerRef, TRADE_COMPOSER_PICKER_MODAL_ID, {
        mode: "pick",
        listingsToPick,
        perfumeMeta,
        traderReputationByUserId: options?.traderReputationByUserId,
      } satisfies TradeComposerModalData)
    },
    [toggleModal]
  )

  const isComposerOpen =
    modalOpen &&
    (modalId === TRADE_COMPOSER_PICKER_MODAL_ID ||
      (typeof modalId === "string" && modalId.startsWith("trade-composer-")))

  const composerData = isComposerOpen
    ? (modalData as TradeComposerModalData | null)
    : null

  return {
    triggerRef,
    modalOpen: isComposerOpen,
    modalId,
    composerData,
    openComposer,
    openListingPicker,
    closeComposer: closeModal,
  }
}

export type { TradeListingSeed }

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import FormField from "@/components/Atoms/FormField/FormField"
import TradeListingPreview from "@/components/Molecules/TradeListingPreview/TradeListingPreview"
import { TraderAvatar } from "@/components/Molecules/TraderAvatar"
import { useCSRF } from "@/hooks/useCSRF"
import type { TradeForClient, TradeListingSeed } from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"

type TradeStatusCardProps = {
  trade: TradeForClient
  currentUserId: string
  readOnly?: boolean
  onUpdated?: () => void
}

const lineItemToSeed = (
  trade: TradeForClient,
  lineItem: TradeForClient["lineItems"][number],
  ownerId: string
): TradeListingSeed => ({
  userPerfumeId: lineItem.userPerfumeId,
  counterpartyId: ownerId,
  perfumeName: lineItem.perfumeName,
  available: lineItem.mlSnapshot != null ? String(lineItem.mlSnapshot) : "0",
  mlRemaining: lineItem.mlSnapshot,
  condition: lineItem.conditionSnapshot,
})

const TradeStatusCard = ({
  trade,
  currentUserId,
  readOnly = false,
  onUpdated,
}: TradeStatusCardProps) => {
  const t = useTranslations("tradeStatus")
  const router = useRouter()
  const { prepareApiRequest } = useCSRF()
  const [trackingNumber, setTrackingNumber] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isInitiator = currentUserId === trade.initiatorId
  const isCounterparty = currentUserId === trade.counterpartyId
  const otherUser = isInitiator ? trade.counterparty : trade.initiator
  const otherName = getTraderDisplayName(otherUser)

  const ownerIdForLineItem = (li: TradeForClient["lineItems"][number]) =>
    li.role === "requested" ? trade.counterpartyId : trade.initiatorId

  const labelForListingOwner = (ownerId: string) =>
    ownerId === currentUserId ? t("youOffer") : t("theyOffer")

  const runTransition = async (action: string, body?: FormData) => {
    setLoading(true)
    setError(null)
    try {
      const formData = body ?? new FormData()
      const { formData: protectedFormData, headers } = prepareApiRequest(formData)
      const response = await fetch(`/api/trades/${trade.id}/${action}`, {
        method: "PATCH",
        headers,
        body: protectedFormData,
        credentials: "include",
      })
      const data = await response.json()
      if (!data.success) {
        setError(data.error ?? t("error"))
        return
      }
      onUpdated?.()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"))
    } finally {
      setLoading(false)
    }
  }

  const statusLabel = t(`status.${trade.status}` as "status.pending")

  return (
    <div className="noir-border mb-4 bg-noir-gold/10 p-4">
      <div className="mb-3 flex items-center gap-3">
        <TraderAvatar
          displayName={otherName}
          avatarImage={otherUser.avatarImage}
          size="sm"
        />
        <div>
          <p className="text-sm font-semibold text-noir-gold">{t("tradeWith", { name: otherName })}</p>
          <p className="text-xs uppercase tracking-wide text-noir-gold-500">{statusLabel}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {trade.lineItems.map(li => {
          const ownerId = ownerIdForLineItem(li)
          return (
            <div key={li.id}>
              <p className="mb-1 text-xs text-noir-gold-500">
                {labelForListingOwner(ownerId)}
              </p>
              <TradeListingPreview
                seed={lineItemToSeed(trade, li, ownerId)}
                compact
              />
            </div>
          )
        })}
      </div>

      {trade.notes ? (
        <p className="mt-2 text-sm text-noir-gold-100">
          <span className="text-noir-gold-500">{t("notes")}: </span>
          {trade.notes}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-noir-gold-500">
        <Link
          href="/community-policy"
          className="text-noir-gold underline-offset-2 hover:text-noir-light hover:underline"
        >
          {t("communityPolicyLink")}
        </Link>
      </p>

      {error ? (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      ) : null}

      {!readOnly ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {trade.status === "pending" && isCounterparty ? (
            <>
              <Button
                type="button"
                size="sm"
                background="gold"
                disabled={loading}
                onClick={() => runTransition("accept")}
              >
                {t("accept")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={() => runTransition("decline")}
              >
                {t("decline")}
              </Button>
            </>
          ) : null}
          {trade.status === "accepted" && (isInitiator || isCounterparty) ? (
            <>
              <FormField label={t("trackingOptional")} className="w-full min-w-[200px]">
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  className="w-full rounded border border-noir-gold/40 bg-noir-dark px-2 py-1 text-sm text-noir-gold-100"
                  maxLength={200}
                />
              </FormField>
              <Button
                type="button"
                size="sm"
                background="gold"
                disabled={loading}
                onClick={() => {
                  const fd = new FormData()
                  if (trackingNumber.trim()) fd.set("trackingNumber", trackingNumber.trim())
                  runTransition("ship", fd)
                }}
              >
                {t("markShipped")}
              </Button>
            </>
          ) : null}
          {trade.status === "shipped" && (isInitiator || isCounterparty) ? (
            <Button
              type="button"
              size="sm"
              background="gold"
              disabled={loading}
              onClick={() => runTransition("receive")}
            >
              {t("confirmReceived")}
            </Button>
          ) : null}
          {trade.status === "received" && (isInitiator || isCounterparty) ? (
            <Button
              type="button"
              size="sm"
              background="gold"
              disabled={loading}
              onClick={() => runTransition("complete")}
            >
              {t("complete")}
            </Button>
          ) : null}
          {["draft", "pending", "accepted"].includes(trade.status) ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() => runTransition("cancel")}
            >
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default TradeStatusCard

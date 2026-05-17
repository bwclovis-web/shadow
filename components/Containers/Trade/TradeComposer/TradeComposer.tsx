"use client"

import { dispatchUserAlertsRefresh } from "@/components/Molecules/UserAlertsProvider/UserAlertsProvider"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "next-view-transitions"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import { Button } from "@/components/Atoms/Button/Button"
import FormField from "@/components/Atoms/FormField/FormField"
import { ExchangeListingPicker } from "@/components/Molecules/ExchangeListingPicker"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import TradeListingPreview from "@/components/Molecules/TradeListingPreview/TradeListingPreview"
import { useCSRF } from "@/hooks/useCSRF"
import type { TraderReputationV1 } from "@/services/reputation/types"
import type { TradeComposerInit, TradeListingSeed } from "@/types/trade"
import { isCashOnlyListing, tradeListingSeedFromExchangeRow } from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"

type OfferableListing = {
  id: string
  available: string
  perfume: {
    name: string
    image?: string | null
    perfumeHouse?: { name: string } | null
  }
  type?: string | null
  price?: string | null
  tradePrice?: string | null
  tradePreference?: string | null
  tradeOnly?: boolean
  images?: string[]
  condition?: TradeListingSeed["condition"]
}

type TradeComposerProps = {
  init: TradeComposerInit
  onSuccess?: () => void
  stayOnPage?: boolean
  pickListings?: ExchangeUserPerfumeRow[]
  pickPerfumeMeta?: {
    perfumeId: string
    perfumeName: string
    perfumeHouse?: string
    perfumeImage?: string | null
  }
  traderReputationByUserId?: Record<string, TraderReputationV1>
  onPickListing?: (seed: TradeListingSeed, init: TradeComposerInit) => void
}

const TradeComposer = ({
  init,
  onSuccess,
  stayOnPage = false,
  pickListings,
  pickPerfumeMeta,
  traderReputationByUserId,
  onPickListing,
}: TradeComposerProps) => {
  const t = useTranslations("tradeComposer")
  const router = useRouter()
  const { prepareApiRequest } = useCSRF()
  const [step, setStep] = useState<"pick" | "compose">(
    pickListings && pickPerfumeMeta ? "pick" : "compose"
  )
  const [activeInit, setActiveInit] = useState(init)
  const [offerable, setOfferable] = useState<OfferableListing[]>([])
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingListings, setLoadingListings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const cashOnly = isCashOnlyListing(
    activeInit.seed.tradePreference,
    activeInit.seed.tradeOnly
  )

  useEffect(() => {
    if (step !== "compose" || cashOnly) return
    setLoadingListings(true)
    fetch("/api/trades/mine", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.listings)) {
          setOfferable(data.listings)
        }
      })
      .finally(() => setLoadingListings(false))
  }, [step, cashOnly])

  const handlePick = (row: ExchangeUserPerfumeRow) => {
    if (!pickPerfumeMeta) return
    const seed = tradeListingSeedFromExchangeRow(row, pickPerfumeMeta)
    const nextInit: TradeComposerInit = {
      seed,
      counterpartyDisplayName: getTraderDisplayName(row.user),
    }
    if (onPickListing) {
      onPickListing(seed, nextInit)
    } else {
      setActiveInit(nextInit)
      setStep("compose")
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    const lineItems: { userPerfumeId: string; role: "offered" | "requested" }[] = [
      { userPerfumeId: activeInit.seed.userPerfumeId, role: "requested" },
    ]
    if (selectedOfferId) {
      lineItems.push({ userPerfumeId: selectedOfferId, role: "offered" })
    }

    const formData = new FormData()
    formData.set("counterpartyId", activeInit.seed.counterpartyId)
    if (notes.trim()) formData.set("notes", notes.trim())
    formData.set("lineItems", JSON.stringify(lineItems))
    formData.set("submit", "true")

    const { formData: protectedFormData, headers } = prepareApiRequest(formData)

    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers,
        body: protectedFormData,
        credentials: "include",
      })
      const data = await response.json()
      if (!data.success) {
        setError(data.error ?? t("error"))
        return
      }
      setSuccess(true)
      dispatchUserAlertsRefresh()
      onSuccess?.()
      if (!stayOnPage) {
        router.push(`/messages/${activeInit.seed.counterpartyId}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"))
    } finally {
      setLoading(false)
    }
  }

  if (step === "pick" && pickListings && pickPerfumeMeta) {
    return (
      <div className="space-y-4">
        <ExchangeListingPicker
          listings={pickListings}
          traderReputationByUserId={traderReputationByUserId}
          listResetKey={pickPerfumeMeta.perfumeId}
          onSelectListing={handlePick}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-noir-gold">{t("targetListing")}</p>
        <TradeListingPreview
          seed={activeInit.seed}
          traderName={activeInit.counterpartyDisplayName}
        />
      </div>

      {!cashOnly ? (
        <div>
        <p className="mb-2 text-sm font-medium text-noir-gold">{t("yourOffer")}</p>
        {loadingListings ? (
          <p className="text-sm text-noir-gold-500">{t("loadingListings")}</p>
        ) : offerable.length === 0 ? (
          <p className="text-sm text-noir-gold-500">{t("noOfferableListings")}</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {offerable.map(listing => (
              <li key={listing.id}>
                <label className="flex cursor-pointer items-start gap-2 noir-border bg-noir-dark/40 p-2">
                  <input
                    type="radio"
                    name="offeredListing"
                    checked={selectedOfferId === listing.id}
                    onChange={() => setSelectedOfferId(listing.id)}
                    className="mt-1"
                  />
                  <span className="text-sm text-noir-gold-100">
                    {listing.perfume.name}
                    {listing.perfume.perfumeHouse?.name
                      ? ` · ${listing.perfume.perfumeHouse.name}`
                      : ""}{" "}
                    ({listing.available} ml)
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-noir-gold-500">{t("offerOptional")}</p>
        </div>
      ) : null}

      <FormField
        label={t("notesLabel")}
        helpText={cashOnly ? t("notesHelpCash") : t("notesHelp")}
      >
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          className="block w-full rounded border border-noir-gold/40 bg-noir-dark px-3 py-2 text-sm text-noir-gold-100"
          placeholder={cashOnly ? t("notesPlaceholderCash") : t("notesPlaceholder")}
        />
      </FormField>

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-400">{t("success")}</p>
      ) : null}

      <CSRFToken />

      <div className="flex flex-wrap justify-end gap-2">
        {!stayOnPage && success ? (
          <Link
            href={`/messages/${activeInit.seed.counterpartyId}`}
            className="text-sm text-noir-blue underline"
          >
            {t("openMessages")}
          </Link>
        ) : null}
        <Button
          type="button"
          background="gold"
          disabled={loading || success}
          onClick={handleSubmit}
        >
          {loading ? t("submitting") : cashOnly ? t("submitConnect") : t("submitOffer")}
        </Button>
      </div>
    </div>
  )
}

export default TradeComposer

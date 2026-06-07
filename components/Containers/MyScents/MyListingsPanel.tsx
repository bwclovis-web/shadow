"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Link } from "next-view-transitions"

import { Button } from "@/components/Atoms/Button"
import ReviewStatusBadge from "@/components/Atoms/ReviewStatusBadge"
import type { UserPerfumeForClient } from "@/types/my-scents-client"
import { useCSRF } from "@/hooks/useCSRF"
import {
  getListingKind,
  getPausedListingKind,
  getResumeListingMl,
  isActiveListing,
  isPausedListing,
  parseMl,
} from "@/lib/user-inventory"
import { resolveListingApiError } from "@/lib/resolve-listing-api-error"
import { isCollectionItemInReview } from "@/lib/collection-review-status"
import { postDecantListingAmount } from "@/lib/user-perfume-listing-actions"
import { getPrimaryListingImage, tradePreferenceChipLabel } from "@/utils/listing-display"
import { normalizeRemoteImageSrc, validImageRegex } from "@/utils/styleUtils"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"

type ListingCardProps = {
  row: UserPerfumeForClient
  basePath: string
  variant: "active" | "paused"
  pausingId: string | null
  resumingId: string | null
  onPause: (row: UserPerfumeForClient) => void
  onResume: (row: UserPerfumeForClient) => void
}

const ListingCard = ({
  row,
  basePath,
  variant,
  pausingId,
  resumingId,
  onPause,
  onResume,
}: ListingCardProps) => {
  const t = useTranslations("myScents.listings")
  const tKind = useTranslations("myScents.listingKind")
  const tCondition = useTranslations("listing")
  const tDecant = useTranslations("listing.decantFormat")
  const { perfume } = row
  const isPaused = variant === "paused"
  const listedMl = isPaused ? getResumeListingMl(row) : parseMl(row.available)
  const kind = isPaused ? getPausedListingKind(row) : getListingKind(row)
  const thumb = normalizeRemoteImageSrc(
    getPrimaryListingImage({
      images: row.images ?? [],
      perfume: { image: perfume.image },
    })
  )
  const imageSrc =
    thumb && !validImageRegex.test(thumb) ? thumb : BOTTLE_PLACEHOLDER

  return (
    <li
      className={
        isPaused
          ? "noir-border flex flex-col gap-3 rounded-lg border border-dashed border-noir-gold/30 bg-noir-black/20 p-4 text-left opacity-90"
          : "noir-border flex flex-col gap-3 rounded-lg border border-noir-gold/40 bg-noir-black/30 p-4 text-left"
      }
    >
      <div className="flex gap-3">
        <Image
          src={imageSrc}
          alt={perfume.name ?? "Perfume"}
          width={80}
          height={80}
          className="h-20 w-20 shrink-0 rounded object-cover"
          sizes="80px"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-noir-gold">{perfume.name}</h3>
            {isCollectionItemInReview(row) && <ReviewStatusBadge />}
          </div>
          {perfume.perfumeHouse && (
            <p className="text-sm text-noir-gold-100">{perfume.perfumeHouse.name}</p>
          )}
          <p className="mt-1 text-sm text-noir-cream">
            {isPaused
              ? t("pausedMl", { ml: listedMl.toFixed(1) })
              : t("listedMl", { ml: listedMl.toFixed(1) })}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {kind && (
              <span className="rounded bg-noir-gold/20 px-2 py-0.5 text-xs text-noir-gold">
                {tKind(kind)}
              </span>
            )}
            {isPaused && (
              <span className="rounded bg-noir-gold/10 px-2 py-0.5 text-xs text-noir-gold-500">
                {t("pausedBadge")}
              </span>
            )}
            {row.condition && (
              <span className="rounded bg-noir-gold/10 px-2 py-0.5 text-xs text-noir-gold-100">
                {tCondition(`condition.${row.condition}`)}
              </span>
            )}
            {row.decantFormat && (
              <span className="rounded bg-noir-gold/10 px-2 py-0.5 text-xs text-noir-gold-100">
                {tDecant(row.decantFormat)}
              </span>
            )}
            <span className="rounded bg-noir-gold/10 px-2 py-0.5 text-xs text-noir-gold-100">
              {tradePreferenceChipLabel(row.tradePreference)}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Link
          href={`${basePath}/${row.id}#destash`}
          className="text-sm text-noir-gold underline hover:text-noir-gold-100"
        >
          {t("edit")}
        </Link>
        {isPaused ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={resumingId === row.id || listedMl <= 0}
            onClick={() => onResume(row)}
          >
            {resumingId === row.id ? t("resuming") : t("resume")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pausingId === row.id}
            onClick={() => onPause(row)}
          >
            {pausingId === row.id ? t("pausing") : t("pause")}
          </Button>
        )}
      </div>
    </li>
  )
}

type MyListingsPanelProps = {
  activeListings: UserPerfumeForClient[]
  pausedListings: UserPerfumeForClient[]
  basePath: string
  onListingChange: (updated: UserPerfumeForClient) => void
}

const MyListingsPanel = ({
  activeListings,
  pausedListings,
  basePath,
  onListingChange,
}: MyListingsPanelProps) => {
  const t = useTranslations("myScents.listings")
  const tListingErrors = useTranslations("listing.errors")
  const { addToFormData } = useCSRF()
  const [pausingId, setPausingId] = useState<string | null>(null)
  const [resumingId, setResumingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const applyListingFromApi = useCallback(
    (
      intended: UserPerfumeForClient,
      data: { success?: boolean; userPerfume?: Record<string, unknown>; error?: string }
    ) => {
      if (!data.success) return null

      if (!data.userPerfume) {
        onListingChange(intended)
        return null
      }

      const fromApi = { ...intended, ...(data.userPerfume as UserPerfumeForClient) }

      if (isPausedListing(intended) && isActiveListing(fromApi)) {
        onListingChange({
          ...fromApi,
          available: "0",
          pausedAvailable: intended.pausedAvailable ?? fromApi.pausedAvailable,
        })
        return null
      }

      if (isActiveListing(intended) && isPausedListing(fromApi)) {
        onListingChange({
          ...fromApi,
          available: intended.available,
          pausedAvailable: null,
        })
        return null
      }

      onListingChange(fromApi)
      return null
    },
    [onListingChange]
  )

  const handlePause = useCallback(
    async (row: UserPerfumeForClient) => {
      const pausedSnapshot = row.available ?? String(parseMl(row.available))
      const intended = { ...row, available: "0", pausedAvailable: pausedSnapshot }

      setActionError(null)
      onListingChange(intended)
      setPausingId(row.id)
      try {
        const data = await postDecantListingAmount(
          { userPerfumeId: row.id, perfumeId: row.perfumeId, amount: "0" },
          addToFormData
        )
        if (data.success) {
          applyListingFromApi(intended, data)
        } else {
          setActionError(
            resolveListingApiError(data, tListingErrors) ?? t("pauseFailed")
          )
          onListingChange(row)
        }
      } catch (err) {
        console.error("Failed to pause listing:", err)
        setActionError(t("pauseFailed"))
        onListingChange(row)
      } finally {
        setPausingId(null)
      }
    },
    [addToFormData, applyListingFromApi, onListingChange, t, tListingErrors]
  )

  const handleResume = useCallback(
    async (row: UserPerfumeForClient) => {
      const resumeMl = getResumeListingMl(row)
      if (resumeMl <= 0) return

      const amount = row.pausedAvailable ?? String(resumeMl)
      const intended = { ...row, available: amount, pausedAvailable: null }

      setActionError(null)
      onListingChange(intended)
      setResumingId(row.id)
      try {
        const data = await postDecantListingAmount(
          {
            userPerfumeId: row.id,
            perfumeId: row.perfumeId,
            amount,
            resumePaused: true,
          },
          addToFormData
        )
        if (data.success) {
          const fromApi = data.userPerfume as UserPerfumeForClient | undefined
          onListingChange(
            fromApi
              ? { ...fromApi, available: amount, pausedAvailable: null }
              : intended
          )
        } else {
          setActionError(
            resolveListingApiError(data, tListingErrors) ?? t("resumeFailed")
          )
          onListingChange(row)
        }
      } catch (err) {
        console.error("Failed to resume listing:", err)
        setActionError(t("resumeFailed"))
        onListingChange(row)
      } finally {
        setResumingId(null)
      }
    },
    [addToFormData, onListingChange, t, tListingErrors]
  )

  if (activeListings.length === 0 && pausedListings.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg text-noir-gold-100">{t("empty.heading")}</p>
        <p className="mt-2 text-sm italic text-noir-gold-500">{t("empty.subheading")}</p>
        <Link
          href={`${basePath}?view=inventory`}
          className="mt-4 inline-block text-noir-gold underline hover:text-noir-gold-100"
        >
          {t("empty.cta")}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {actionError && (
        <p className="rounded border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">
          {actionError}
        </p>
      )}
      {activeListings.length > 0 && (
        <section>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeListings.map((row) => (
              <ListingCard
                key={row.id}
                row={row}
                basePath={basePath}
                variant="active"
                pausingId={pausingId}
                resumingId={resumingId}
                onPause={handlePause}
                onResume={handleResume}
              />
            ))}
          </ul>
        </section>
      )}
      {pausedListings.length > 0 && (
        <section>
          <h2 className="mb-3 text-center">{t("pausedHeading")}</h2>
          <p className="mb-4 text-center text-sm text-noir-gold-500">{t("pausedSubheading")}</p>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {pausedListings.map((row) => (
              <ListingCard
                key={row.id}
                row={row}
                basePath={basePath}
                variant="paused"
                pausingId={pausingId}
                resumingId={resumingId}
                onPause={handlePause}
                onResume={handleResume}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default MyListingsPanel

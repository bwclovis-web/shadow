"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import { useCSRF } from "@/hooks/useCSRF"
import { useDecantSplitBudget } from "@/hooks/useDecantSplitBudget"
import {
  DECANT_SPLIT_MAX_SLOT_COUNT,
  DECANT_SPLIT_MIN_SLOT_COUNT,
  formatSplitMlDisplay,
  isBudgetConflictErrorCode,
  releaseSubmitLock,
  remainingAfterProposed,
  roundMl,
  splitWizardBudgetStatus,
  tryAcquireSubmitLock,
  validateSplitWizardDraft,
  validateSplitWizardStep1,
  validateSplitWizardStep2,
  type SplitWizardValidationReason,
} from "@/lib/decant-split-wizard"
import { resolveListingApiError } from "@/lib/resolve-listing-api-error"
import { DECANT_FORMATS, LISTING_CONDITIONS } from "@/utils/listing-display"
import { isDecantSplitsEnabledClient } from "@/utils/decant-splits-enabled"

type DecantSplitWizardProps = {
  perfumeId: string
  sourceUserPerfumeId?: string
  defaultDecantFormat?: string | null
  defaultCondition?: string | null
  onCreated: (splitId: string) => void
  onCancel: () => void
}

const DecantSplitWizard = ({
  perfumeId,
  sourceUserPerfumeId,
  defaultDecantFormat,
  defaultCondition,
  onCreated,
  onCancel,
}: DecantSplitWizardProps) => {
  const t = useTranslations("decantSplits.wizard")
  const tListing = useTranslations("listing")
  const tListingErrors = useTranslations("listing.errors")
  const { addToFormData } = useCSRF()

  const {
    budget,
    loading: budgetLoading,
    error: budgetFetchError,
    refresh: refreshBudget,
  } = useDecantSplitBudget(perfumeId, sourceUserPerfumeId)

  const budgetStatus = splitWizardBudgetStatus(
    budget,
    budgetFetchError,
    budgetLoading
  )

  const [step, setStep] = useState(1)
  const [totalMl, setTotalMl] = useState("")
  const [slotCount, setSlotCount] = useState("6")
  const [slotMl, setSlotMl] = useState("10")
  const [priceHint, setPriceHint] = useState("")
  const [notes, setNotes] = useState("")
  const [decantFormat, setDecantFormat] = useState(defaultDecantFormat ?? "")
  const [condition, setCondition] = useState(defaultCondition ?? "")
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const errorRef = useRef<HTMLParagraphElement>(null)

  // Clear step error when perfume/source changes; keep draft field values.
  useEffect(() => {
    setError(null)
  }, [perfumeId, sourceUserPerfumeId])

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus()
    }
  }, [error])

  const reasonMessage = useCallback(
    (reason: SplitWizardValidationReason): string => {
      switch (reason) {
        case "budget_loading":
          return t("budgetLoading")
        case "budget_error":
        case "budget_unavailable":
          return t("budgetUnavailable")
        case "ownership_unknown":
          return t("budgetUnknownOwned")
        case "no_owned_volume":
          return t("budgetNoOwned")
        case "invalid_total":
        case "total_not_positive":
          return t("invalidTotalMl")
        case "exceeds_available":
          return t("exceedsAvailable")
        case "invalid_slot_count":
          return t("invalidSlotCount")
        case "slot_count_out_of_range":
          return t("slotCountOutOfRange", {
            min: DECANT_SPLIT_MIN_SLOT_COUNT,
            max: DECANT_SPLIT_MAX_SLOT_COUNT,
          })
        case "invalid_slot_ml":
        case "slot_ml_not_positive":
          return t("invalidSlotMl")
        case "slot_total_mismatch":
          return t("slotTotalMismatch")
        default:
          return t("createFailed")
      }
    },
    [t]
  )

  const draftValidation = validateSplitWizardDraft({
    totalMlRaw: totalMl,
    slotCountRaw: slotCount,
    slotMlRaw: slotMl,
    budget,
    budgetStatus,
  })

  const liveSlotSum =
    draftValidation.ok
      ? draftValidation.parsed.slotSum
      : (() => {
          const count = Number.parseInt(slotCount, 10)
          const ml = Number.parseFloat(slotMl)
          if (!Number.isFinite(count) || !Number.isFinite(ml) || count < 1) {
            return null
          }
          return roundMl(count * ml)
        })()

  const parsedTotalPreview = Number.parseFloat(totalMl)
  const remainingPreview =
    budget &&
    budgetStatus === "ready" &&
    Number.isFinite(parsedTotalPreview) &&
    parsedTotalPreview > 0
      ? remainingAfterProposed(budget.remainingPourableMl, parsedTotalPreview)
      : null

  const goNextFromStep1 = () => {
    const result = validateSplitWizardStep1({
      totalMlRaw: totalMl,
      budget,
      budgetStatus,
    })
    if (!result.ok) {
      setError(reasonMessage(result.reason))
      return
    }
    setError(null)
    setStep(2)
  }

  const goNextFromStep2 = () => {
    const result = validateSplitWizardStep2({
      totalMlRaw: totalMl,
      slotCountRaw: slotCount,
      slotMlRaw: slotMl,
      budget,
      budgetStatus,
    })
    if (!result.ok) {
      setError(reasonMessage(result.reason))
      return
    }
    setError(null)
    setStep(3)
  }

  const handleSubmit = useCallback(async () => {
    if (!disclaimerAccepted) {
      setError(t("disclaimerRequired"))
      return
    }

    const validation = validateSplitWizardDraft({
      totalMlRaw: totalMl,
      slotCountRaw: slotCount,
      slotMlRaw: slotMl,
      budget,
      budgetStatus,
    })
    if (!validation.ok) {
      setError(reasonMessage(validation.reason))
      return
    }

    if (!tryAcquireSubmitLock(submittingRef)) return
    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("perfumeId", perfumeId)
      if (sourceUserPerfumeId) {
        formData.append("sourceUserPerfumeId", sourceUserPerfumeId)
      }
      formData.append("totalMl", String(validation.parsed.totalMl))
      formData.append("slotMl", JSON.stringify(validation.parsed.slots))
      if (priceHint.trim()) formData.append("priceHint", priceHint.trim())
      if (notes.trim()) formData.append("notes", notes.trim())
      if (decantFormat) formData.append("decantFormat", decantFormat)
      if (condition) formData.append("condition", condition)
      addToFormData(formData)

      const res = await fetch("/api/decant-splits", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const data = (await res.json().catch(() => null)) as {
        success?: boolean
        error?: string
        errorCode?: string
        split?: { id: string }
      } | null

      if (!res.ok || !data?.success || !data.split?.id) {
        const localized =
          resolveListingApiError(
            { error: data?.error, errorCode: data?.errorCode },
            tListingErrors
          ) ??
          data?.error ??
          t("createFailed")

        if (isBudgetConflictErrorCode(data?.errorCode)) {
          await refreshBudget()
        }

        setError(localized)
        return
      }

      onCreated(data.split.id)
    } catch {
      setError(t("createFailed"))
    } finally {
      releaseSubmitLock(submittingRef)
      setSubmitting(false)
    }
  }, [
    addToFormData,
    budget,
    budgetStatus,
    condition,
    decantFormat,
    disclaimerAccepted,
    notes,
    onCreated,
    perfumeId,
    priceHint,
    reasonMessage,
    refreshBudget,
    slotCount,
    slotMl,
    sourceUserPerfumeId,
    t,
    tListingErrors,
    totalMl,
  ])

  if (!isDecantSplitsEnabledClient()) return null

  const budgetBlocked =
    budgetStatus === "loading" ||
    budgetStatus === "error" ||
    budgetStatus === "unknown" ||
    budgetStatus === "none" ||
    !budget?.mayAllocate

  const step1Ready = validateSplitWizardStep1({
    totalMlRaw: totalMl,
    budget,
    budgetStatus,
  }).ok

  const step2Ready = validateSplitWizardStep2({
    totalMlRaw: totalMl,
    slotCountRaw: slotCount,
    slotMlRaw: slotMl,
    budget,
    budgetStatus,
  }).ok

  return (
    <div className="space-y-4 rounded-md border border-noir-gold/40 bg-noir-dark/60 p-4">
      <h4 className="text-lg text-noir-gold">{t("title")}</h4>

      {budgetStatus === "loading" && (
        <p className="text-sm text-noir-gold-100" role="status">
          {t("budgetLoading")}
        </p>
      )}

      {budgetStatus === "error" && (
        <div
          className="flex flex-wrap items-center gap-2 text-sm text-red-300"
          role="alert"
        >
          <span>{t("budgetLoadFailed")}</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void refreshBudget()}
          >
            {t("budgetRetry")}
          </Button>
        </div>
      )}

      {budgetStatus === "unknown" && (
        <p className="text-sm text-amber-200" role="status">
          {t("budgetUnknownOwned")}
        </p>
      )}

      {budgetStatus === "none" && (
        <p className="text-sm text-amber-200" role="status">
          {t("budgetNoOwned")}
        </p>
      )}

      {budget && budgetStatus === "ready" && (
        <p className="text-sm text-noir-gold-100">
          {t("budget", {
            remaining: formatSplitMlDisplay(budget.remainingPourableMl),
            owned: formatSplitMlDisplay(budget.ownedMl),
            listed: formatSplitMlDisplay(budget.listedMl),
            reserved: formatSplitMlDisplay(budget.reservedMl),
          })}
          {budget.consumedCompletedMl > 0
            ? ` ${t("budgetCompletedPours", {
                ml: formatSplitMlDisplay(budget.consumedCompletedMl),
              })}`
            : null}
        </p>
      )}

      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          className="text-sm text-red-400 outline-none"
          role="alert"
        >
          {error}
        </p>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <label className="block text-sm text-noir-gold-100">
            {t("totalMlLabel")}
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={totalMl}
              onChange={e => setTotalMl(e.target.value)}
              className="mt-1 w-full rounded border border-noir-gold/30 bg-noir-black px-3 py-2 text-noir-light"
            />
          </label>
          {remainingPreview != null && (
            <p className="text-xs text-noir-gold-300">
              {t("remainingAfter", {
                remaining: formatSplitMlDisplay(remainingPreview),
              })}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={budgetBlocked || !step1Ready}
              onClick={goNextFromStep1}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <label className="block text-sm text-noir-gold-100">
            {t("slotCountLabel")}
            <input
              type="number"
              min={DECANT_SPLIT_MIN_SLOT_COUNT}
              max={DECANT_SPLIT_MAX_SLOT_COUNT}
              step={1}
              value={slotCount}
              onChange={e => setSlotCount(e.target.value)}
              className="mt-1 w-full rounded border border-noir-gold/30 bg-noir-black px-3 py-2 text-noir-light"
            />
          </label>
          <label className="block text-sm text-noir-gold-100">
            {t("slotMlLabel")}
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={slotMl}
              onChange={e => setSlotMl(e.target.value)}
              className="mt-1 w-full rounded border border-noir-gold/30 bg-noir-black px-3 py-2 text-noir-light"
            />
          </label>
          <p className="text-xs text-noir-gold-300">
            {t("slotSum", {
              sum:
                liveSlotSum != null
                  ? formatSplitMlDisplay(liveSlotSum)
                  : "—",
              total: totalMl.trim()
                ? formatSplitMlDisplay(Number.parseFloat(totalMl) || 0)
                : "—",
            })}
          </p>
          {remainingPreview != null && (
            <p className="text-xs text-noir-gold-300">
              {t("remainingAfter", {
                remaining: formatSplitMlDisplay(remainingPreview),
              })}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null)
                setStep(1)
              }}
            >
              {t("back")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!step2Ready}
              onClick={goNextFromStep2}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {draftValidation.ok && budget && (
            <div
              className="rounded border border-noir-gold/25 bg-noir-black/40 px-3 py-2 text-xs text-noir-gold-100 space-y-1"
              aria-live="polite"
            >
              <p>
                {t("summaryTotal", {
                  total: formatSplitMlDisplay(draftValidation.parsed.totalMl),
                })}
              </p>
              <p>
                {t("summarySlots", {
                  count: draftValidation.parsed.slotCount,
                  ml: formatSplitMlDisplay(draftValidation.parsed.slotMl),
                })}
              </p>
              <p>
                {t("remainingAfter", {
                  remaining: formatSplitMlDisplay(
                    remainingAfterProposed(
                      budget.remainingPourableMl,
                      draftValidation.parsed.totalMl
                    )
                  ),
                })}
              </p>
              {priceHint.trim() ? (
                <p>{t("summaryPriceHint", { hint: priceHint.trim() })}</p>
              ) : null}
            </div>
          )}

          <label className="block text-sm text-noir-gold-100">
            {t("priceHintLabel")}
            <input
              type="text"
              value={priceHint}
              onChange={e => setPriceHint(e.target.value)}
              maxLength={100}
              className="mt-1 w-full rounded border border-noir-gold/30 bg-noir-black px-3 py-2 text-noir-light"
            />
          </label>
          <label className="block text-sm text-noir-gold-100">
            {t("notesLabel")}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded border border-noir-gold/30 bg-noir-black px-3 py-2 text-noir-light"
            />
          </label>
          <label className="block text-sm text-noir-gold-100">
            {tListing("decantFormatLabel")}
            <select
              value={decantFormat}
              onChange={e => setDecantFormat(e.target.value)}
              className="mt-1 w-full rounded border border-noir-gold/30 bg-noir-black px-3 py-2 text-noir-light"
            >
              <option value="">{tListing("decantFormatPlaceholder")}</option>
              {DECANT_FORMATS.map(f => (
                <option key={f} value={f}>
                  {tListing(`decantFormat.${f}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-noir-gold-100">
            {tListing("conditionLabel")}
            <select
              value={condition}
              onChange={e => setCondition(e.target.value)}
              className="mt-1 w-full rounded border border-noir-gold/30 bg-noir-black px-3 py-2 text-noir-light"
            >
              <option value="">{tListing("conditionPlaceholder")}</option>
              {LISTING_CONDITIONS.map(c => (
                <option key={c} value={c}>
                  {tListing(`condition.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm text-noir-gold-100">
            <input
              type="checkbox"
              checked={disclaimerAccepted}
              onChange={e => setDisclaimerAccepted(e.target.checked)}
              className="mt-1"
            />
            {t("disclaimer")}
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={submitting}
              onClick={() => {
                setError(null)
                setStep(2)
              }}
            >
              {t("back")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={submitting || !disclaimerAccepted || !step2Ready}
              onClick={() => void handleSubmit()}
            >
              {submitting ? t("creating") : t("create")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DecantSplitWizard

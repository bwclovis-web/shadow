"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import { useCSRF } from "@/hooks/useCSRF"
import type { PourableMlBudgetForClient } from "@/types/decant-split"
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
  const { addToFormData } = useCSRF()

  const [step, setStep] = useState(1)
  const [budget, setBudget] = useState<PourableMlBudgetForClient | null>(null)
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

  useEffect(() => {
    if (!isDecantSplitsEnabledClient()) return
    void fetch(`/api/decant-splits/budget?perfumeId=${encodeURIComponent(perfumeId)}`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.budget) setBudget(data.budget)
      })
      .catch(() => {})
  }, [perfumeId])

  const parsedTotal = parseFloat(totalMl) || 0
  const parsedSlotCount = Math.max(1, parseInt(slotCount, 10) || 1)
  const parsedSlotMl = parseFloat(slotMl) || 0
  const slotSum = parsedSlotCount * parsedSlotMl

  const handleSubmit = useCallback(async () => {
    if (!disclaimerAccepted) {
      setError(t("disclaimerRequired"))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const slots = Array.from({ length: parsedSlotCount }, () => parsedSlotMl)
      const formData = new FormData()
      formData.append("perfumeId", perfumeId)
      if (sourceUserPerfumeId) {
        formData.append("sourceUserPerfumeId", sourceUserPerfumeId)
      }
      formData.append("totalMl", String(parsedTotal))
      formData.append("slotMl", JSON.stringify(slots))
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
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? t("createFailed"))
        return
      }
      onCreated(data.split.id)
    } catch {
      setError(t("createFailed"))
    } finally {
      setSubmitting(false)
    }
  }, [
    addToFormData,
    condition,
    decantFormat,
    disclaimerAccepted,
    notes,
    onCreated,
    parsedSlotCount,
    parsedSlotMl,
    parsedTotal,
    perfumeId,
    priceHint,
    sourceUserPerfumeId,
    t,
  ])

  if (!isDecantSplitsEnabledClient()) return null

  return (
    <div className="space-y-4 rounded-md border border-noir-gold/40 bg-noir-dark/60 p-4">
      <h4 className="text-lg text-noir-gold">{t("title")}</h4>
      {budget && (
        <p className="text-sm text-noir-gold-100">
          {t("budget", {
            remaining: budget.remainingPourableMl.toFixed(1),
            owned: budget.ownedMl.toFixed(1),
            listed: budget.listedMl.toFixed(1),
            reserved: budget.reservedMl.toFixed(1),
          })}
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
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={parsedTotal <= 0}
              onClick={() => setStep(2)}
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
              min={1}
              max={24}
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
            {t("slotSum", { sum: slotSum.toFixed(1), total: parsedTotal.toFixed(1) })}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep(1)}>
              {t("back")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={Math.abs(slotSum - parsedTotal) > 0.05}
              onClick={() => setStep(3)}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <label className="block text-sm text-noir-gold-100">
            {t("priceHintLabel")}
            <input
              type="text"
              value={priceHint}
              onChange={e => setPriceHint(e.target.value)}
              className="mt-1 w-full rounded border border-noir-gold/30 bg-noir-black px-3 py-2 text-noir-light"
            />
          </label>
          <label className="block text-sm text-noir-gold-100">
            {t("notesLabel")}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep(2)}>
              {t("back")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={submitting || !disclaimerAccepted}
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

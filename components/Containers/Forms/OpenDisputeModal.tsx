"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import ImageUploader from "@/components/Molecules/ImageUploader/ImageUploader"
import {
  createTradeDisputeAction,
  type CreateTradeDisputeActionState,
} from "@/app/trades/dispute-actions"
import { DISPUTE_CATEGORIES } from "@/utils/dispute-constants"
import { uploadReportImage } from "@/utils/report-images-client"

const DISPUTE_CAMERA_MODAL_ID = "dispute-camera-capture"

type OpenDisputeModalProps = {
  tradeId: string
  onSuccess?: () => void
}

const OpenDisputeModal = ({ tradeId, onSuccess }: OpenDisputeModalProps) => {
  const t = useTranslations("dispute")
  const [images, setImages] = useState<string[]>([])
  const [state, formAction, isPending] = useActionState(
    createTradeDisputeAction,
    null as CreateTradeDisputeActionState
  )

  useEffect(() => {
    if (state?.success) {
      onSuccess?.()
    }
  }, [state?.success, onSuccess])

  return (
    <div className="w-full p-6">
      <h2 className="mb-1 text-lg font-semibold text-noir-gold-100">{t("heading")}</h2>
      <p className="mb-2 text-sm text-noir-gold-100/90">{t("subheading")}</p>
      <p className="mb-4 text-sm">
        <Link
          href="/community-policy#disputes"
          className="text-noir-gold underline hover:text-noir-gold-100"
        >
          {t("policyLink")}
        </Link>
      </p>

      {state && (
        <div
          className={`mb-4 rounded-md border p-3 text-sm ${
            state.success
              ? "border-green-500/50 bg-green-900/20 text-green-300"
              : "border-red-400/50 bg-red-900/20 text-red-300"
          }`}
        >
          {state.message}
        </div>
      )}

      {!state?.success && (
        <form action={formAction} className="flex flex-col gap-4">
          <CSRFToken />
          <input type="hidden" name="tradeId" value={tradeId} />
          <input type="hidden" name="images" value={JSON.stringify(images)} />

          <div>
            <label htmlFor="report-category" className="mb-1 block text-sm text-noir-gold-100">
              {t("categoryLabel")}
            </label>
            <select
              id="report-category"
              name="category"
              required
              disabled={isPending}
              defaultValue=""
              className="w-full rounded border border-noir-gold-500/50 bg-noir-black px-3 py-2 text-sm text-noir-gold-100 focus:border-noir-gold focus:outline-none focus:ring-1 focus:ring-noir-gold disabled:opacity-50"
            >
              <option value="" disabled>
                {t("categoryPlaceholder")}
              </option>
              {DISPUTE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`categories.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-description" className="mb-1 block text-sm text-noir-gold-100">
              {t("descriptionLabel")}
            </label>
            <textarea
              id="report-description"
              name="description"
              rows={4}
              disabled={isPending}
              placeholder={t("descriptionPlaceholder")}
              className="w-full rounded border border-noir-gold-500/50 bg-noir-black px-3 py-2 text-sm text-noir-gold-100 focus:border-noir-gold focus:outline-none focus:ring-1 focus:ring-noir-gold disabled:opacity-50"
            />
          </div>

          <div>
            <p className="mb-1 block text-sm text-noir-gold-100">{t("photosLabel")}</p>
            <p className="mb-2 text-xs text-noir-gold-100/70">{t("photosHint")}</p>
            <ImageUploader
              value={images}
              onChange={setImages}
              maxImages={3}
              disabled={isPending}
              label={t("photosLabel")}
              uploadFn={uploadReportImage}
              translationNamespace="listing"
              cameraModalId={DISPUTE_CAMERA_MODAL_ID}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            background="gold"
            disabled={isPending}
            className="w-full"
          >
            {isPending ? t("submitting") : t("submit")}
          </Button>
        </form>
      )}
    </div>
  )
}

export default OpenDisputeModal

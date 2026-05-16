"use client"

import { useActionState, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import type { UserReportCategory } from "@prisma/client"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import ImageUploader from "@/components/Molecules/ImageUploader/ImageUploader"
import {
  createUserReportAction,
  type CreateUserReportActionState,
} from "@/app/trader-profile/actions"
import { uploadReportImage } from "@/utils/report-images-client"

const CATEGORIES: UserReportCategory[] = [
  "scam",
  "fakeItem",
  "harassment",
  "noShip",
  "other",
]

const REPORT_CAMERA_MODAL_ID = "report-camera-capture"

type ReportTraderModalProps = {
  reportedUserId: string
  traderName: string
  tradeId?: string | null
  onSuccess?: () => void
}

const ReportTraderModal = ({
  reportedUserId,
  traderName,
  tradeId,
  onSuccess,
}: ReportTraderModalProps) => {
  const t = useTranslations("userReport")
  const [images, setImages] = useState<string[]>([])
  const [state, formAction, isPending] = useActionState(
    createUserReportAction,
    null as CreateUserReportActionState
  )

  useEffect(() => {
    if (state?.success) {
      onSuccess?.()
    }
  }, [state?.success, onSuccess])

  return (
    <div className="w-full p-6">
      <h2 className="mb-1 text-lg font-semibold text-noir-gold-100">{t("heading")}</h2>
      <p className="mb-4 text-sm text-noir-gold-100/90">
        {t("subheading", { traderName })}
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
          <input type="hidden" name="reportedUserId" value={reportedUserId} />
          <input type="hidden" name="images" value={JSON.stringify(images)} />
          {tradeId ? <input type="hidden" name="tradeId" value={tradeId} /> : null}

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
              {CATEGORIES.map((cat) => (
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
              uploadFn={uploadReportImage}
              translationNamespace="listing"
              cameraModalId={REPORT_CAMERA_MODAL_ID}
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

export default ReportTraderModal

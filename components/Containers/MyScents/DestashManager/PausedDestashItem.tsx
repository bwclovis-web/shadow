"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import { getResumeListingMl } from "@/lib/user-inventory"
import type { UserPerfumeI } from "@/types"

type PausedDestashItemProps = {
  destash: UserPerfumeI
  onResume: () => void
  onRemove: () => void
  isResuming: boolean
  isRemoving: boolean
}

const PausedDestashItem = ({
  destash,
  onResume,
  onRemove,
  isResuming,
  isRemoving,
}: PausedDestashItemProps) => {
  const t = useTranslations("myScents.destashManager")
  const pausedMl = getResumeListingMl(destash)

  return (
    <div className="noir-border flex flex-col gap-3 rounded border border-dashed border-noir-gold/30 bg-noir-dark/60 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-medium text-noir-gold-500">{t("pausedLabel")}</p>
        <p className="text-lg text-noir-gold-100">
          {t("pausedAmount", { ml: pausedMl.toFixed(1) })}
        </p>
        {destash.tradePrice && (
          <p className="text-sm text-noir-gold-500">
            {t("price")}: ${destash.tradePrice}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={isResuming || pausedMl <= 0}
          onClick={onResume}
        >
          {isResuming ? t("resuming") : t("resume")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isRemoving}
          onClick={onRemove}
        >
          {isRemoving ? t("removing") : t("removePaused")}
        </Button>
      </div>
    </div>
  )
}

export default PausedDestashItem

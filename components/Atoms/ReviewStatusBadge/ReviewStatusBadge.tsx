"use client"

import { useTranslations } from "next-intl"
import { MdInfoOutline } from "react-icons/md"

import IconPopover from "@/components/Molecules/IconPopover"
import { styleMerge } from "@/utils/styleUtils"

type ReviewStatusBadgeProps = {
  className?: string
  size?: "sm" | "md"
}

const ReviewStatusBadge = ({ className, size = "sm" }: ReviewStatusBadgeProps) => {
  const t = useTranslations("myScents.reviewStatus")
  const iconSize = size === "sm" ? 14 : 16

  return (
    <span className={styleMerge("inline-flex items-center gap-1", className)}>
      <span
        className={styleMerge(
          "inline-flex shrink-0 items-center rounded border border-amber-400/50 bg-amber-950/80 font-semibold uppercase tracking-wide text-amber-200",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
        )}
      >
        {t("inReview")}
      </span>
      <IconPopover
        ariaLabel={t("inReviewInfoAriaLabel")}
        className="inline-flex items-center self-center"
        icon={<MdInfoOutline size={iconSize} className="text-current shrink-0" />}
        buttonClassName={styleMerge(
          "flex items-center justify-center !gap-0 !p-0 !w-auto rounded-full border border-amber-400/35 text-amber-200/80 hover:text-amber-100 hover:border-amber-400/55 [&>span]:inline-flex [&>span]:items-center [&>span]:leading-none",
          size === "sm" ? "size-5" : "size-6"
        )}
      >
        <p className="text-sm text-noir-gold-100/90 leading-snug text-left px-1 m-0 max-w-xs">
          {t("inReviewInfo")}
        </p>
      </IconPopover>
    </span>
  )
}

export default ReviewStatusBadge

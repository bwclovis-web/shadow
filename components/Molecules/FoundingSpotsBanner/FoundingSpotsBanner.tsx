"use client"

import { useTranslations } from "next-intl"

import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"
import { useJoinCta } from "@/components/Containers/SignupAvailability"
import {
  type JoinCtaPlacement,
  trackJoinCtaClick,
} from "@/utils/analytics/track-join-cta"
import { styleMerge } from "@/utils/styleUtils"

type FoundingSpotsBannerProps = {
  placement?: JoinCtaPlacement
  className?: string
}

/** Renders only while free founding spots remain. */
const FoundingSpotsBanner = ({
  placement = "banner",
  className,
}: FoundingSpotsBannerProps) => {
  const t = useTranslations("join")
  const { freeOpen, spotsLeft, limit, href, labelKey } = useJoinCta()

  if (!freeOpen) return null

  return (
    <aside
      className={styleMerge(
        "noir-border flex flex-col items-center gap-3 bg-noir-black/60 px-4 py-4 text-center backdrop-blur-sm md:flex-row md:justify-between md:text-left",
        className
      )}
    >
      <p className="text-noir-gold-100">
        {t("bannerOpen", { remaining: spotsLeft, limit })}
      </p>
      <VooDooLink
        url={href}
        variant="primary"
        background="gold"
        size="sm"
        className="md:w-auto"
        onClick={() => trackJoinCtaClick(placement, freeOpen)}
      >
        {t(labelKey)}
      </VooDooLink>
    </aside>
  )
}

export default FoundingSpotsBanner

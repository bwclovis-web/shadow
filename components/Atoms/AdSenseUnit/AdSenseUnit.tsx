"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import {
  getAdSenseClientId,
  getAdSenseSlotId,
  isAdSenseEnabled,
  type AdSenseSlotKind,
} from "@/utils/ads/should-show-ads"

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

type AdSenseUnitProps = {
  /** When false (participating members), render nothing. */
  showAds: boolean
  variant?: AdSenseSlotKind
  className?: string
  /** Override env slot id when needed. */
  slotId?: string
}

const AdSenseUnit = ({
  showAds,
  variant = "display",
  className = "",
  slotId: slotIdProp,
}: AdSenseUnitProps) => {
  const pathname = usePathname()
  const pushedRef = useRef(false)
  const clientId = getAdSenseClientId()
  const slotId = slotIdProp ?? getAdSenseSlotId(variant)

  useEffect(() => {
    pushedRef.current = false
  }, [pathname, slotId, variant])

  useEffect(() => {
    if (!showAds || !isAdSenseEnabled() || !clientId || !slotId) return
    if (pushedRef.current) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushedRef.current = true
    } catch {
      // Ad blocker or script not ready — ignore
    }
  }, [showAds, clientId, slotId, pathname, variant])

  if (!showAds || !isAdSenseEnabled() || !clientId || !slotId) {
    return null
  }

  return (
    <div
      key={`${pathname}-${variant}-${slotId}`}
      className={`w-full max-w-3xl mx-auto my-8 min-h-[90px] flex justify-center ${className}`.trim()}
      data-ad-slot={variant}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format={variant === "inArticle" ? "fluid" : "auto"}
        data-ad-layout={variant === "inArticle" ? "in-article" : undefined}
        data-full-width-responsive={variant === "display" ? "true" : undefined}
      />
    </div>
  )
}

export default AdSenseUnit

"use client"

import { useState } from "react"

import { getCountryFlagImageUrl } from "@/utils/country-list"
import { styleMerge } from "@/utils/styleUtils"

type CountryFlagBadgeProps = {
  code?: string | null
  label?: string | null
  size?: "sm" | "md"
  className?: string
}

const sizeClasses = {
  sm: { img: "h-3.5 w-5", code: "text-[9px] min-w-[1.4rem] px-1 py-0" },
  md: { img: "h-4 w-6", code: "text-[10px] min-w-[1.6rem] px-1.5 py-0.5" },
} as const

const normalizeCode = (code: string | null | undefined): string | null => {
  const upper = code?.trim().toUpperCase() ?? ""
  if (!/^[A-Z]{2}$/.test(upper)) return null
  return upper === "UK" ? "GB" : upper
}

/**
 * Country flag: small PNG (flagcdn) plus optional ISO code badge.
 * Emoji flags are not used — they often do not render on Windows.
 */
const CountryFlagBadge = ({
  code,
  label,
  size = "sm",
  className,
}: CountryFlagBadgeProps) => {
  const iso = normalizeCode(code)
  const [imgFailed, setImgFailed] = useState(false)
  const flagWidth = size === "md" ? 24 : 20
  const showImg = Boolean(iso && !imgFailed)
  const showCodeBadge = Boolean(iso && (!label || imgFailed))

  return (
    <span className={styleMerge("inline-flex items-center gap-1.5", className)}>
      {iso ? (
        <span className="inline-flex items-center gap-1 shrink-0">
          {showImg ? (
            <img
              src={getCountryFlagImageUrl(iso, flagWidth)}
              alt=""
              width={flagWidth}
              height={size === "md" ? 18 : 15}
              className={styleMerge(
                "rounded-sm object-cover border border-noir-gold/20 bg-noir-dark/50",
                sizeClasses[size].img
              )}
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          ) : null}
          {showCodeBadge ? (
            <span
              className={styleMerge(
                "inline-flex items-center justify-center rounded border border-noir-gold/50 bg-noir-gold/15 font-mono font-bold uppercase tracking-wider text-noir-gold",
                sizeClasses[size].code
              )}
              aria-hidden
            >
              {iso}
            </span>
          ) : null}
        </span>
      ) : null}
      {label ? <span>{label}</span> : null}
    </span>
  )
}

export default CountryFlagBadge

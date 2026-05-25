import React from "react"

import NoirIcon from "./NoirIcon"

const SIZES = {
  sm: "w-12 h-16",
  md: "w-16 h-20",
  lg: "w-20 h-24",
}

interface NoirButtonProps {
  rating: number
  filled: boolean
  category: string
  size: "sm" | "md" | "lg"
  isInteractive: boolean
  isAnimated: boolean
  isSelectedPulse?: boolean
  onClick: () => void
  onHover: () => void
  onLeave: () => void
}

const NoirButton = ({
  rating,
  filled,
  category,
  size,
  isInteractive,
  isAnimated,
  isSelectedPulse = false,
  onClick,
  onHover,
  onLeave,
}: NoirButtonProps) => (
  <button
    type="button"
    disabled={!isInteractive}
    onClick={event => {
      event.preventDefault()
      event.stopPropagation()
      onClick()
    }}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    aria-label={`Rate ${category} ${rating}`}
    className={`
      ${SIZES[size]} 
      transition-[transform,opacity,filter] duration-300 ease-out 
      cursor-pointer
      ${isInteractive ? "motion-safe:hover:-translate-y-1 hover:opacity-90" : ""}
      ${filled ? "drop-shadow-[0_4px_12px_rgba(212,175,55,0.18)]" : ""}
      ${isSelectedPulse ? "motion-safe:animate-vault-stamp" : ""}
      flex-shrink-0
    `}
  >
    <span
      className={`block transition-transform duration-300 ease-out ${
        filled ? "scale-[1.03]" : ""
      } ${isAnimated ? "motion-safe:scale-[1.06]" : ""}`}
    >
      <NoirIcon
        filled={filled}
        category={category}
        animated={isAnimated}
        rating={rating}
      />
    </span>
  </button>
)

export default NoirButton

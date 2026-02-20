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
      transition-opacity duration-300 
      cursor-pointer
      ${isInteractive ? "hover:opacity-80" : ""}
      flex-shrink-0
    `}
  >
    <NoirIcon
      filled={filled}
      category={category}
      animated={isAnimated}
      rating={rating}
    />
  </button>
)

export default NoirButton

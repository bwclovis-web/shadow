"use client"

import { useEffect, useState } from "react"

import RatingLabel from "./RatingLabel"
import StarRating from "./StarRating"

interface NoirRatingProps {
  category: "longevity" | "sillage" | "gender" | "priceValue" | "overall"
  value?: number | null
  onChange?: (rating: number) => void
  readonly?: boolean
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
}

const NoirRating = ({
  category,
  value,
  onChange,
  readonly = false,
  size = "sm",
  showLabel = true,
}: NoirRatingProps) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const [displayValue, setDisplayValue] = useState(value ?? 0)
  const [selectedPulseValue, setSelectedPulseValue] = useState<number | null>(null)

  const isInteractive = !readonly && Boolean(onChange)
  const baseValue = value !== undefined && value !== null ? value : displayValue
  const currentValue = hoverValue ?? baseValue

  useEffect(() => {
    if (value === undefined || value === null) return
    setDisplayValue(value)
  }, [value])

  useEffect(() => {
    if (selectedPulseValue == null) return

    const timeoutId = window.setTimeout(() => {
      setSelectedPulseValue(current =>
        current === selectedPulseValue ? null : current
      )
    }, 520)

    return () => window.clearTimeout(timeoutId)
  }, [selectedPulseValue])

  const handleChange = (rating: number) => {
    setDisplayValue(rating)
    setSelectedPulseValue(rating)
    onChange?.(rating)
  }

  return (
    <div className="flex flex-col items-center gap-2 min-w-0 min-h-0">
      <StarRating
        currentValue={currentValue}
        category={category}
        size={size}
        isInteractive={isInteractive}
        hoverValue={hoverValue}
        selectedPulseValue={selectedPulseValue}
        onChange={handleChange}
        onHover={setHoverValue}
        onLeave={() => setHoverValue(null)}
      />
      <RatingLabel
        showLabel={showLabel}
        currentValue={currentValue}
        category={category}
        emphasized={selectedPulseValue != null || hoverValue != null}
      />
    </div>
  )
}

export default NoirRating

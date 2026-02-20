 
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
  size = "md",
  showLabel = true,
}: NoirRatingProps) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const [displayValue, setDisplayValue] = useState(value || 0)
  const isInteractive = !readonly && Boolean(onChange)

  // Update display value when prop value changes
  useEffect(() => {
    setDisplayValue(value || 0)
  }, [value])

  const currentValue = hoverValue || displayValue

  const handleChange = (rating: number) => {
    setDisplayValue(rating)
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
        onChange={handleChange}
        onHover={setHoverValue}
        onLeave={() => setHoverValue(null)}
      />
      <RatingLabel
        showLabel={showLabel}
        currentValue={currentValue}
        category={category}
      />
    </div>
  )
}

export default NoirRating

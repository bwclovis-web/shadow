import NoirButton from "./NoirButton"

type StarRatingProps = {
  currentValue: number
  category: string
  size: "sm" | "md" | "lg"
  isInteractive: boolean
  hoverValue: number | null
  onChange?: (rating: number) => void
  onHover: (rating: number | null) => void
  onLeave: () => void
}

const StarRating = ({
  currentValue,
  category,
  size,
  isInteractive,
  hoverValue,
  onChange,
  onHover,
  onLeave,
}: StarRatingProps) => (
  <div className="flex items-center gap-0.5 min-h-0 flex-shrink-0">
    {[
1, 2, 3, 4, 5
].map(rating => (
      <NoirButton
        key={rating}
        rating={rating}
        filled={rating <= currentValue}
        category={category}
        size={size}
        isInteractive={isInteractive}
        isAnimated={isInteractive && hoverValue === rating}
        onClick={() => onChange?.(rating)}
        onHover={() => onHover(rating)}
        onLeave={onLeave}
      />
    ))}
  </div>
)

export default StarRating

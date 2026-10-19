import { styleMerge } from "@/utils/styleUtils"

type ExchangeBottleMarkProps = {
  className?: string
}

/**
 * Outline bottle mark reused from NoirRating `PerfumeBottle` default path.
 * Decorative only — no rating fill / liquid behavior.
 */
export const ExchangeBottleMark = ({ className }: ExchangeBottleMarkProps) => (
  <svg
    aria-hidden
    viewBox="0 0 30 34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styleMerge("h-4 w-4 shrink-0 text-noir-gold", className)}
  >
    {/* Cap — same proportions as components/Organisms/NoirRating/PerfumeBottle */}
    <rect
      x="13.5"
      y="2"
      width="3"
      height="2"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1"
    />
    <rect
      x="13.5"
      y="4"
      width="3"
      height="4"
      stroke="currentColor"
      strokeWidth="1"
    />
    {/* Default elegant bottle body */}
    <path
      d="M12 8c0-1 1-2 3-2s3 1 3 2v20c0 2-1 3-3 3s-3-1-3-3V8z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
)

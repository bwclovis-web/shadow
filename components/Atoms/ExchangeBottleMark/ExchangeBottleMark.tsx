import { styleMerge } from "@/utils/styleUtils"

type ExchangeBottleMarkProps = {
  className?: string
}

/**
 * Outline bottle mark reused from NoirRating `PerfumeBottle` default path.
 * Decorative only — no rating fill / liquid behavior.
 * Wider body + left-aligned viewBox so it sits flush with following text.
 */
export const ExchangeBottleMark = ({ className }: ExchangeBottleMarkProps) => (
  <svg
    aria-hidden
    viewBox="0 0 18 34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMinYMid meet"
    className={styleMerge(
      "h-6 w-[14px] shrink-0 text-noir-gold",
      className
    )}
  >
    {/* Cap */}
    <rect
      x="6"
      y="1.5"
      width="6"
      height="2.5"
      rx="1.25"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    <rect
      x="6.5"
      y="4"
      width="5"
      height="4"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    {/* Wider bottle body */}
    <path
      d="M4.5 8c0-1.2 1.5-2.5 4.5-2.5S13.5 6.8 13.5 8v19.5c0 2.2-1.5 3.5-4.5 3.5S4.5 29.7 4.5 27.5V8z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </svg>
)

/** Inline SVG chips for season voting (filled / outline states). */

type IconProps = {
  filled: boolean
  className?: string
}

const stroke = (filled: boolean) =>
  filled ? "var(--season-vote-on, #d4af37)" : "var(--season-vote-off, rgba(212, 175, 55, 0.35))"
const fill = (filled: boolean) => (filled ? "var(--season-vote-on, #d4af37)" : "none")

export function WinterSeasonIcon({ filled, className = "w-12 h-12" }: IconProps) {
  const s = stroke(filled)
  const f = fill(filled)
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 4v32M4 20h32M9.17 9.17l21.66 21.66M30.83 9.17L9.17 30.83"
        stroke={s}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="20" cy="20" r="3.2" fill={f} stroke={s} strokeWidth="1.2" />
    </svg>
  )
}

export function SpringSeasonIcon({ filled, className = "w-12 h-12" }: IconProps) {
  const s = stroke(filled)
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0, 3)">
        <path
          d="M20 28V12M20 12c-4 0-7-2.5-7-6s3-6 7-6 7 2.5 7 6-3 6-7 6z"
          stroke={s}
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={filled ? "rgba(212, 175, 55, 0.15)" : "none"}
        />
        <path
          d="M12 22c2.5 3 5 4 8 4s5.5-1 8-4M14 26c2 2 4 3 6 3s4-1 6-3"
          stroke={s}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

export function SummerSeasonIcon({ filled, className = "w-12 h-12" }: IconProps) {
  const s = stroke(filled)
  const f = fill(filled)
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="6" fill={f} stroke={s} strokeWidth="1.6" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <line
          key={deg}
          x1="20"
          y1="20"
          x2={20 + 14 * Math.cos((deg * Math.PI) / 180)}
          y2={20 + 14 * Math.sin((deg * Math.PI) / 180)}
          stroke={s}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

export function FallSeasonIcon({ filled, className = "w-12 h-12" }: IconProps) {
  const s = stroke(filled)
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 8c-6 8-10 14-8 20 1.5 4 6 6 8 6s6.5-2 8-6c2-6-2-12-8-20z"
        stroke={s}
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill={filled ? "rgba(212, 175, 55, 0.2)" : "none"}
      />
      <path d="M20 18v10M16 24h8" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function AllSeasonsIcon({ filled, className = "w-12 h-12" }: IconProps) {
  const s = stroke(filled)
  const f = fill(filled)
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 8h11v11H8zM21 8h11v11H21zM8 21h11v11H8zM21 21h11v11H21z"
        stroke={s}
        strokeWidth="1.5"
        fill={f}
        fillOpacity={filled ? 0.25 : 0}
      />
    </svg>
  )
}

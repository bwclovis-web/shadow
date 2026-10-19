import { styleMerge } from "@/utils/styleUtils"

/**
 * Single top-left corner flourish. Mirror/rotate via parent transforms for other corners.
 * Stroke uses currentColor so the frame can set text-noir-gold (or any token).
 */
export type OrnamentalCornerProps = {
  className?: string
  /** Rendered size in CSS pixels (viewBox stays 32×32). */
  size: number
}

export const OrnamentalCorner = ({ className, size }: OrnamentalCornerProps) => (
  <svg
    aria-hidden
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styleMerge("overflow-visible", className)}
  >
    {/* Arms along the frame edge — start closer to the join so they meet the CSS border */}
    <path
      d="M9 3 H28"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    />
    <path
      d="M3 9 V28"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    />
    {/* Soft corner join (origin ~3,3) */}
    <path
      d="M9 3 C5.5 3 3 5.5 3 9"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Horizontal outward curl */}
    <path
      d="M16 3 C19 3 20.5 1.2 19.6 -0.6 C18.2 -2.8 13.8 -1.4 14.6 1.2 C15 2.2 16.4 3 18 3"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Vertical outward curl */}
    <path
      d="M3 16 C3 19 1.2 20.5 -0.6 19.6 C-2.8 18.2 -1.4 13.8 1.2 14.6 C2.2 15 3 16.4 3 18"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Small inner ticks */}
    <path
      d="M7.5 3 C7.8 1.6 9.2 0.9 10.4 1.6"
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinecap="round"
    />
    <path
      d="M3 7.5 C1.6 7.8 0.9 9.2 1.6 10.4"
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinecap="round"
    />
  </svg>
)

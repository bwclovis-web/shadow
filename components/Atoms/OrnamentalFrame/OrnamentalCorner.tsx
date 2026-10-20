import { styleMerge } from "@/utils/styleUtils"

/**
 * Single top-left corner flourish. Mirror/rotate via parent transforms for other corners.
 * Stroke uses currentColor so the frame can set text-noir-gold (or any token).
 *
 * - `frame` (default) — existing card/panel ornament (outward curls).
 * - `hero` — mockup-style inward filigree for page heroes only.
 */
export type OrnamentalCornerVariant = "frame" | "hero"

export type OrnamentalCornerProps = {
  className?: string
  /** Rendered size in CSS pixels. */
  size: number
  variant?: OrnamentalCornerVariant
}

/** ViewBox / join for `frame` variant (OrnamentalFrame, noir-border alignment). */
export const ORNAMENTAL_CORNER_VIEWBOX = 32
export const ORNAMENTAL_CORNER_JOIN = 3

/** ViewBox / join for `hero` variant. */
export const ORNAMENTAL_HERO_CORNER_VIEWBOX = 64
export const ORNAMENTAL_HERO_CORNER_JOIN = 6

const FrameCornerPaths = () => (
  <>
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
  </>
)

/**
 * Victorian stationery filigree for page heroes (Collection mockup).
 * Double edge rails, inward calligraphy spirals, leaf lobes, tip beads.
 */
const HeroCornerPaths = () => (
  <>
    {/* Outer edge rails */}
    <path
      d="M16 6 H58"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    />
    <path
      d="M6 16 V58"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    />
    {/* Inner parallel rails (short of the corner) */}
    <path
      d="M22 9.5 H52"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
      opacity="0.85"
    />
    <path
      d="M9.5 22 V52"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
      opacity="0.85"
    />
    {/* Soft corner join */}
    <path
      d="M16 6 C9.5 6 6 9.5 6 16"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.5 9.5 C12.5 9.5 9.5 12.5 9.5 18.5"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.85"
    />

    {/* Primary spiral from top rail — calligraphy hook into the field */}
    <path
      d="M26 6
         C36 6 44 11 44 20
         C44 30 34 36 26 33
         C19 30.5 17 23 22 19.5
         C26 16.5 31.5 19 31 24.5
         C30.6 28.5 26.5 30.5 23.5 28.5
         C21.2 27 21.5 23.5 24.5 23"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Secondary top swirl + leaf lobes */}
    <path
      d="M32 6 C38 8 41 13 39.5 18 C38 22 33 23.5 30 21"
      stroke="currentColor"
      strokeWidth="0.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M34 10.5
         C37.5 12.5 39 16.5 37 20
         C35.5 22.5 32 22 31 19.5
         C30.2 17.5 32 15.5 34 16.5"
      stroke="currentColor"
      strokeWidth="0.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M28 12 C30.5 14.5 30.8 18 28.5 20.5"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
    />
    <path
      d="M38 14 C40.5 16.5 41 20.5 38.5 23.5"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
    />

    {/* Primary spiral from left rail */}
    <path
      d="M6 26
         C6 36 11 44 20 44
         C30 44 36 34 33 26
         C30.5 19 23 17 19.5 22
         C16.5 26 19 31.5 24.5 31
         C28.5 30.6 30.5 26.5 28.5 23.5
         C27 21.2 23.5 21.5 23 24.5"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Secondary left swirl + leaf lobes */}
    <path
      d="M6 32 C8 38 13 41 18 39.5 C22 38 23.5 33 21 30"
      stroke="currentColor"
      strokeWidth="0.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.5 34
         C12.5 37.5 16.5 39 20 37
         C22.5 35.5 22 32 19.5 31
         C17.5 30.2 15.5 32 16.5 34"
      stroke="currentColor"
      strokeWidth="0.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 28 C14.5 30.5 18 30.8 20.5 28.5"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
    />
    <path
      d="M14 38 C16.5 40.5 20.5 41 23.5 38.5"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
    />

    {/* Corner rosette accent */}
    <path
      d="M14 14
         C16 11 20 11 22 14
         C25 17 25 21 22 24
         C19 27 15 27 12 24
         C9 21 9 17 12 14
         C13 13 14 13 14 14"
      stroke="currentColor"
      strokeWidth="0.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="17" cy="17" r="1.1" fill="currentColor" />

    {/* Tip beads on primary spirals */}
    <circle cx="24.5" cy="23" r="1.35" fill="currentColor" />
    <circle cx="23" cy="24.5" r="1.35" fill="currentColor" />
    <circle cx="30" cy="21" r="0.9" fill="currentColor" />
    <circle cx="21" cy="30" r="0.9" fill="currentColor" />
  </>
)

export const OrnamentalCorner = ({
  className,
  size,
  variant = "frame",
}: OrnamentalCornerProps) => {
  const viewBox =
    variant === "hero"
      ? ORNAMENTAL_HERO_CORNER_VIEWBOX
      : ORNAMENTAL_CORNER_VIEWBOX

  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styleMerge("overflow-visible", className)}
    >
      {variant === "hero" ? <HeroCornerPaths /> : <FrameCornerPaths />}
    </svg>
  )
}

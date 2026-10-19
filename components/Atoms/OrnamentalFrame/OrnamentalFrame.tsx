import type { ElementType, ReactNode } from "react"

import { styleMerge } from "@/utils/styleUtils"

import { OrnamentalCorner } from "./OrnamentalCorner"

export type OrnamentalFrameSize = "compact" | "standard"

export type OrnamentalFrameProps = {
  children: ReactNode
  /** `compact` for cards; `standard` for larger panels. */
  size?: OrnamentalFrameSize
  className?: string
  /** Wrapper element. Defaults to `div`. */
  as?: ElementType
}

const SIZE_PX: Record<OrnamentalFrameSize, number> = {
  compact: 20,
  standard: 28,
}

/**
 * Fine gold rectangular frame with curling corner flourishes.
 * Does not replace `.noir-border` — opt-in wrapper for Exchange (and future) surfaces.
 *
 * Corners are decorative (aria-hidden, pointer-events-none) and sit on the border
 * outside the content box so focus rings inside are not clipped.
 */
export const OrnamentalFrame = ({
  children,
  size = "standard",
  className,
  as: Tag = "div",
}: OrnamentalFrameProps) => {
  const cornerPx = SIZE_PX[size]
  /** Pull ornaments slightly outward so curls clear the border without eating padding. */
  const cornerOffset = size === "compact" ? "-3px" : "-4px"

  return (
    <Tag
      className={styleMerge(
        "relative overflow-visible text-noir-gold",
        className
      )}
    >
      {/* Straight frame lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 border border-current"
      />

      {/* Four corners: one SVG, mirrored for TR / BL / BR */}
      <span
        aria-hidden
        className="pointer-events-none absolute z-10"
        style={{ top: cornerOffset, left: cornerOffset }}
      >
        <OrnamentalCorner size={cornerPx} />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute z-10 origin-center scale-x-[-1]"
        style={{ top: cornerOffset, right: cornerOffset }}
      >
        <OrnamentalCorner size={cornerPx} />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute z-10 origin-center scale-y-[-1]"
        style={{ bottom: cornerOffset, left: cornerOffset }}
      >
        <OrnamentalCorner size={cornerPx} />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute z-10 origin-center scale-x-[-1] scale-y-[-1]"
        style={{ bottom: cornerOffset, right: cornerOffset }}
      >
        <OrnamentalCorner size={cornerPx} />
      </span>

      {/* Content stays in normal flow; overflow-visible on parent keeps focus rings */}
      <div className="relative">{children}</div>
    </Tag>
  )
}

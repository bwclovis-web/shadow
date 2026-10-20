import type { CSSProperties } from "react"

import { styleMerge } from "@/utils/styleUtils"

import {
  ORNAMENTAL_CORNER_JOIN,
  ORNAMENTAL_CORNER_VIEWBOX,
  ORNAMENTAL_HERO_CORNER_JOIN,
  ORNAMENTAL_HERO_CORNER_VIEWBOX,
  OrnamentalCorner,
} from "./OrnamentalCorner"

export type OrnamentalOverlaySize = "compact" | "standard" | "hero"

const SIZE_PX: Record<OrnamentalOverlaySize, number> = {
  /** Match pre-hero OrnamentalFrame sizes — do not change card/panel look. */
  compact: 20,
  standard: 28,
  /** Page heroes — larger mockup filigree. */
  hero: 72,
}

export type OrnamentalOverlayProps = {
  size?: OrnamentalOverlaySize
  /**
   * Absolute layer classes. Defaults to `inset-0`.
   * Heroes should stay `inset-0` so joins sit on the true corners.
   */
  className?: string
  /**
   * When true (default), paints the rectangular gold edge.
   * Page heroes use `false` — corner flourishes only (mockup treatment).
   */
  frame?: boolean
}

type CornerPlacement = {
  className?: string
  style: CSSProperties
}

/**
 * Place the TL-authored SVG so its join lands on a box corner, then mirror
 * around that join (not around the element's center/edge).
 */
const cornerPlacements = (sizePx: number, joinPx: number): {
  tl: CornerPlacement
  tr: CornerPlacement
  bl: CornerPlacement
  br: CornerPlacement
} => {
  /** Distance from the mirrored outer edge so the join sits on the box corner. */
  const outer = -(sizePx - joinPx)
  const origin = `${joinPx}px ${joinPx}px`

  return {
    tl: {
      style: { top: -joinPx, left: -joinPx },
    },
    tr: {
      style: {
        top: -joinPx,
        right: outer,
        transform: "scaleX(-1)",
        transformOrigin: origin,
      },
    },
    bl: {
      style: {
        bottom: outer,
        left: -joinPx,
        transform: "scaleY(-1)",
        transformOrigin: origin,
      },
    },
    br: {
      style: {
        bottom: outer,
        right: outer,
        transform: "scale(-1, -1)",
        transformOrigin: origin,
      },
    },
  }
}

/**
 * Paint-only corner flourishes (and optional rectangular frame).
 * `compact` / `standard` keep the original frame corner art.
 * `hero` uses the mockup inward-scroll corner only on page heroes.
 * Absolutely positioned; takes no layout space. Parent must be `relative`.
 */
export const OrnamentalOverlay = ({
  size = "standard",
  className,
  frame = true,
}: OrnamentalOverlayProps) => {
  const isHero = size === "hero"
  const cornerPx = SIZE_PX[size]
  const join = isHero ? ORNAMENTAL_HERO_CORNER_JOIN : ORNAMENTAL_CORNER_JOIN
  const viewBox = isHero
    ? ORNAMENTAL_HERO_CORNER_VIEWBOX
    : ORNAMENTAL_CORNER_VIEWBOX
  const joinPx = (join / viewBox) * cornerPx
  const cornerVariant = isHero ? "hero" : "frame"
  const places = cornerPlacements(cornerPx, joinPx)

  return (
    <div
      aria-hidden
      className={styleMerge(
        "pointer-events-none absolute inset-0 z-[5]",
        isHero ? "text-noir-gold-100" : "text-noir-gold",
        className
      )}
    >
      {frame ? (
        <div className="absolute inset-0 rounded-[1px] border border-current" />
      ) : null}
      <span className="absolute" style={places.tl.style}>
        <OrnamentalCorner size={cornerPx} variant={cornerVariant} />
      </span>
      <span className="absolute" style={places.tr.style}>
        <OrnamentalCorner size={cornerPx} variant={cornerVariant} />
      </span>
      <span className="absolute" style={places.bl.style}>
        <OrnamentalCorner size={cornerPx} variant={cornerVariant} />
      </span>
      <span className="absolute" style={places.br.style}>
        <OrnamentalCorner size={cornerPx} variant={cornerVariant} />
      </span>
    </div>
  )
}

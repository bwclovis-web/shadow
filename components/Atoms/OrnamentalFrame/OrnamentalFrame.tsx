import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react"

import { styleMerge } from "@/utils/styleUtils"

import { OrnamentalCorner } from "./OrnamentalCorner"

export type OrnamentalFrameSize = "compact" | "standard"

type OrnamentalFrameOwnProps<T extends ElementType> = {
  children: ReactNode
  /** `compact` for cards; `standard` for larger panels. */
  size?: OrnamentalFrameSize
  className?: string
  /** Wrapper element. Defaults to `div`. */
  as?: T
  /**
   * When true (default), content is inset and clipped so media stays inside
   * the border. Set false for flex shells (e.g. filter drawer) so children
   * participate in the outer flex layout and dropdowns/focus rings are not
   * clipped — paint corners on `overflow-visible` outer only.
   */
  clipContent?: boolean
}

export type OrnamentalFrameProps<T extends ElementType = "div"> =
  OrnamentalFrameOwnProps<T> &
    Omit<ComponentPropsWithoutRef<T>, keyof OrnamentalFrameOwnProps<T>>

const SIZE_PX: Record<OrnamentalFrameSize, number> = {
  compact: 20,
  standard: 28,
}

/** ViewBox coordinate where the corner join sits in `OrnamentalCorner`. */
const CORNER_JOIN = 3
const VIEWBOX = 32

/**
 * Fine gold rectangular frame with curling corner flourishes.
 * Prefer this when you need the React corner (currentColor, size variants).
 * Global `.noir-border` paints the same SVG flourishes via CSS backgrounds.
 *
 * Intended sizes:
 * - `compact` — discovery cards / listing rows
 * - `standard` — Exchange toolbar, results shell, secondary rails
 *
 * Outer frame stays `overflow-visible` so curls can paint outside; content is
 * inset and clipped so media cannot hang over the border line.
 */
export const OrnamentalFrame = <T extends ElementType = "div">({
  children,
  size = "standard",
  className,
  as,
  clipContent = true,
  ...rest
}: OrnamentalFrameProps<T>) => {
  const Tag = as ?? ("div" as ElementType)
  const cornerPx = SIZE_PX[size]
  /** Place viewBox join (3,3) on the element’s top-left border corner. */
  const cornerOffset = `-${(CORNER_JOIN / VIEWBOX) * cornerPx}px`

  return (
    <Tag
      {...rest}
      className={styleMerge(
        "relative overflow-visible text-noir-gold",
        className
      )}
    >
      {/* Straight frame lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 rounded-[1px] border border-current"
      />

      {/* Four corners: one SVG, mirrored for TR / BL / BR */}
      <span
        aria-hidden
        className="pointer-events-none absolute z-30"
        style={{ top: cornerOffset, left: cornerOffset }}
      >
        <OrnamentalCorner size={cornerPx} />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute z-30 origin-center scale-x-[-1]"
        style={{ top: cornerOffset, right: cornerOffset }}
      >
        <OrnamentalCorner size={cornerPx} />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute z-30 origin-center scale-y-[-1]"
        style={{ bottom: cornerOffset, left: cornerOffset }}
      >
        <OrnamentalCorner size={cornerPx} />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute z-30 origin-center scale-x-[-1] scale-y-[-1]"
        style={{ bottom: cornerOffset, right: cornerOffset }}
      >
        <OrnamentalCorner size={cornerPx} />
      </span>

      {clipContent ? (
        <div className="relative z-0 box-border flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-px">
          {children}
        </div>
      ) : (
        /* `contents` — children join the outer flex shell; no clip box. */
        <>{children}</>
      )}
    </Tag>
  )
}

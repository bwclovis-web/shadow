import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react"

import { styleMerge } from "@/utils/styleUtils"

import {
  OrnamentalOverlay,
  type OrnamentalOverlaySize,
} from "./OrnamentalOverlay"

export type OrnamentalFrameSize = Extract<
  OrnamentalOverlaySize,
  "compact" | "standard"
>

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
 *
 * For page heroes, use `OrnamentalOverlay` (paint-only) instead of wrapping.
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

  return (
    <Tag
      {...rest}
      className={styleMerge(
        "relative overflow-visible text-noir-gold",
        className
      )}
    >
      <OrnamentalOverlay size={size} className="z-20" />

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

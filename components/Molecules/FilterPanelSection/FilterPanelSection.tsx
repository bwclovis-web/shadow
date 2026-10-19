"use client"

import {
  useLayoutEffect,
  useRef,
  type FC,
  type ReactNode,
} from "react"
import { FiChevronDown } from "react-icons/fi"

import { styleMerge } from "@/utils/styleUtils"

export type FilterPanelSectionProps = {
  title: string
  description?: string
  children?: ReactNode
  className?: string
  /** Renders as a native disclosure (title toggles the content). */
  collapsible?: boolean
  /**
   * Initial open state for collapsible sections only.
   * Applied once on mount so unrelated parent rerenders do not reset
   * the user’s expand/collapse choice.
   */
  defaultOpen?: boolean
  /** Leading icon (drawer layout). */
  icon?: ReactNode
  /** Shown on the summary row when the section is collapsed. */
  summary?: string
  /** Compact badge next to the title (e.g. "2 selected"). */
  badge?: string
  /** Drawer mockup: sentence-case gold headings, ivory summary. */
  tone?: "default" | "drawer"
  /** Replaces the chevron (e.g. photos toggle). */
  trailing?: ReactNode
}

export const FilterPanelSection: FC<FilterPanelSectionProps> = ({
  title,
  description,
  children,
  className,
  collapsible = false,
  defaultOpen = true,
  icon,
  summary,
  badge,
  tone = "default",
  trailing,
}) => {
  const drawer = tone === "drawer"
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useLayoutEffect(() => {
    if (!collapsible) return
    const el = detailsRef.current
    if (!el) return
    el.open = defaultOpen
    // Mount-only: do not re-sync when parent rerenders with the same prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [collapsible])

  const descriptionNode = description ? (
    <p
      className={styleMerge(
        "text-xs leading-relaxed",
        drawer ? "text-noir-gold-100/90" : "text-noir-gold-100"
      )}
    >
      {description}
    </p>
  ) : null

  const titleNode = (
    <h3
      className={styleMerge(
        "!mb-0 !pb-0",
        drawer
          ? "!text-[1.375rem] !font-normal !leading-snug capitalize !normal-case tracking-normal text-noir-gold"
          : collapsible
            ? "!text-xl"
            : "uppercase"
      )}
    >
      {title}
    </h3>
  )

  if (collapsible) {
    return (
      <details
        ref={detailsRef}
        className={styleMerge(
          "group",
          drawer
            ? "border-b border-noir-gold/20 bg-noir-dark/55 px-3 py-2 first:rounded-t-sm last:border-b-0"
            : "border-b border-noir-gold/25 pb-4",
          className
        )}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2.5">
            {icon ? (
              <span className="shrink-0 text-noir-gold [&>svg]:h-4 [&>svg]:w-4">
                {icon}
              </span>
            ) : null}
            {titleNode}
            {badge ? (
              <span className="truncate text-xs text-noir-gold-100">
                {badge}
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {summary ? (
              <span className="max-w-[10rem] truncate text-sm text-noir-gold-100 group-open:hidden md:max-w-[14rem]">
                {summary}
              </span>
            ) : null}
            {trailing ?? (
              <FiChevronDown
                className="h-5 w-5 shrink-0 text-noir-gold transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            )}
          </span>
        </summary>
        <div className="space-y-3 pt-2 pb-1">
          {descriptionNode}
          {children ?? null}
        </div>
      </details>
    )
  }

  return (
    <section
      className={styleMerge(
        drawer
          ? "space-y-3 border-b border-noir-gold/20 bg-noir-dark/55 px-3 py-3 last:border-b-0"
          : "space-y-2",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span className="shrink-0 text-noir-gold [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
          ) : null}
          {titleNode}
        </span>
        {trailing}
      </div>
      {descriptionNode}
      {children ?? null}
    </section>
  )
}

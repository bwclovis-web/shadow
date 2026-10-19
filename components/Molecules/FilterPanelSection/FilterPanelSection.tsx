import type { FC, ReactNode } from "react"
import { FiChevronDown } from "react-icons/fi"

import { styleMerge } from "@/utils/styleUtils"

export type FilterPanelSectionProps = {
  title: string
  description?: string
  children?: ReactNode
  className?: string
  /** Renders as a native disclosure (title toggles the content). */
  collapsible?: boolean
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
          ? "!text-base !font-normal capitalize !normal-case tracking-normal md:!text-lg"
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
        open={defaultOpen}
        className={styleMerge(
          "group border-b border-noir-gold/25 pb-4",
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
        <div className="space-y-3 pt-3">
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
          ? "space-y-3 border-b border-noir-gold/25 pb-4"
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

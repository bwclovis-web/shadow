import type { FC, ReactNode } from "react"
import { FiChevronDown } from "react-icons/fi"

import { styleMerge } from "@/utils/styleUtils"

export type FilterPanelSectionProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
  /** Renders as a native disclosure (title toggles the content). */
  collapsible?: boolean
  defaultOpen?: boolean
}


export const FilterPanelSection: FC<FilterPanelSectionProps> = ({
  title,
  description,
  children,
  className,
  collapsible = false,
  defaultOpen = true,
}) => {
  const descriptionNode = description ? (
    <p className="text-xs text-noir-gold-100">{description}</p>
  ) : null

  if (collapsible) {
    return (
      <details
        open={defaultOpen}
        className={styleMerge("group border-b border-noir-gold/25 pb-4", className)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold [&::-webkit-details-marker]:hidden">
          <h3 className="!text-xl">{title}</h3>
          <FiChevronDown
            className="h-5 w-5 shrink-0 text-noir-gold transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-3 pt-3">
          {descriptionNode}
          {children}
        </div>
      </details>
    )
  }

  return (
    <section className={styleMerge("space-y-2", className)}>
      <h3 className="uppercase">
        {title}
      </h3>
      {descriptionNode}
      {children}
    </section>
  )
}

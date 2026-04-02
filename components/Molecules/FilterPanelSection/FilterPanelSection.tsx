import type { FC, ReactNode } from "react"

import { styleMerge } from "@/utils/styleUtils"

export type FilterPanelSectionProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/**
 * Titled block for filter sidebars (CF-010); typography matches noir / exchange surfaces.
 */
export const FilterPanelSection: FC<FilterPanelSectionProps> = ({
  title,
  description,
  children,
  className,
}) => (
  <section className={styleMerge("space-y-2", className)}>
    <h3 className="text-sm font-semibold uppercase tracking-wide text-noir-gold">
      {title}
    </h3>
    {description ? (
      <p className="text-xs text-noir-gold-100">{description}</p>
    ) : null}
    {children}
  </section>
)

export default FilterPanelSection

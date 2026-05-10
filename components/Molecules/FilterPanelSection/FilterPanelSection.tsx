import type { FC, ReactNode } from "react"

import { styleMerge } from "@/utils/styleUtils"

export type FilterPanelSectionProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
}


export const FilterPanelSection: FC<FilterPanelSectionProps> = ({
  title,
  description,
  children,
  className,
}) => (
  <section className={styleMerge("space-y-2", className)}>
    <h3 className="uppercase">
      {title}
    </h3>
    {description ? (
      <p className="text-xs text-noir-gold-100">{description}</p>
    ) : null}
    {children}
  </section>
)

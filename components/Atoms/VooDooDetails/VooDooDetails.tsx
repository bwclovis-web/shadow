import { type VariantProps } from "class-variance-authority"
import { type HTMLProps, type ReactNode } from "react"
import { GiSpiralBottle } from "react-icons/gi"

import { styleMerge } from "~/utils/styleUtils"

import {
  voodooDetailsSummaryVariants,
  voodoodetailsVariants,
} from "./voodoodetails-variants"

type VooDooDetailsProps = HTMLProps<HTMLDetailsElement> &
  VariantProps<typeof voodoodetailsVariants> &
  VariantProps<typeof voodooDetailsSummaryVariants> & {
    summary?: string
    name: string
    children: ReactNode
    defaultOpen?: boolean
  }

const VooDooDetails = ({
  className,
  summary,
  name,
  children,
  type,
  background,
  defaultOpen,
  ...props
}: VooDooDetailsProps) => {
  const detailsVariant = voodoodetailsVariants({ type })
  const summaryVariant = voodooDetailsSummaryVariants({ type, background })
  const detailsClassName = styleMerge(detailsVariant, className)
  const summaryClassName = styleMerge(summaryVariant)

  return (
    <div className="relative group flex items-center">
      <details
        name={name}
        className={detailsClassName}
        data-cy="VooDooDetails"
        open={defaultOpen}
        {...props}
      >
        
        <summary className={summaryClassName}>
        <GiSpiralBottle className="w-10 h-10 self-start group-open:rotate-180 transition-transform duration-300" />
          {summary || "VooDoo Details"}
        </summary>
        {children}
      </details>
    </div>
  )
}
export default VooDooDetails

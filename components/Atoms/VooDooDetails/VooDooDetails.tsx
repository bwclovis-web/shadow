import { type VariantProps } from "class-variance-authority"
import { type HTMLProps, type ReactNode } from "react"
import { GiSpiralBottle } from "react-icons/gi"

import { styleMerge } from "@/utils/styleUtils"

import {
  voodooDetailsSummaryVariants,
  voodoodetailsVariants,
} from "./voodoodetails-variants"

type VooDooDetailsProps = Omit<
  HTMLProps<HTMLDetailsElement>,
  "name"
> &
  VariantProps<typeof voodoodetailsVariants> &
  VariantProps<typeof voodooDetailsSummaryVariants> & {
    summary?: string
    name?: string
    children?: ReactNode
    defaultOpen?: boolean
  }

const VooDooDetails = ({
  className,
  summary,
  name = "voodoo-details",
  children,
  type,
  background,
  defaultOpen,
  ...props
}: VooDooDetailsProps) => {
  const detailsClassName = styleMerge(
    voodoodetailsVariants({ type }),
    className
  )
  const summaryClassName = styleMerge(voodooDetailsSummaryVariants({ type, background }))

  return (
    <details
      className={detailsClassName}
      data-cy="VooDooDetails"
      data-name={name}
      open={defaultOpen === true}
      {...props}
    >
      <summary className={summaryClassName}>
        <GiSpiralBottle
          className="w-10 h-10 shrink-0 self-start transition-transform duration-300 group-open:rotate-180"
          aria-hidden
        />
        {summary ?? "VooDoo Details"}
      </summary>
      {children}
    </details>
  )
}

export default VooDooDetails

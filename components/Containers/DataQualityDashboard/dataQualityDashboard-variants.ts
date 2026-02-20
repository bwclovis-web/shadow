import { cva, type VariantProps } from "class-variance-authority"

export type DataQualityDashboardVariants = VariantProps<
  typeof dataQualityDashboardVariants
>

export const dataQualityDashboardVariants = cva(["w-full"], {
  variants: {
    size: {
      default: "p-6",
      compact: "p-4",
      expanded: "p-8",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

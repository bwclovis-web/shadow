import { cva, type VariantProps } from "class-variance-authority"

export type AdminNavigationVariants = VariantProps<typeof adminNavigationVariants>
export const adminNavigationVariants = cva(
  ["px-2 flex items-center justify-start gap-5 rounded-sm noir-border min-h-max h-full w-full bg-noir-black/80 backdrop-blur-sm px-2",],
  {
    compoundVariants: [{}],
    defaultVariants: {},
    variants: {},
  }
)

import { cva, type VariantProps } from "class-variance-authority"

export type MobileNavigationVariants = VariantProps<typeof mobileNavigationVariants>

export const mobileNavigationVariants = cva([""], {
  compoundVariants: [{}],
  defaultVariants: {},
  variants: {},
})

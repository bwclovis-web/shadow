import { cva, type VariantProps } from "class-variance-authority"

export type GlobalNavigationVariants = VariantProps<typeof globalNavigationVariants>
export const globalNavigationVariants = cva([""], {
  compoundVariants: [{}],
  defaultVariants: {},
  variants: {},
})

import { cva, type VariantProps } from "class-variance-authority"

export type MobileBottomNavigationVariants = VariantProps<
  typeof mobileBottomNavigationVariants
>

export const mobileBottomNavigationVariants = cva([""], {
  compoundVariants: [{}],
  defaultVariants: {},
  variants: {},
})

import { cva, type VariantProps } from "class-variance-authority"

export type TitleBannerVariants = VariantProps<typeof titlebannerVariants>
export const titlebannerVariants = cva([""], {
  compoundVariants: [{}],
  defaultVariants: {},
  variants: {},
})

import { cva, type VariantProps } from "class-variance-authority"

export type TagSearchVariants = VariantProps<typeof tagSearchVariants>
export const tagSearchVariants = cva(["flex flex-col relative min-h-45"], {
  compoundVariants: [{}],
  defaultVariants: {},
  variants: {},
})

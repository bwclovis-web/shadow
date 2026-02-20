import { cva, type VariantProps } from "class-variance-authority"

export type RadioSelectVariants = VariantProps<typeof radioSelectVariants>
export const radioSelectVariants = cva(
  ["flex flex-col items-center justify-center"],
  {
    compoundVariants: [{}],
    defaultVariants: {},
    variants: {},
  }
)

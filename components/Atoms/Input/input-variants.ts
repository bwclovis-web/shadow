import { cva, type VariantProps } from "class-variance-authority"

export type InputVariants = VariantProps<typeof inputVariants>

export const inputVariants = cva(
  [
    "w-full border-double border-8 rounded-sm px-2 py-1 text-lg  text-noir-dark",
    "transition-all focus:outline-none focus:ring font-semibold ",
  ],
  {
    compoundVariants: [{}],
    defaultVariants: {},
    variants: {
      shading: {
        true: "bg-noir-gold text-noir-dark focus:bg-noir-gold-500 focus:ring-noir-gold focus:border-noir-gold-500",
        false: "bg-noir-gray/10 dark:bg-noir-gray/30",
      },
    },
  }
)

import { cva, type VariantProps } from "class-variance-authority"

export type SearchBarVariants = VariantProps<typeof searchbarVariants>
export const searchbarVariants = cva(
  [
    "w-full bg-noir-black/90  px-2 transition-all duration-300 text-noir-gold-100",
    "border border-noir-gold py-2 md:py-5 md:text-xl font-semibold outline-[0] rounded-tr-sm rounded-br-sm"
  ],
  {
    compoundVariants: [{}],
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "rounded-sm",
        animated: "rounded-sm border-double border-4 focus:animate-pulse",
        home: "focus:outline-[4000px] focus:outline-noir-gold/90 focus:bg-noir-dark",
        flat: "rounded-tr-sm rounded-br-sm",
      },
    },
  }
)

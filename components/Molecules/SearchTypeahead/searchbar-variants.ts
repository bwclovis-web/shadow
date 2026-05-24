import { cva, type VariantProps } from "class-variance-authority"

export type SearchBarVariants = VariantProps<typeof searchbarVariants>

/** Shared input chrome for `SearchTypeahead` and filter search fields (matches house/perfume `SearchBar`). */
export const searchbarVariants = cva(
  [
    "w-full bg-noir-black/90 px-2 transition-all duration-300 text-noir-gold-100",
    "border border-noir-gold font-semibold outline-[0] rounded-tr-sm rounded-br-sm",
  ],
  {
    defaultVariants: {
      variant: "default",
      size: "hero",
    },
    variants: {
      variant: {
        default: "rounded-sm",
        animated: "rounded-sm border-double border-4 focus:animate-pulse",
        home: "focus:outline-[4000px] focus:outline-noir-gold/90 focus:bg-noir-dark",
        flat: "rounded-tr-sm rounded-br-sm",
      },
      size: {
        /** Home / listing hero search (large touch target on `md+`). */
        hero: "py-2 md:py-3 md:text-xl",
        /** Forms, filters, admin — same look, smaller vertical rhythm. */
        standard: "py-2 text-sm md:text-base",
      },
    },
  }
)

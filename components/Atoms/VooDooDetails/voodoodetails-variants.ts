import { cva, type VariantProps } from "class-variance-authority"

export type VooDooDetailsVariants = VariantProps<typeof voodoodetailsVariants>
export const voodoodetailsVariants = cva(
  [
    "group relative ring ring-noir-gold/30 w-full overflow-hidden rounded-lg transition-all duration-300",
    "focus-within:ring-2 focus-within:ring-noir-gold/20 focus-within:ring-offset-2 focus-within:ring-offset-noir-black",
  ],
  {
    variants: {
      type: {
        primary:
          "bg-noir-black/70 text-noir-gold-100",
        secondary:
          "bg-noir-dark/70 text-noir-gold-200",
      },
    },
    defaultVariants: {
      type: "primary",
    },
  }
)

export const voodooDetailsSummaryVariants = cva(
  [
    "flex cursor-pointer items-center gap-3  py-3 uppercase tracking-widest transition-colors duration-200",
    "text-sm font-semibold outline-none group-open:text-noir-gold-300 px-1",
  ],
  {
    variants: {
      type: {
        primary:
          "text-noir-gold-100",
        secondary:
          "text-noir-gold-300/80",
      },
      background: {
        dark:
          "bg-noir-gold border-noir-gold-500 border-2 group-open:border-none group-open:shadow-none shadow shadow-xl shadow-black hover:bg-noir-gold-100 text-noir-dark group-open:hover:text-noir-dark group-open:bg-noir-black/60 group-open:text-noir-gold-100",
        light:
          "bg-noir-light/10 text-noir-dark border-b border-noir-gold/30 group-open:bg-noir-light/20",
      },
    },
    defaultVariants: {
      type: "primary",
      background: "dark",
    },
  }
)

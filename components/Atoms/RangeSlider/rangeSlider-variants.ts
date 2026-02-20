import { cva, type VariantProps } from "class-variance-authority"

export const rangeSliderWrapVariants = cva(["relative", "w-full", "select-none"], {
  compoundVariants: [{}],
  defaultVariants: {
    size: "medium",
  },
  variants: {
    size: {
      small: "h-4",
      medium: "h-6",
      large: "h-8",
    },
  },
})

export type RangeSliderWrapVariants = VariantProps<typeof rangeSliderWrapVariants>

export const rangeSliderVariants = cva(
  ["absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 rounded-full cursor-pointer transition-colors",],
  {
    compoundVariants: [{}],
    defaultVariants: {
      theme: "light",
    },
    variants: {
      theme: {
        default: "bg-noir-dark",
        dark: "bg-noir-dark",
        light:
          "bg-noir-gold-100 focus:outline-none focus:ring-2 focus:ring-noir-gold focus:ring-offset-2",
      },
    },
  }
)

export type RangeSliderVariants = VariantProps<typeof rangeSliderVariants>

export const rangeSliderFillVariants = cva(
  ["absolute top-0 left-0 h-full rounded-full transition-all"],
  {
    compoundVariants: [{}],
    defaultVariants: {
      theme: "light",
    },
    variants: {
      theme: {
        default: "bg-noir-dark",
        dark: "bg-noir-gold-500",
        light: "bg-noir-gold-500",
      },
    },
  }
)

export const rangeSliderMaxVariants = cva(["flex justify-between text-xs "], {
  compoundVariants: [{}],
  defaultVariants: {
    theme: "light",
  },
  variants: {
    theme: {
      default: "bg-noir-dark",
      dark: "text-noir-black",
      light: "text-noir-gold-500",
    },
  },
})

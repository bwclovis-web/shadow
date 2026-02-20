import { cva, type VariantProps } from "class-variance-authority"

export type WishlistVariants = VariantProps<typeof wishlistVariants>

export const wishlistVariants = cva(
  ["rounded-lg shadow-md overflow-hidden border transition-all duration-300 my-10 relative",],
  {
    compoundVariants: [{}],
    defaultVariants: {
      isAvailable: false,
    },
    variants: {
      isAvailable: {
        true: "bg-gradient-to-br from-noir-gold to-noir-gold-100 border-noir-gold-500 shadow-noir-dark",
        false: "bg-noir-dark",
      },
    },
  }
)

export const wishlistHouseVariants = cva(["text-sm  mb-2"], {
  compoundVariants: [{}],
  defaultVariants: {
    isAvailable: false,
  },
  variants: {
    isAvailable: {
      true: "text-noir-dark",
      false: "text-noir-gold",
    },
  },
})

export const wishlistAddedVariants = cva(["text-xs"], {
  compoundVariants: [{}],
  defaultVariants: {
    isAvailable: false,
  },
  variants: {
    isAvailable: {
      true: "text-noir-black",
      false: "text-noir-gold-500",
    },
  },
})

export const wishlistVisibilityVariants = cva(["text-xs font-semibold"], {
  compoundVariants: [{}],
  defaultVariants: {
    isAvailable: false,
  },
  variants: {
    isAvailable: {
      true: "text-noir-dark",
      false: "text-noir-gold-500",
    },
  },
})

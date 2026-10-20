import { cva, type VariantProps } from "class-variance-authority"

export type WishlistVariants = VariantProps<typeof wishlistVariants>

/** Seeking card shell: charcoal frame, burgundy body — no whole-card gold fill. */
export const wishlistVariants = cva(
  [
    "relative flex h-full w-full max-w-md flex-col overflow-hidden",
    "border border-noir-gold/60 bg-noir-black/40 shadow-lg shadow-black/40",
    "transition-colors duration-300 hover:border-noir-gold",
  ],
  {
    defaultVariants: {
      isAvailable: false,
    },
    variants: {
      isAvailable: {
        true: "",
        false: "",
      },
    },
  }
)

export const wishlistBadgeVariants = cva(
  [
    "absolute right-2 top-2 z-10 rounded border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
  ],
  {
    defaultVariants: {
      isAvailable: false,
    },
    variants: {
      isAvailable: {
        true: "border-noir-gold/70 bg-noir-black/75 text-noir-gold",
        false: "border-noir-gold/30 bg-noir-black/70 text-noir-gold-100",
      },
    },
  }
)

export const wishlistBodyVariants = cva(
  ["flex flex-1 flex-col gap-3 border-t border-noir-gold/40 bg-noir-dark px-3 py-3 md:px-4"],
  {
    defaultVariants: {},
    variants: {},
  }
)

import { cva } from "class-variance-authority"

export const virtualScrollVariants = cva("overflow-auto", {
  variants: {
    size: {
      sm: "h-64",
      md: "h-96",
      lg: "h-[600px]",
      xl: "h-[800px]",
      full: "h-full",
    },
    variant: {
      default: "scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200",
      dark: "scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800",
      custom: "",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
  },
})

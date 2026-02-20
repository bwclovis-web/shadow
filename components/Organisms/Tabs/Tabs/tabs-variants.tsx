import { cva, VariantProps } from "class-variance-authority"

export type TabsVariants = VariantProps<typeof tabsVariants>
export const tabsVariants = cva(["flex w-full list-none"], {
  compoundVariants: [{}],
  defaultVariants: {
    align: "horizontal",
    size: "md",
  },
  variants: {
    align: {
      horizontal: "flex-row",
      vertical: "flex-col",
    },
    background: {
      white: "bg-white",
    },
    size: {
      lg: "text-lg",
      md: "text-md",
      sm: "text-sm",
    },
    type: {
      default: "gap-5 justify-around items-center",
      secondary: "gap-0",
    },
  },
})

export const tabsPanelVariants = cva(["focus:outline-none "], {
  compoundVariants: [{}],
  defaultVariants: {},
  variants: {
    type: {
      default: "w-full",
      secondary:
        "bg-white p-4 border-atom-gray-4 rounded-b-lg rounded-tr-lg border-l border-r",
    },
  },
})

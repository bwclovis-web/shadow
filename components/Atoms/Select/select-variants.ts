import { cva, type VariantProps } from "class-variance-authority"

export type SelectWrapperVariants = VariantProps<typeof selectWrapperVariants>
export type SelectVariants = VariantProps<typeof selectVariants>
export const selectWrapperVariants = cva(["flex flex-col bg-noir-black/90 py-0 h-auto max-w-max"], {
  compoundVariants: [{}],
  defaultVariants: {},
  variants: {
    size: {
      default: "w-1/4 pr-2",
      expanded: "w-full border border-noir-gold pr-4 md:rounded-tl-sm md:rounded-bl-sm md:rounded-tr-none md:rounded-br-none rounded-xl self-center md:self-end",
    },
  },
})

export const selectVariants = cva(
  ['cursor-pointer relative rounded-tl-sm rounded-bl-sm px-2.5 text-noir-gold border border-noir-gold'],
  {
    compoundVariants: [{}],
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "px-2.5 py-2.5 ",
        compact: "px-1.5 py-1.5 rounded-tl-sm rounded-bl-sm",
        expanded:
          "md:px-3 py-2 md:py-5 px-2.5 border-r-0 font-semibold md:text-xl border-0 w-full pr-4 focus:outline-none focus:ring-0 focus:border-0",
      },
    },
  }
)

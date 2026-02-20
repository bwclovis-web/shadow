import { cva, type VariantProps } from "class-variance-authority"

export type CheckBoxVariants = VariantProps<typeof checkboxVariants>
export const checkboxVariants = cva(["flex gap-3 items-center"], {
  compoundVariants: [{}],
  defaultVariants: {},
  variants: {
    labelPosition: {
      top: "flex-col",
      bottom: "flex-col-reverse",
      right: "flex-row-reverse justify-end",
    },
  },
})

export const checkboxLabelVariants = cva(["text-noir-gold-100"], {
  compoundVariants: [{}],
  defaultVariants: {
    labelSize: "md",
  },
  variants: {
    labelSize: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
})

export const checkboxInputVariants = cva(
  ["appearance-none w-4 h-4 border-2 border-atom-gray-13 rounded-sm bg-white cursor-pointer",],
  {
    compoundVariants: [{}],
    defaultVariants: {
      inputSize: "md",
      inputType: "wild",
    },
    variants: {
      inputSize: {
        sm: "text-sm",
        md: "w-6 h-6",
        lg: "text-lg",
      },
      inputType: {
        default:
          "transition-all checked:bg-blue-primary checked:border-blue-active checked:focus:ring-blue-primary",
        wild: 'rounded-full gap-2 text-noir-gold-100 grid place-content-center before:rounded-full before:inset-shadow-xl before:bg-noir-dark before:content-[""] before:w-4 before:h-4 before:scale-0 before:transition-all checked:before:scale-100 checked:border-noir-gold',
      },
    },
  }
)

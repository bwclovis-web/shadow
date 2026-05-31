import { cva, type VariantProps } from "class-variance-authority"

export type ButtonVariants = VariantProps<typeof buttonVariants>

export const buttonVariants = cva(
  ["rounded-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed border w-full md:w-auto",],
  {
    compoundVariants: [{}],
    defaultVariants: {
      size: "md",
      variant: "primary",
    },
    variants: {
      size: {
        xs: "text-xs px-1 py-0.5",
        sm: "text-sm px-1.25 py-1",
        md: "text-base px-2 py-1",
        lg: "text-lg px-2.5 py-1.5",
        xl: "text-2xl px-2 py-2",
      },
      variant: {
        primary:
          "bg-noir-gold capitalize text-noir-black font-semibold hover:bg-noir-gold/80 transition-all",
        secondary:
          "bg-noir-dark hover:bg-noir-black focus:bg-noir-black disabled:bg-noir-black text-noir-gold-500 hover:text-noir-gold-100  border-noir-gold hover:border-noir-gold-500",
        alphabeticalNav:
          "group isolate overflow-hidden rounded-md px-3 py-2 font-medium relative bg-noir-dark text-noir-gold hover:bg-noir-gold/20 noir-outline border-noir-gold " +
          "shadow-md shadow-noir-dark/60 hover:shadow-lg hover:border-noir-gold-500 active:bg-noir-gold/20 active:text-noir-black " +
          "transition-[transform,background-color,border-color,color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
        danger:
          "bg-btn-danger hover:bg-btn-danger-hover focus:bg-btn-danger-focus disabled:bg-btn-danger-disabled text-white",
        link: "bg-transparent border-none text-blue-200 font-semibold hover:underline hover:text-noir-gold-500 disabled:bg-transparent text-nowrap px-0",
        icon: "block bg-transparent flex items-center justify-center rounded-sm transition-all duration-300 ease-in-out  disabled:bg-transparent font-medium border gap-3",
      },
      leftIcon: {
        true: "flex items-center justify-between gap-2",
      },
      rightIcon: {
        true: "flex items-center justify-between gap-2",
      },
      background: {
        red: "bg-red-800 hover:bg-red-700 focus:bg-red-800 disabled:bg-red-400 text-white w-full md:w-auto",
        gold: "border w-full text-shadow-md text-shadow-noir-dark/60 border-noir-gold bg-noir-gold/10 text-noir-gold-100 hover:border-noir-gold-500 hover:text-noir-gold-500 hover:bg-noir-gold-500/20  focus:bg-noir-gold/20 transition-all duration-300 ease-in-out gap-4",
      },
    },
  }
)

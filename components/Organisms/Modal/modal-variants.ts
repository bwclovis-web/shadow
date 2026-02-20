import { cva, type VariantProps } from "class-variance-authority"
export type ModalBackgroundVariant = VariantProps<typeof modalBackgroundVariant>
export type ModalContentVariant = VariantProps<typeof modalContentVariant>
export type ModalProps = ModalBackgroundVariant & ModalContentVariant

export const modalBackgroundVariant = cva(
  ["fixed w-full h-full z-20 transition-all top-0 "],
  {
    compoundVariants: [
      {
        animateStart: "top",
        background: "default",
        className: "backdrop-blur-xs bg-noir-dark/50",
      },
    ],
    defaultVariants: {
      animate: false,
      background: "default",
    },
    variants: {
      animate: {
        false: "opacity-0",
        true: "opacity-100 transition-all",
      },
      animateStart: {
        bottom: "bottom-0",
        left: "right-0",
        top: "top-0",
      },
      background: {
        default: "bg-noir-dark/50 backdrop-blur-xs",
        light: "bg-white/80",
        purple: "bg-purple-700/50",
      },
    },
  }
)

export const modalContentVariant = cva(
  ["fixed max-h-full z-30 rounded transition-all delay-300 py-2 pb-10 xl:p-8 duration-500 w-full lg:w-4/5 xl:w-2/5 pointer-none flex"],
  {
    compoundVariants: [
      {
        animate: false,
        animateStart: "top",
        className: "top-[0%]",
      },
      {
        animate: true,
        animateStart: "top",
        className: "top-[20%] md:top-[30%] max-h-[80vh] overflow-y-auto fixed",
      },
      {
        animate: false,
        animateStart: "bottom",
        className: "lg:translate-y-0 h-0",
      },
      {
        animate: true,
        animateStart: "bottom",
        className: "lg:translate-y-[150%] delay-200 top-[20%]",
      },
      {
        animate: false,
        animateStart: "left",
        className: "translate-x-[100%] h-0 h-full",
      },
      {
        animate: true,
        animateStart: "left",
        className: "translate-x-[0%] delay-200",
      },
    ],
    defaultVariants: {
      animate: false,
      animateStart: "top",
      innerType: "default",
    },
    variants: {
      animate: {
        false: "opacity-0",
        true: "opacity-100 transition-animate shadow-2xl ",
      },
      animateStart: {
        bottom:
          "w-full sm:w-11/12 lg:w-4/5 xl:w-2/5 duration-500 rounded mx-2 sm:mx-4",
        left: "w-full lg:w-1/3 xl2:w-1/4 right-0 top-0 duration-300 h-full",
        top: "w-full sm:w-11/12 lg:w-4/5 xl:w-3/5 duration-500 rounded mx-2 sm:mx-4",
      },
      innerType: {
        default: "bg-noir-light text-gray-900 p-4 sm:p-6",
        light: "bg-white p-4 sm:p-6",
        dark: "bg-noir-black text-gray-100 noir-border p-4 sm:p-6",
        slate: "bg-slate-800 text-slate-100 p-4 sm:p-6",
      },
    },
  }
)

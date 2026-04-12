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
        panelLeft: "left-0 top-0",
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
  [
    "fixed z-30 flex min-h-0 flex-col pointer-events-auto rounded py-2 pb-10 transition-all delay-300 duration-500 xl:p-8",
  ],
  {
    compoundVariants: [
      {
        animate: false,
        animateStart: "top",
        className:
          "left-1/2 top-1/2 max-h-[min(90vh,100dvh)] w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain",
      },
      {
        animate: true,
        animateStart: "top",
        className:
          "left-1/2 top-1/2 max-h-[min(90vh,100dvh)] w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain",
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
      {
        animate: false,
        animateStart: "panelLeft",
        className:
          "left-0 top-0 h-full max-h-[100dvh] w-full -translate-x-full overflow-y-auto overscroll-contain",
      },
      {
        animate: true,
        animateStart: "panelLeft",
        className:
          "left-0 top-0 h-full max-h-[100dvh] w-full translate-x-0 overflow-y-auto overscroll-contain delay-200",
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
        panelLeft:
          "w-full min-w-0 sm:max-w-md lg:max-w-lg duration-300 rounded-r-md sm:rounded-r-lg",
        top: "w-full sm:w-11/12 lg:w-4/5 xl:w-3/5 duration-500 rounded",
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

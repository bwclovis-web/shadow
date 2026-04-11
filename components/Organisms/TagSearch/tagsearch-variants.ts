import { cva } from "class-variance-authority"

/**
 * Shell styles for the tag picker: frame, spacing, and room for the footer strip
 * when `selectedLayout="footer"`.
 */
export const tagSearchVariants = cva(
  "relative isolate flex w-full flex-col gap-4 transition-[box-shadow,background-color,border-color]",
  {
    variants: {
      surface: {
        light:
          "rounded-xl border border-noir-gold/30 bg-gradient-to-b from-noir-black to-noir-dark p-4 shadow-sm ring-1 ring-noir-gold/20",
        dark:
          "noir-border rounded-xl bg-gradient-to-b from-noir-black via-noir-black to-noir-dark p-4 shadow-lg ring-1 ring-noir-gold/20",
      },
      layout: {
        /** Space for `TagList` absolutely positioned at the bottom */
        footer: "min-h-[13rem] pb-[6.75rem]",
        /** Selected tags stack directly under the typeahead */
        flow: "min-h-0 pb-0",
      },
    },
    defaultVariants: {
      surface: "light",
      layout: "footer",
    },
  }
)

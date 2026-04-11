/** Shared list panel + row styles for all debounced typeaheads (perfume, house, notes). */

export const typeaheadPanelClasses = {
  hero: "bg-noir-dark rounded-b-md border-l-8 border-b-8 border-r-8 border-noir-gold/80 border-double max-h-52 overflow-y-auto shadow-2xl outline-none",
  dark: "rounded-b-md border border-stone-600 bg-stone-800 text-noir-gold-100 max-h-52 overflow-y-auto shadow-lg outline-none",
  light:
    "rounded-b-md border border-transparent bg-noir-light max-h-52 overflow-y-auto shadow-lg outline-none z-50",
} as const

export const typeaheadItemRowClasses = {
  hero: "p-2 text-noir-gold-100 hover:bg-noir-gold hover:text-noir-black font-semibold cursor-pointer last-of-type:rounded-b-md transition-colors",
  dark: "p-2 cursor-pointer text-noir-gold-100 last-of-type:rounded-b-md hover:bg-stone-700",
  light: "hover:bg-noir-dark/50 hover:text-noir-light last-of-type:rounded-b-md",
} as const

export type TypeaheadSurface = keyof typeof typeaheadPanelClasses

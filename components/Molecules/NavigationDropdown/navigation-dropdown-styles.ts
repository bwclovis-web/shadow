export type NavigationDropdownVariant = "desktop" | "mobile"

export const getNavigationDropdownStyles = (variant: NavigationDropdownVariant) => ({
  baseClasses:
    variant === "mobile"
      ? "block text-noir-gold hover:text-noir-light text-lg lg:py-4 py-1 px-4 border border-transparent transition-colors duration-400 rounded-lg mobile-touch-target hover:bg-noir-black/30 w-full text-left"
      : "text-noir-gold hover:text-noir-light text-lg px-2 py-1 border border-transparent transition-colors duration-400 block text-center",
  dropdownClasses:
    variant === "mobile"
      ? "absolute top-full left-0 w-full bg-noir-dark border border-noir-light/20 rounded-lg shadow-lg z-50"
      : "absolute top-full left-0 mt-2 min-w-[12rem] w-max max-w-xs bg-noir-dark border border-noir-light/20 rounded-lg shadow-lg z-50",
  linkClasses:
    variant === "mobile"
      ? "block text-noir-gold hover:text-noir-light text-base py-3 px-4 transition-colors duration-400 hover:bg-noir-black/30"
      : "block text-noir-gold hover:text-noir-light text-base py-2 px-4 transition-colors duration-400 hover:bg-noir-black/30 whitespace-nowrap",
  activeLinkClasses:
    variant === "mobile"
      ? "text-noir-dark text-shadow-none bg-noir-gold/80 border-2 border-noir-gold"
      : "text-noir-light bg-noir-black/30",
})

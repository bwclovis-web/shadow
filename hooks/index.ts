// Existing hooks
export { useHouse } from "./useHouse"
export { useHouses } from "./useHouses"
export { useHousesByLetter } from "./useHousesByLetter"
export { useInfiniteHouses } from "./useInfiniteHouses"
export {
  useInfinitePerfumesByHouse,
  useInfinitePerfumesByLetter,
} from "./useInfinitePerfumes"
export { default as useLetterSelection } from "./useLetterSelection"
export { usePerfume } from "./usePerfume"
export { usePerfumesByLetter } from "./usePerfumesByLetter"
export { useTrader } from "./useTrader"
export { useWishlistStatus } from "./useWishlistStatus"

// New extracted hooks
export { default as useDebounce } from "./useDebounce"
export {
  useApiErrorHandler,
  useAsyncErrorHandler,
  useErrorHandler,
  useFormErrorHandler,
} from "./useErrorHandler"
export { default as useFormState } from "./useFormState"
export { default as useLocalStorage } from "./useLocalStorage"
export { default as useOptimisticUpdate } from "./useOptimisticUpdate"
export { default as usePasswordStrength } from "./usePasswordStrength"
export { usePerfumeComments } from "./usePerfumeComments"
export { default as useRatingSystem } from "./useRatingSystem"
export { default as useServerError } from "./useServerError"
export { default as useToggle } from "./useToggle"
export { default as useMediaQuery, useResponsivePageSize } from "./useMediaQuery"
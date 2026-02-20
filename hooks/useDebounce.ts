import { useEffect, useState } from "react"

export interface UseDebounceOptions {
  delay?: number
  leading?: boolean
  trailing?: boolean
}

export interface UseDebounceReturn<T> {
  debouncedValue: T
  isDebouncing: boolean
  cancel: () => void
}

/**
 * Custom hook for debouncing values with configurable options
 *
 * @param value - The value to debounce
 * @param options - Configuration options for debouncing
 * @returns Debounced value and utilities
 */
export const useDebounce = <T>(
  value: T,
  options: UseDebounceOptions = {}
): UseDebounceReturn<T> => {
  const { delay = 300, leading = false, trailing = true } = options

  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const [isDebouncing, setIsDebouncing] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
      setIsDebouncing(false)
    }
  }

  useEffect(() => {
    // Clear existing timeout
    cancel()

    // If leading is true, update immediately
    if (leading && value !== debouncedValue) {
      setDebouncedValue(value)
    }

    // Set up new timeout
    if (value !== debouncedValue) {
      setIsDebouncing(true)
      const newTimeoutId = setTimeout(() => {
        if (trailing) {
          setDebouncedValue(value)
        }
        setIsDebouncing(false)
        setTimeoutId(null)
      }, delay)
      setTimeoutId(newTimeoutId)
    }

    return cancel
  }, [
value, delay, leading, trailing, debouncedValue, cancel
])

  return {
    debouncedValue,
    isDebouncing,
    cancel,
  }
}

export default useDebounce

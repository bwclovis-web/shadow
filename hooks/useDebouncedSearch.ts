"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface UseDebouncedSearchOptions {
  delay?: number
  minLength?: number
  /** Sync from external source (e.g. URL search param). When this changes, searchValue is updated. */
  initialValue?: string
  /**
   * Controlled query string. When set, the hook uses `value` for debounced fetches and calls
   * `onValueChange` from `setSearchValue` instead of internal state.
   */
  value?: string
  onValueChange?: (next: string) => void
}

export function useDebouncedSearch<T = unknown>(
  searchFn: (query: string) => Promise<T[]>,
  options: UseDebouncedSearchOptions = {}
) {
  const { delay = 300, minLength = 2, initialValue, value, onValueChange } =
    options
  const [uncontrolledValue, setUncontrolledValue] = useState(
    initialValue ?? ""
  )
  const controlled = value !== undefined
  const searchValue = controlled ? value : uncontrolledValue

  const setSearchValue = useCallback(
    (next: string) => {
      if (controlled) {
        onValueChange?.(next)
      } else {
        setUncontrolledValue(next)
      }
    },
    [controlled, onValueChange]
  )

  const [results, setResults] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestGen = useRef(0)
  const searchFnRef = useRef(searchFn)
  searchFnRef.current = searchFn

  useEffect(() => {
    if (!controlled && initialValue !== undefined) {
      setUncontrolledValue(initialValue)
    }
  }, [initialValue, controlled])

  const clearResults = useCallback(() => {
    requestGen.current += 1
    setResults([])
    setError(null)
  }, [])

  const cancelPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    requestGen.current += 1
  }, [])

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const trimmed = searchValue.trim()
    if (trimmed.length < minLength) {
      requestGen.current += 1
      setResults([])
      setError(null)
      setIsLoading(false)
      return
    }

    const gen = ++requestGen.current
    setIsLoading(true)
    setError(null)

    timeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const data = await searchFnRef.current(trimmed)
          if (gen !== requestGen.current) return
          setResults(Array.isArray(data) ? data : [])
        } catch (err) {
          if (gen !== requestGen.current) return
          setError(err instanceof Error ? err.message : "Search failed")
          setResults([])
        } finally {
          if (gen === requestGen.current) setIsLoading(false)
        }
      })()
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      // Invalidate in-flight responses from this effect instance.
      if (gen === requestGen.current) {
        requestGen.current += 1
      }
    }
  }, [searchValue, delay, minLength])

  return {
    searchValue,
    setSearchValue,
    results,
    isLoading,
    error,
    clearResults,
    cancelPending,
  }
}

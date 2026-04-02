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
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!controlled && initialValue !== undefined) {
      setUncontrolledValue(initialValue)
    }
  }, [initialValue, controlled])

  const clearResults = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  const cancelPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const trimmed = searchValue.trim()
    if (trimmed.length < minLength) {
      setResults([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await searchFn(trimmed)
        setResults(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed")
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, delay)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [searchValue, delay, minLength, searchFn])

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

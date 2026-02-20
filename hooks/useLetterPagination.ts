import { useCallback, useEffect, useRef, useState } from "react"

interface UseLetterPaginationOptions {
  letter: string | null
  endpoint: string
  itemName: "perfumes" | "houses"
  pageSize?: number
  houseType?: string
  initialPage?: number
}

interface UseLetterPaginationReturn<T> {
  data: T[]
  loading: boolean
  error: string | null
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    hasNextPage: boolean
    hasPrevPage: boolean
    pageSize: number
  }
  loadPage: (page: number) => Promise<void>
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
}

export function useLetterPagination<T>({
  letter,
  endpoint,
  itemName,
  pageSize = 16,
  houseType = "all",
  initialPage = 1,
}: UseLetterPaginationOptions): UseLetterPaginationReturn<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalCount, setTotalCount] = useState(0)
  const previousLetterRef = useRef<string | null>(null)
  const previousInitialPageRef = useRef<number>(initialPage)
  const isInternalPageChangeRef = useRef<boolean>(false)

  const fetchPageData = useCallback(
    async (page: number): Promise<{ items: T[]; count: number } | null> => {
      const skip = (page - 1) * pageSize
      const url = `${endpoint}?letter=${letter}&skip=${skip}&take=${pageSize}&houseType=${houseType}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch ${itemName}: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message || `Failed to fetch ${itemName}`)
      }

      const items = result[itemName] || []
      const count = result.meta?.totalCount || result.count || 0
      return { items, count }
    },
    [
      letter,
      endpoint,
      pageSize,
      houseType,
      itemName,
    ]
  )

  const loadPage = useCallback(async (page: number, isInternal = false) => {
    if (!letter) {
      setData([])
      setTotalCount(0)
      setCurrentPage(1)
      return
    }

    // Mark as internal change to prevent double-loading from URL sync
    if (isInternal) {
      isInternalPageChangeRef.current = true
    }

    setLoading(true)
    setError(null)
    try {
      const pageData = await fetchPageData(page)
      if (pageData) {
        setData(pageData.items)
        setTotalCount(pageData.count)
        setCurrentPage(page)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${itemName}`)
      setData([])
    } finally {
      setLoading(false)
      
      // Reset the internal flag after a short delay
      if (isInternal) {
        setTimeout(() => {
          isInternalPageChangeRef.current = false
        }, 100)
      }
    }
  }, [
    letter,
    fetchPageData,
    itemName,
  ])

  const nextPage = useCallback(async () => {
    const totalPages = Math.ceil(totalCount / pageSize)
    if (currentPage < totalPages) {
      await loadPage(currentPage + 1, true)
    }
  }, [
    currentPage,
    totalCount,
    pageSize,
    loadPage,
  ])

  const prevPage = useCallback(async () => {
    if (currentPage > 1) {
      await loadPage(currentPage - 1, true)
    }
  }, [
    currentPage,
    loadPage,
  ])

  // Reset to page 1 when letter changes (ignore initialPage on letter change)
  useEffect(() => {
    if (previousLetterRef.current !== letter) {
      previousLetterRef.current = letter
      if (letter) {
        // Always start at page 1 when letter changes, not initialPage
        setCurrentPage(1)
        loadPage(1)
      } else {
        setData([])
        setTotalCount(0)
        setCurrentPage(1)
      }
    }
  }, [letter, loadPage])

  // Update page when initialPage changes (from URL)
  // Skip if this is an internal page change to avoid double-loading
  useEffect(() => {
    if (previousInitialPageRef.current !== initialPage && letter && !loading) {
      // Skip loading if this change was triggered by our internal pagination
      if (isInternalPageChangeRef.current) {
        previousInitialPageRef.current = initialPage
        return
      }

      // Only load if the page actually changed
      if (currentPage !== initialPage) {
        previousInitialPageRef.current = initialPage
        loadPage(initialPage, false)
      } else {
        // Just update the ref to track the change without loading
        previousInitialPageRef.current = initialPage
      }
    }
  }, [
    initialPage,
    letter,
    loadPage,
    currentPage,
    loading,
  ])

  // Reload when houseType changes
  useEffect(() => {
    if (letter) {
      loadPage(1)
    }
  }, [houseType, letter, loadPage])

  const totalPages = Math.ceil(totalCount / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  return {
    data,
    loading,
    error,
    pagination: {
      currentPage,
      totalPages,
      totalCount,
      hasNextPage,
      hasPrevPage,
      pageSize,
    },
    loadPage,
    nextPage,
    prevPage,
  }
}


import { useEffect, useMemo } from "react"

type ExtractItemsFn<TPage, TItem> = (page: TPage) => TItem[]

type ExtractTotalCountFn<TPage> = (page: TPage | undefined) => number | undefined

interface UseInfinitePaginationOptions<TPage, TItem> {
  pages?: TPage[]
  currentPage: number
  pageSize: number
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage?: boolean
  fetchNextPage: () => Promise<unknown>
  extractItems: ExtractItemsFn<TPage, TItem>
  extractTotalCount?: ExtractTotalCountFn<TPage>
}

interface PaginationState {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface UseInfinitePaginationResult<TItem> {
  items: TItem[]
  pagination: PaginationState
  loading: boolean
}

export function useInfinitePagination<TPage, TItem>({
  pages,
  currentPage,
  pageSize,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  extractItems,
  extractTotalCount,
}: UseInfinitePaginationOptions<TPage, TItem>): UseInfinitePaginationResult<TItem> {
  const allItems = useMemo(() => {
    if (!pages?.length) {
      return [] as TItem[]
    }

    return pages.flatMap(page => extractItems(page))
  }, [pages, extractItems])

  const totalCount = useMemo(() => {
    if (extractTotalCount) {
      return extractTotalCount(pages?.[0]) ?? allItems.length
    }

    const firstPage = pages?.[0] as { count?: number; meta?: { totalCount?: number } } | undefined
    if (firstPage?.meta?.totalCount !== undefined) {
      return firstPage.meta.totalCount
    }
    if (typeof firstPage?.count === "number") {
      return firstPage.count
    }
    return allItems.length
  }, [allItems.length, extractTotalCount, pages])

  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0
  const safeCurrentPage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1
  const loading = isLoading || isFetchingNextPage

  useEffect(() => {
    const loadedPages = pages?.length ?? 0

    if (safeCurrentPage <= loadedPages || !hasNextPage) {
      return
    }

    let cancelled = false

    const fetchPagesSequentially = async () => {
      let pagesNeeded = safeCurrentPage - loadedPages

      while (!cancelled && pagesNeeded > 0 && hasNextPage) {
        await fetchNextPage()
        pagesNeeded -= 1
      }
    }

    fetchPagesSequentially().catch(() => {
      // Silently ignore errors - the original hook handles surfacing failures
    })

    return () => {
      cancelled = true
    }
  }, [
fetchNextPage, hasNextPage, pages?.length, safeCurrentPage
])

  const items = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return allItems.slice(startIndex, endIndex)
  }, [allItems, pageSize, safeCurrentPage])

  const pagination = useMemo<PaginationState>(() => {
    const computedTotalPages = totalPages > 0 ? totalPages : 1
    return {
      currentPage: safeCurrentPage,
      totalPages: computedTotalPages,
      totalCount,
      pageSize,
      hasNextPage:
        (totalPages > 0 && safeCurrentPage < totalPages) ||
        (!!hasNextPage && totalPages === 0),
      hasPrevPage: totalPages > 0 && safeCurrentPage > 1,
    }
  }, [
hasNextPage, pageSize, safeCurrentPage, totalCount, totalPages
])

  return {
    items,
    pagination,
    loading,
  }
}



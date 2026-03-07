"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"

import {
  usePaginatedNavigation,
  usePreserveScrollPosition,
} from "@/hooks/usePaginatedNavigation"
import { useScrollToDataList } from "@/hooks/useScrollToDataList"
import { useSyncPaginationUrl } from "@/hooks/useSyncPaginationUrl"

const SCROLL_ADDITIONAL_OFFSET = 32

export interface AlphabeticalBrowserStatePagination {
  currentPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface UseAlphabeticalBrowserStateOptions {
  /** Current letter from URL (parsed by caller from route params or search params). */
  letter: string | null
  /** Page number from URL (pg search param). Caller parses and passes for data fetching; hook uses for URL sync. */
  pageFromUrl: number
  /** Base path for URL sync (e.g. "/the-vault" or "/the-vault/a" when letter in path; "/houses" when letter in query). */
  basePathForSync: string
  /** Build URL for a given page (used by pagination next/prev). */
  buildPath: (page: number) => string
  /** Build URL when user selects a letter (used by letter nav). */
  buildPathForLetter: (letter: string | null) => string
  pagination: AlphabeticalBrowserStatePagination
  loading: boolean
  itemCount: number
}

export interface UseAlphabeticalBrowserStateResult {
  handleLetterClick: (letter: string | null) => void
  handleNextPage: () => void
  handlePrevPage: () => void
}

/**
 * Shared hook for alphabetical browser + pagination URL state, scroll sync, and navigation.
 * Use in TheVaultClient and AllHousesClient to avoid duplicating pagination setup.
 */
export function useAlphabeticalBrowserState({
  letter,
  pageFromUrl,
  basePathForSync,
  buildPath,
  buildPathForLetter,
  pagination,
  loading,
  itemCount,
}: UseAlphabeticalBrowserStateOptions): UseAlphabeticalBrowserStateResult {
  const router = useRouter()

  const navigate = useMemo(
    () =>
      (
        to: string,
        opts?: { replace?: boolean; preventScrollReset?: boolean }
      ) => {
        router[opts?.replace ? "replace" : "push"](to, {
          scroll: !opts?.preventScrollReset,
        })
      },
    [router]
  )

  const { handleNextPage, handlePrevPage } = usePaginatedNavigation({
    currentPage: pagination.currentPage,
    hasNextPage: pagination.hasNextPage,
    hasPrevPage: pagination.hasPrevPage,
    navigate,
    buildPath,
  })

  usePreserveScrollPosition(loading)

  useSyncPaginationUrl({
    currentPage: pagination.currentPage,
    pageFromUrl,
    letter,
    basePath: basePathForSync,
  })

  const handleLetterClick = (targetLetter: string | null) => {
    router.push(buildPathForLetter(targetLetter), { scroll: false })
  }

  useScrollToDataList({
    trigger: letter,
    enabled: !!letter,
    isLoading: loading,
    hasData: itemCount > 0,
    additionalOffset: SCROLL_ADDITIONAL_OFFSET,
  })

  useScrollToDataList({
    trigger: pagination.currentPage,
    enabled: !!letter && !!pagination.currentPage,
    isLoading: loading,
    hasData: itemCount > 0,
    additionalOffset: SCROLL_ADDITIONAL_OFFSET,
    skipInitialScroll: true,
  })

  return {
    handleLetterClick,
    handleNextPage,
    handlePrevPage,
  }
}

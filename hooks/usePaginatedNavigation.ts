import { useCallback, useEffect } from "react"
import type { NavigateFunction } from "react-router"

const DEFAULT_NAVIGATE_OPTIONS = { preventScrollReset: true } as const

type BuildPathFn = (page: number) => string

interface UsePaginatedNavigationOptions {
  currentPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
  navigate: NavigateFunction
  buildPath: BuildPathFn
  navigateOptions?: Parameters<NavigateFunction>[1]
}

interface UsePaginatedNavigationResult {
  goToPage: (page: number) => void
  handleNextPage: () => void
  handlePrevPage: () => void
}

export const usePaginatedNavigation = ({
  currentPage,
  hasNextPage,
  hasPrevPage,
  navigate,
  buildPath,
  navigateOptions,
}: UsePaginatedNavigationOptions): UsePaginatedNavigationResult => {
  const goToPage = useCallback(
    (page: number) => {
      const targetPage = Math.max(1, page)
      const to = buildPath(targetPage)
      const options = navigateOptions ?? DEFAULT_NAVIGATE_OPTIONS
      navigate(to, options)
    },
    [buildPath, navigate, navigateOptions]
  )

  const handleNextPage = useCallback(() => {
    if (!hasNextPage) {
      return
    }
    goToPage(currentPage + 1)
  }, [currentPage, goToPage, hasNextPage])

  const handlePrevPage = useCallback(() => {
    if (!hasPrevPage) {
      return
    }
    goToPage(currentPage - 1)
  }, [currentPage, goToPage, hasPrevPage])

  return {
    goToPage,
    handleNextPage,
    handlePrevPage,
  }
}

export const usePreserveScrollPosition = (loading: boolean) => {
  useEffect(() => {
    if (!loading) {
      return
    }

    const savedPosition =
      typeof window !== "undefined"
        ? window.scrollY || document.documentElement.scrollTop
        : 0

    if (savedPosition > 0) {
      window.scrollTo(0, savedPosition)
    }
  }, [loading])
}


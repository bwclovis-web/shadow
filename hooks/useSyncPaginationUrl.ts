import { useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router"

interface UseSyncPaginationUrlOptions {
  currentPage: number
  pageFromUrl: number
  letter: string | null
  basePath: string
}

export function useSyncPaginationUrl({
  currentPage,
  pageFromUrl,
  letter,
  basePath,
}: UseSyncPaginationUrlOptions) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const previousLetterRef = useRef<string | null>(null)

  useEffect(() => {
    const letterJustChanged = previousLetterRef.current !== letter
    previousLetterRef.current = letter

    // Don't sync URL if letter just changed - let the letter navigation handle it
    if (letterJustChanged) {
      return
    }

    if (letter && currentPage !== pageFromUrl) {
      const newSearchParams = new URLSearchParams(searchParams)
      if (currentPage === 1) {
        newSearchParams.delete("pg")
      } else {
        newSearchParams.set("pg", currentPage.toString())
      }
      navigate(
        `${basePath}/${letter}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ""}`,
        { replace: true, preventScrollReset: true }
      )
    }
  }, [
    currentPage,
    pageFromUrl,
    letter,
    basePath,
    navigate,
    searchParams,
  ])
}


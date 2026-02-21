import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface UseSyncPaginationUrlOptions {
  currentPage: number
  pageFromUrl: number
  letter: string | null
  basePath: string
}

export const useSyncPaginationUrl = ({
  currentPage,
  pageFromUrl,
  letter,
  basePath,
}: UseSyncPaginationUrlOptions) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const previousLetterRef = useRef<string | null>(null)

  useEffect(() => {
    const letterJustChanged = previousLetterRef.current !== letter
    previousLetterRef.current = letter

    // Don't sync URL if letter just changed - let the letter navigation handle it
    if (letterJustChanged) {
      return
    }

    if (letter && currentPage !== pageFromUrl) {
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.set("letter", letter.toLowerCase())
      if (currentPage === 1) {
        newSearchParams.delete("pg")
      } else {
        newSearchParams.set("pg", currentPage.toString())
      }
      const query = newSearchParams.toString()
      router.replace(`${basePath}?${query}`, { scroll: false })
    }
  }, [
    currentPage,
    pageFromUrl,
    letter,
    basePath,
    router,
    searchParams,
  ])
}


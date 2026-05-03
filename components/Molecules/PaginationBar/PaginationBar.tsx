"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import { getPaginationVisiblePages } from "@/utils/paginationVisiblePages"
import { styleMerge } from "@/utils/styleUtils"

export interface PaginationBarProps {
  /** 1-based current page */
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  /**
   * Page buttons shown on each side of the current page (default 1).
   * First/last page and neighbors are merged with ellipsis gaps.
   */
  siblingCount?: number
  className?: string
  /** Warm next infinite-query chunk on hover (e.g. `fetchNextPage`). */
  onPrefetchNext?: () => void
  /** Warm data for a target UI page on hover (e.g. forward `fetchNextPage` until slice covers). */
  onPrefetchPage?: (page: number) => void
}

/**
 * Numbered pagination with ellipses, first/last jumps, prev/next, and a “page X of Y” line.
 * First/last are shown when there is more than one page; they are disabled on the boundary pages.
 */
export const PaginationBar = ({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
  onPrefetchNext,
  onPrefetchPage,
}: PaginationBarProps) => {
  const t = useTranslations("common")

  if (totalPages <= 1) {
    return null
  }

  const safeCurrent = Math.min(Math.max(1, currentPage), totalPages)
  const items = getPaginationVisiblePages(
    safeCurrent,
    totalPages,
    siblingCount
  )

  const go = (page: number) => {
    const p = Math.min(Math.max(1, page), totalPages)
    if (p !== safeCurrent) {
      onPageChange(p)
    }
  }

  const prefetchPageIfNeeded = (page: number) => {
    const p = Math.min(Math.max(1, page), totalPages)
    if (p === safeCurrent) return
    onPrefetchPage?.(p)
  }

  const prefetchNext = () => {
    onPrefetchNext?.()
    if (!onPrefetchNext) {
      prefetchPageIfNeeded(safeCurrent + 1)
    }
  }

  return (
    <nav
      aria-label={t("paginationNav")}
      className={styleMerge("flex flex-col items-center gap-3", className)}
    >
      <div className="flex flex-wrap justify-center items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={safeCurrent <= 1}
          onClick={() => go(1)}
          onMouseEnter={() => prefetchPageIfNeeded(1)}
          aria-label={t("paginationFirst")}
        >
          {t("paginationFirst")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={safeCurrent <= 1}
          onClick={() => go(safeCurrent - 1)}
          onMouseEnter={() => prefetchPageIfNeeded(safeCurrent - 1)}
        >
          {t("previous")}
        </Button>

        {items.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`e-${index}`}
              className="px-2 text-noir-gold/60 select-none"
              aria-hidden
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={item === safeCurrent ? "primary" : "secondary"}
              size="sm"
              className="px-2"
              onClick={() => go(item)}
              onMouseEnter={() => prefetchPageIfNeeded(item)}
              aria-current={item === safeCurrent ? "page" : undefined}
            >
              {item}
            </Button>
          )
        )}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={safeCurrent >= totalPages}
          onClick={() => go(safeCurrent + 1)}
          onMouseEnter={prefetchNext}
        >
          {t("next")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={safeCurrent >= totalPages}
          onClick={() => go(totalPages)}
          onMouseEnter={() => {
            onPrefetchPage?.(totalPages)
            if (!onPrefetchPage) {
              prefetchNext()
            }
          }}
          aria-label={t("paginationLast")}
        >
          {t("paginationLast")}
        </Button>
      </div>

      <span className="text-sm text-noir-gold/80">
        {t("pageOf", { current: safeCurrent, total: totalPages })}
      </span>
    </nav>
  )
}

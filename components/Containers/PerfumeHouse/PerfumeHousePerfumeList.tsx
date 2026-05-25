"use client"

import { useTranslations } from "next-intl"
import { type RefObject } from "react"

import { PaginationBar } from "@/components/Molecules/PaginationBar"
import LinkCard from "@/components/Organisms/LinkCard"

interface PaginationState {
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  totalCount: number
  pageSize: number
}

interface PerfumeHousePerfumeListProps {
  perfumes: any[]
  loading: boolean
  pagination: PaginationState
  onPageChange: (page: number) => void
  selectedLetter?: string | null
  queryError?: Error | null
  onPrefetchNext?: () => void
  onPrefetchPage?: (page: number) => void
  containerRef?: RefObject<HTMLDivElement | null>
  transitionCueKey?: string
  transitionCueDirection?: "forward" | "backward"
}

const PerfumeHousePerfumeList = ({
  perfumes,
  loading,
  pagination,
  onPageChange,
  selectedLetter,
  queryError,
  onPrefetchNext,
  onPrefetchPage,
  containerRef,
  transitionCueKey,
  transitionCueDirection = "forward",
}: PerfumeHousePerfumeListProps) => {
  const tSingleHouse = useTranslations("singleHouse")

  return (
    <div
      id="data-list"
      ref={containerRef}
      className="rounded-b-lg w-full relative"
    >
      {transitionCueKey ? (
        <div
          key={`${transitionCueKey}-${transitionCueDirection}`}
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 z-10 h-16 overflow-hidden"
        >
          <div
            className={`absolute top-0 h-px w-2/5 bg-gradient-to-r from-transparent via-noir-gold-100 to-transparent ${
              transitionCueDirection === "forward"
                ? "motion-safe:animate-grid-cue-forward"
                : "motion-safe:animate-grid-cue-backward"
            }`}
          />
        </div>
      ) : null}
      <h2 className="text-center mb-4">{tSingleHouse("perfumes")}</h2>

      {loading && perfumes.length === 0 ? (
        <div
          className="text-center py-6 min-h-[320px] flex items-center justify-center"
          aria-busy="true"
        >
          {tSingleHouse("loadingPerfumes")}
        </div>
      ) : perfumes.length > 0 ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 p-2 pb-4 gap-4">
          {perfumes.map((perfume: any, index: number) => (
            <li key={perfume.id} className="h-full" data-display-card>
              <LinkCard
                type="perfume"
                data={{
                  id: String(perfume.id),
                  name: perfume.name,
                  slug: perfume.slug,
                  image: perfume.image,
                }}
                selectedLetter={selectedLetter}
                imageAlt={tSingleHouse("perfumeBottleAltText", {
                  name: perfume.name,
                })}
                imagePriority={index < 6}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-6">{tSingleHouse("noPerfumes")}</div>
      )}

      {queryError && (
        <div className="text-center text-red-400 py-4" role="alert">
          {tSingleHouse("errorLoadingPerfumes")}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <PaginationBar
          className="py-6"
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
          onPrefetchNext={onPrefetchNext}
          onPrefetchPage={onPrefetchPage}
        />
      )}
    </div>
  )
}

export default PerfumeHousePerfumeList
